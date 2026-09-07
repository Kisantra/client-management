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
 * The firm's clients: everything that has been signed and is still on.
 *
 * Two stages qualify — a lead that has dealt and one already running as an
 * active client — because the money is committed at the deal and the team
 * treats it as theirs from that moment. The two are never merged into one
 * word, though: a deal row says so on its face, the conversion figure counts
 * only the ones that actually converted, and each row is measured against the
 * contact tolerance of its own stage, not a shared one.
 *
 * There is no second record. A client is a lead standing in one of those two
 * stages, so every figure here is read from the leads table and the stage move
 * that put it there, and the chain from content to client stays one line.
 */
class ClientController extends Controller
{
    private const PER_PAGE = 20;

    /** The stages this page speaks for, in pipeline order. */
    private const STAGES = ['deal', 'client'];

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
         | Somebody nobody has spoken to for longer than their own stage
         | tolerates is due a call. A deal is given five days and a running
         | client thirty, both read from config/pipeline.php — the same numbers
         | that mark a lead mandek on the Leads page. One shared figure would
         | have let a signed deal go three weeks unanswered and still look fine.
         */
        $threshold = collect(self::STAGES)
            ->mapWithKeys(fn (string $stage) => [$stage => Pipeline::threshold($stage)])
            ->all();

        $matching = $this->matching($filters);

        return Inertia::render('clients', [
            'filters' => $filters,
            'total' => $this->base()->count(),
            'contactThreshold' => $threshold,
            'stageLabels' => collect(self::STAGES)
                ->mapWithKeys(fn (string $stage) => [$stage => Pipeline::label($stage)])
                ->all(),
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
        return Lead::query()->active()->whereIn('stage', self::STAGES);
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
    private function summary(Builder $matching, array $threshold): array
    {
        $today = Carbon::today();
        $thisMonth = $today->copy()->startOfMonth();
        $lastMonth = $thisMonth->copy()->subMonth();

        $rows = (clone $matching)->get(['stage', 'entered_at', 'stage_changed_at', 'value']);
        $count = $rows->count();
        $value = (int) $rows->sum(fn (Lead $lead) => $lead->value);

        /*
         | Days from the first enquiry to becoming a client, shortest first —
         | and only for the ones that got there. A deal has not converted yet,
         | so counting its shorter journey would drag the median down and
         | report a speed the firm never reached.
         */
        $conversion = $rows
            ->where('stage', 'client')
            ->map(fn (Lead $lead) => $this->daysToConvert($lead))
            ->sort()
            ->values();

        return [
            'count' => $count,
            /* Named apart on purpose: a deal is signed, not yet running, and
               a tile labelled "client aktif" may never count one. */
            'activeCount' => (clone $matching)->where('stage', 'client')->count(),
            'dealCount' => (clone $matching)->where('stage', 'deal')->count(),
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
            'medianDays' => $conversion->isEmpty() ? null : $this->median($conversion),
            'fastestDays' => $conversion->isEmpty() ? null : (int) $conversion->first(),
            'convertedCount' => $conversion->count(),
            'needsContact' => $this->needingContact(clone $matching, $threshold)->count(),
        ];
    }

    /**
     * Clients whose last contact is older than the stage tolerates.
     *
     * @param  Builder<Lead>  $query
     * @param  array<string, int>  $threshold
     * @return Builder<Lead>
     */
    private function needingContact(Builder $query, array $threshold): Builder
    {
        return $query->where(function (Builder $group) use ($threshold) {
            foreach ($threshold as $stage => $days) {
                $group->orWhere(fn (Builder $one) => $one
                    ->where('stage', $stage)
                    ->whereRaw(
                        'date(coalesce(last_contact_at, entered_at)) < ?',
                        [Carbon::today()->subDays($days)->toDateString()],
                    ));
            }
        });
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
    private function page(Builder $query, array $filters, array $threshold): array
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
    private function row(Lead $lead, array $threshold): array
    {
        return [
            ...$lead->toRow(),
            'owner' => $lead->owner ?: null,
            'city' => $lead->city,
            'stage' => $lead->stage,
            'stageLabel' => Pipeline::label($lead->stage),
            'since' => $lead->stage_changed_at->toDateString(),
            /* Only a client has converted; for a deal this is how long it took
               to sign, which is a different measurement and stays null. */
            'daysToConvert' => $lead->stage === 'client'
                ? $this->daysToConvert($lead)
                : null,
            'needsContact' => $lead->daysSinceContact() > ($threshold[$lead->stage] ?? 30),
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
