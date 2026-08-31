<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Support\Pipeline;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The firm's clients: the leads that reached the last stage and are still on.
 *
 * There is no second record. A client is a lead standing in the `client`
 * stage, so every figure here is read from the leads table and the stage move
 * that made it a client, and the chain from content to client stays one line.
 */
class ClientController extends Controller
{
    private const PER_PAGE = 20;

    /** The pj filter value that means nobody has been assigned yet. */
    public const UNASSIGNED = 'tanpa';

    private const MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];

    public function index(Request $request): Response
    {
        $filters = $this->filters($request);

        /*
         | A client nobody has spoken to for longer than the stage's own
         | tolerance is due a call. The number is read from config/pipeline.php,
         | the same one that marks a client mandek on the Leads page.
         */
        $threshold = Pipeline::threshold('client');

        $matching = $this->matching($filters);

        return Inertia::render('clients', [
            'filters' => $filters,
            'total' => $this->base()->count(),
            'contactThreshold' => $threshold,
            'summary' => $this->summary(clone $matching, $threshold),
            /*
             | The rails count under every filter except their own, so picking
             | a channel or a person never hides the size of the ones not picked.
             */
            'channels' => $this->channels($this->matching($filters, except: 'channel')),
            'owners' => $this->owners($this->matching($filters, except: 'pj')),
            'sources' => $this->sources(clone $matching),
            'services' => $this->base()->distinct()->orderBy('service')->pluck('service')->all(),
            'rows' => $this->page(clone $matching, $filters, $threshold),
        ]);
    }

    /**
     * The filters the list is read through, normalised and safe to trust.
     *
     * @return array{q: string, layanan: string, channel: string, pj: string, urut: string}
     */
    private function filters(Request $request): array
    {
        $channels = array_keys(Pipeline::channels());
        $sorts = ['sejak', 'kontak', 'nilai', 'nama'];

        $pick = function (string $key) use ($request): string {
            $value = mb_substr(trim((string) $request->query($key, '')), 0, 80);

            return $value === '' ? 'semua' : $value;
        };

        $channel = (string) $request->query('channel', 'semua');
        $urut = (string) $request->query('urut', 'sejak');

        return [
            'q' => trim((string) $request->query('q', '')),
            'layanan' => $pick('layanan'),
            'channel' => in_array($channel, $channels, true) ? $channel : 'semua',
            'pj' => $pick('pj'),
            'urut' => in_array($urut, $sorts, true) ? $urut : 'sejak',
        ];
    }

    /** @return Builder<Lead> */
    private function base(): Builder
    {
        return Lead::query()->active()->where('stage', 'client');
    }

    /**
     * Every filter but the one named, which a rail needs left open.
     *
     * @param  array<string, string>  $filters
     * @return Builder<Lead>
     */
    private function matching(array $filters, ?string $except = null): Builder
    {
        return $this->base()
            ->when(
                $except !== 'channel' && $filters['channel'] !== 'semua',
                fn (Builder $query) => $query->where('channel', $filters['channel']),
            )
            ->when(
                $except !== 'pj' && $filters['pj'] !== 'semua',
                fn (Builder $query) => $filters['pj'] === self::UNASSIGNED
                    ? $query->where(fn (Builder $group) => $group->whereNull('owner')->orWhere('owner', ''))
                    : $query->where('owner', $filters['pj']),
            )
            ->when(
                $filters['layanan'] !== 'semua',
                fn (Builder $query) => $query->where('service', $filters['layanan']),
            )
            ->when($filters['q'] !== '', function (Builder $query) use ($filters) {
                $like = '%'.$filters['q'].'%';

                $query->where(fn (Builder $group) => $group
                    ->where('company', 'like', $like)
                    ->orWhere('pic', 'like', $like)
                    ->orWhere('service', 'like', $like)
                    ->orWhere('source', 'like', $like)
                    ->orWhere('owner', 'like', $like)
                    ->orWhere('city', 'like', $like));
            });
    }

    /**
     * The four figures on the page, each with the quantity it is read against.
     *
     * Computed over what the filters match, so narrowing to one channel or one
     * person turns the strip into that channel's or that person's own ledger.
     *
     * @param  Builder<Lead>  $matching
     * @return array<string, int|string|null>
     */
    private function summary(Builder $matching, int $threshold): array
    {
        $today = Carbon::today();
        $thisMonth = $today->copy()->startOfMonth();
        $lastMonth = $thisMonth->copy()->subMonth();

        $rows = (clone $matching)->get(['entered_at', 'stage_changed_at', 'value']);
        $count = $rows->count();
        $value = (int) $rows->sum(fn (Lead $lead) => $lead->value);

        // Days from the first enquiry to becoming a client, shortest first.
        $conversion = $rows
            ->map(fn (Lead $lead) => $this->daysToConvert($lead))
            ->sort()
            ->values();

        return [
            'count' => $count,
            'value' => $value,
            'average' => $count === 0 ? 0 : (int) round($value / $count),
            'newThisMonth' => (clone $matching)
                ->whereDate('stage_changed_at', '>=', $thisMonth->toDateString())
                ->count(),
            'newLastMonth' => (clone $matching)
                ->whereDate('stage_changed_at', '>=', $lastMonth->toDateString())
                ->whereDate('stage_changed_at', '<', $thisMonth->toDateString())
                ->count(),
            'lastMonth' => self::MONTHS[$lastMonth->month - 1],
            'medianDays' => $count === 0 ? null : $this->median($conversion),
            'fastestDays' => $count === 0 ? null : (int) $conversion->first(),
            'needsContact' => $this->needingContact(clone $matching, $threshold)->count(),
        ];
    }

    /**
     * Clients whose last contact is older than the stage tolerates.
     *
     * @param  Builder<Lead>  $query
     * @return Builder<Lead>
     */
    private function needingContact(Builder $query, int $threshold): Builder
    {
        $cutoff = Carbon::today()->subDays($threshold)->toDateString();

        return $query->whereRaw('date(coalesce(last_contact_at, entered_at)) < ?', [$cutoff]);
    }

    /**
     * How many clients each channel brought in, and what they are worth.
     *
     * @param  Builder<Lead>  $query
     * @return array<int, array{key: string, label: string, count: int, value: int}>
     */
    private function channels(Builder $query): array
    {
        $stats = $query
            ->selectRaw('channel, count(*) as total, coalesce(sum(value), 0) as value')
            ->groupBy('channel')
            ->toBase()
            ->get()
            ->keyBy('channel');

        return collect(Pipeline::channels())
            ->map(fn (string $label, string $key) => [
                'key' => $key,
                'label' => $label,
                'count' => (int) ($stats[$key]->total ?? 0),
                'value' => (int) ($stats[$key]->value ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * Clients per person, busiest first; the unassigned last, and only if any.
     *
     * @param  Builder<Lead>  $query
     * @return array<int, array{key: string, label: string, count: int, value: int}>
     */
    private function owners(Builder $query): array
    {
        $stats = $query
            ->selectRaw('owner, count(*) as total, coalesce(sum(value), 0) as value')
            ->groupBy('owner')
            ->toBase()
            ->get();

        $named = $stats
            ->filter(fn (object $stat) => (string) $stat->owner !== '')
            ->map(fn (object $stat) => [
                'key' => (string) $stat->owner,
                'label' => (string) $stat->owner,
                'count' => (int) $stat->total,
                'value' => (int) $stat->value,
            ])
            ->sortBy([['count', 'desc'], ['label', 'asc']])
            ->values();

        $unassigned = $stats->filter(fn (object $stat) => (string) $stat->owner === '');

        if ($unassigned->isNotEmpty()) {
            $named->push([
                'key' => self::UNASSIGNED,
                'label' => 'Belum ditentukan',
                'count' => (int) $unassigned->sum(fn (object $stat) => (int) $stat->total),
                'value' => (int) $unassigned->sum(fn (object $stat) => (int) $stat->value),
            ]);
        }

        return $named->all();
    }

    /**
     * The pieces of content that produced the most clients.
     *
     * This is the question the product exists to answer: not which content
     * got leads, but which content ended in a signed client.
     *
     * @param  Builder<Lead>  $query
     * @return array<int, array{channel: string, source: string, count: int, value: int}>
     */
    private function sources(Builder $query): array
    {
        return $query
            ->whereNotNull('source')
            ->where('source', '!=', '')
            ->selectRaw('channel, source, count(*) as total, coalesce(sum(value), 0) as value')
            ->groupBy('channel', 'source')
            ->orderByDesc('total')
            ->orderByDesc('value')
            ->orderBy('source')
            ->limit(5)
            ->toBase()
            ->get()
            ->map(fn (object $row) => [
                'channel' => (string) $row->channel,
                'source' => (string) $row->source,
                'count' => (int) $row->total,
                'value' => (int) $row->value,
            ])
            ->all();
    }

    /**
     * @param  Builder<Lead>  $query
     * @param  array<string, string>  $filters
     * @return array<string, mixed>
     */
    private function page(Builder $query, array $filters, int $threshold): array
    {
        $page = $this->sorted($query, $filters['urut'])
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return [
            'data' => collect($page->items())
                ->map(fn (Lead $lead) => $this->row($lead, $threshold))
                ->all(),
            'from' => $page->firstItem() ?? 0,
            'to' => $page->lastItem() ?? 0,
            'total' => $page->total(),
            'current' => $page->currentPage(),
            'last' => $page->lastPage(),
        ];
    }

    /**
     * @param  Builder<Lead>  $query
     * @return Builder<Lead>
     */
    private function sorted(Builder $query, string $sort): Builder
    {
        return match ($sort) {
            'nama' => $query->orderBy('entity')->orderBy('company'),
            'nilai' => $query->orderByDesc('value')->orderBy('company'),
            // Longest unspoken-to first: sorted this way, the list is the call sheet.
            'kontak' => $query->orderByRaw('coalesce(last_contact_at, entered_at)')->orderBy('company'),
            default => $query->orderByDesc('stage_changed_at')->orderByDesc('id'),
        };
    }

    /**
     * The lead row, plus what only means something once it is a client.
     *
     * @return array<string, mixed>
     */
    private function row(Lead $lead, int $threshold): array
    {
        return [
            ...$lead->toRow(),
            'owner' => $lead->owner ?: null,
            'city' => $lead->city,
            'since' => $lead->stage_changed_at->toDateString(),
            'daysToConvert' => $this->daysToConvert($lead),
            'needsContact' => $lead->daysSinceContact() > $threshold,
        ];
    }

    /** Days from the first enquiry to the move into the client stage. */
    private function daysToConvert(Lead $lead): int
    {
        return max((int) $lead->entered_at->startOfDay()->diffInDays($lead->stage_changed_at), 0);
    }

    /** @param  Collection<int, int>  $sorted */
    private function median(Collection $sorted): int
    {
        $count = $sorted->count();
        $middle = intdiv($count, 2);

        return $count % 2 === 1
            ? (int) $sorted[$middle]
            : (int) round(($sorted[$middle - 1] + $sorted[$middle]) / 2);
    }
}
