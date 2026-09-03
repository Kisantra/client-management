<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContentRequest;
use App\Models\Content;
use App\Models\ContentIdea;
use App\Models\ContentStatusEvent;
use App\Support\ContentPlan;
use App\Support\Month;
use App\Support\Period;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The content calendar: what the team is making, for which channel, and
 * where each piece stands between draft and live.
 *
 * The screen is scoped to one month at a time, the way the team plans, so a
 * page never has to paginate a calendar.
 */
class ContentController extends Controller
{
    /** Leads shown on a piece's page before it points to the full list. */
    private const LEADS_SHOWN = 8;

    /**
     * The fields the board can stack its columns by. Every one of them is a
     * property of a piece that a person would sort a wall of cards by; the
     * board groups the month's rows in the browser, so this list only has to
     * keep the URL honest.
     */
    private const GROUPS = ['status', 'channel', 'pillar', 'type', 'pj'];

    /**
     * The windows the board offers.
     *
     * Content looks forward as well as back — half the calendar has not
     * happened yet — so the list runs in both directions from today. The
     * calendar view has no period at all: a calendar is a month, and stepping
     * months is the only window it can draw.
     */
    private const PERIODS = [
        'bulan-ini', 'bulan-lalu', 'bulan-depan', 'kuartal', 'tahun', 'semua', 'khusus',
    ];

    private const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    public function index(Request $request): Response
    {
        $filters = $this->filters($request);
        $month = Carbon::createFromFormat('Y-m-d', $filters['bulan'].'-01')->startOfMonth();
        $today = Carbon::today();

        /*
         | Which window the page is standing in depends on which view is
         | drawing it: the calendar can only ever be one month, the board can
         | be any stretch. One of the two controls is on screen at a time, and
         | this is the line that decides which.
         */
        $period = $filters['view'] === 'papan'
            ? Period::from($filters['periode'], $filters['dari'], $filters['sampai'], self::PERIODS, 'bulan-ini')
            : null;

        $matching = $this->matching($filters, $month, period: $period);

        $items = (clone $matching)
            ->withCount([
                'leads',
                'leads as clients_count' => fn (Builder $query) => $query
                    ->where('status', 'aktif')
                    ->where('stage', 'client'),
            ])
            ->orderBy('scheduled_for')
            /* Within a day, the running order is the posting order. */
            ->orderByRaw('scheduled_time is null, scheduled_time')
            ->orderBy('id')
            ->get()
            ->map(fn (Content $content) => $content->toRow())
            ->all();

        /*
         | Status chips count under every filter except the status itself, so
         | picking one never hides how many sit in the others.
         */
        $byStatus = $this->matching($filters, $month, except: 'status', period: $period)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->toBase()
            ->get()
            ->keyBy('status');

        $statuses = collect(ContentPlan::statuses())
            ->map(fn (array $status) => [
                ...$status,
                'count' => (int) ($byStatus[$status['key']]->total ?? 0),
            ])
            ->all();

        return Inertia::render('content', [
            'filters' => $filters,
            /* Null on the calendar, where the month stepper is the window. */
            'period' => $period?->toArray(),
            'month' => [
                'key' => $month->format('Y-m'),
                'label' => self::MONTHS[$month->month - 1].' '.$month->year,
                'start' => $month->toDateString(),
                'end' => $month->copy()->endOfMonth()->toDateString(),
                'prev' => $month->copy()->subMonth()->format('Y-m'),
                'next' => $month->copy()->addMonth()->format('Y-m'),
                'current' => $today->format('Y-m'),
                'today' => $today->toDateString(),
            ],
            'statuses' => $statuses,
            'totals' => [
                'count' => count($items),
                'late' => (clone $matching)->late()->count(),
                'published' => (clone $matching)->published()->count(),
            ],
            'owners' => Content::query()
                ->whereNotNull('owner')
                ->where('owner', '!=', '')
                ->distinct()
                ->orderBy('owner')
                ->pluck('owner')
                ->all(),
            'items' => $items,
            /*
             | The piece opened in the side panel, when the URL names one. A
             | closure, so the panel can ask for just this on a partial reload
             | and the calendar underneath never re-renders.
             */
            'selected' => fn () => $this->selected($request),
        ]);
    }

    /** The form is a dialog over the calendar: this URL opens it on a day. */
    public function create(Request $request)
    {
        $date = $this->date($request->query('tanggal')) ?? Carbon::today()->toDateString();
        $channel = (string) $request->query('channel', '');

        return to_route('content', [
            'bulan' => substr($date, 0, 7),
            'tambah' => 1,
            'tanggal' => $date,
            ...(in_array($channel, ContentPlan::channelKeys(), true) ? ['channel' => $channel] : []),
        ]);
    }

    public function store(ContentRequest $request)
    {
        $content = DB::transaction(function () use ($request) {
            $columns = $request->columns();
            $today = Carbon::today();

            $content = Content::create([
                ...$columns,
                'status_changed_at' => $today,
                'published_at' => $this->publishedAt($columns),
            ]);

            $content->statusEvents()->create([
                'status' => $content->status,
                'author' => $request->user()->name,
                'at' => $today,
            ]);

            /*
             | Started from the idea backlog: the idea now points at the piece
             | it became, so it reads there as done rather than lost.
             */
            if ($ideaId = $request->validated('idea_id')) {
                ContentIdea::whereKey($ideaId)->update(['content_id' => $content->id]);
            }

            return $content;
        });

        $this->toast(
            $content->title.' tersimpan',
            'Dijadwalkan '.$this->longDate($content->scheduled_for)
                .' di '.collect($content->channels ?? [])
                    ->map(fn (string $key) => ContentPlan::channelLabel($key))
                    ->join(', ', ' dan ')
                .' · status '.ContentPlan::label($content->status).'.',
        );

        return $this->toContent($content);
    }

    /** A piece's own URL opens its month with the panel already out. */
    public function show(Content $content)
    {
        return to_route('content', [
            'bulan' => $content->scheduled_for->format('Y-m'),
            'konten' => $content->id,
        ]);
    }

    private function selected(Request $request): ?array
    {
        $id = (int) $request->query('konten', 0);
        $content = $id > 0 ? Content::find($id) : null;

        return $content ? $this->detail($content) : null;
    }

    /**
     * Everything the panel shows for one piece.
     *
     * @return array<string, mixed>
     */
    private function detail(Content $content): array
    {
        $content->load('statusEvents')->loadCount([
            'leads',
            'leads as clients_count' => fn (Builder $query) => $query
                ->where('status', 'aktif')
                ->where('stage', 'client'),
        ]);

        return [
            'content' => [
                ...$content->toRow(),
                'brief' => $content->brief ?: null,
                'referenceUrl' => $content->reference_url ?: null,
                'caption' => $content->caption ?: null,
                'externalId' => $content->external_id ?: null,
            ],
            'events' => $content->statusEvents->map(fn (ContentStatusEvent $event) => [
                'id' => $event->id,
                'status' => $event->status,
                'label' => ContentPlan::label($event->status),
                'author' => $event->author,
                'note' => $event->note ?: null,
                'at' => $event->at->toDateString(),
            ])->all(),
            /*
             | The chain, read from this end: the newest leads this piece
             | brought in. A piece that worked can have a hundred; the page
             | shows the latest and points at the list for the rest.
             */
            'leads' => $content->leads()
                ->orderByDesc('entered_at')
                ->orderByDesc('id')
                ->limit(self::LEADS_SHOWN)
                ->get()
                ->map->toRow()
                ->all(),
        ];
    }

    /** Likewise for an existing piece: its panel, already turned to the form. */
    public function edit(Content $content)
    {
        return to_route('content', [
            'bulan' => $content->scheduled_for->format('Y-m'),
            'konten' => $content->id,
            'ubah' => 1,
        ]);
    }

    public function update(ContentRequest $request, Content $content)
    {
        DB::transaction(function () use ($request, $content) {
            $columns = $request->columns();
            $moved = $columns['status'] !== $content->status;
            $today = Carbon::today();

            $content->update([
                ...$columns,
                ...($moved ? ['status_changed_at' => $today] : []),
                'published_at' => $this->publishedAt($columns, $content),
            ]);

            if ($moved) {
                $content->statusEvents()->create([
                    'status' => $content->status,
                    'author' => $request->user()->name,
                    'at' => $today,
                ]);
            }
        });

        $this->toast('Perubahan tersimpan', $content->title.' sudah diperbarui.');

        return $this->toContent($content);
    }

    /** Back to the calendar, on the piece's month, with its panel open. */
    private function toContent(Content $content)
    {
        return to_route('content', [
            'bulan' => $content->scheduled_for->format('Y-m'),
            'konten' => $content->id,
        ]);
    }

    public function destroy(Content $content)
    {
        $month = $content->scheduled_for->format('Y-m');
        $title = $content->title;

        // Leads that came from it keep their source text; only the link goes.
        $content->delete();

        $this->toast($title.' dihapus', 'Lead yang berasal darinya tetap tercatat.');

        return to_route('content', ['bulan' => $month]);
    }

    /**
     * The filters the calendar is read through, normalised and safe to trust.
     *
     * @return array<string, string>
     */
    private function filters(Request $request): array
    {
        $channels = ContentPlan::channelKeys();
        $statuses = ContentPlan::keys();

        $bulan = (string) $request->query('bulan', '');
        $view = (string) $request->query('view', 'kalender');
        $grup = (string) $request->query('grup', 'status');
        $periode = (string) $request->query('periode', 'bulan-ini');
        $channel = (string) $request->query('channel', 'semua');
        $status = (string) $request->query('status', 'semua');
        $pj = mb_substr(trim((string) $request->query('pj', '')), 0, 80);

        return [
            'bulan' => preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $bulan) === 1
                ? $bulan
                : Carbon::today()->format('Y-m'),
            'view' => $view === 'papan' ? 'papan' : 'kalender',
            // Which field the board stacks its columns by.
            'grup' => in_array($grup, self::GROUPS, true) ? $grup : 'status',
            'channel' => in_array($channel, $channels, true) ? $channel : 'semua',
            'status' => in_array($status, $statuses, true) ? $status : 'semua',
            'pj' => $pj === '' ? 'semua' : $pj,
            'q' => trim((string) $request->query('q', '')),
            // Only what is past its date and still not live.
            'telat' => $request->query('telat') === '1' ? '1' : '',
            // One day out of the month, for the list behind a calendar cell's "+N".
            'hari' => $this->date($request->query('hari')) ?? '',
            // A URL that asks for the form to open, and on which day.
            'tambah' => $request->query('tambah') === '1' ? '1' : '',
            'tanggal' => $this->date($request->query('tanggal')) ?? '',
            // A URL that asks for the open piece's form rather than its record.
            'ubah' => $request->query('ubah') === '1' ? '1' : '',
            // The stretch the board covers, and the dates a custom one needs.
            'periode' => $periode,
            'dari' => $this->date($request->query('dari')) ?? '',
            'sampai' => $this->date($request->query('sampai')) ?? '',
        ];
    }

    /**
     * Every filter but the one named, which the status chips need left open.
     *
     * @param  array<string, string>  $filters
     * @return Builder<Content>
     */
    private function matching(array $filters, Carbon $month, ?string $except = null, ?Period $period = null): Builder
    {
        return Content::query()
            ->when(
                $period === null,
                fn (Builder $query) => $query->whereBetween('scheduled_for', Month::bounds($month)),
                fn (Builder $query) => $period->isOpen()
                    ? $query
                    : $query->whereBetween('scheduled_for', $period->bounds()),
            )
            ->when($filters['hari'] !== '', fn (Builder $query) => $query->whereDate('scheduled_for', $filters['hari']))
            ->when(
                $filters['channel'] !== 'semua',
                /* A piece belongs to every channel it goes out on. */
                fn (Builder $query) => $query->whereJsonContains(
                    'channels',
                    $filters['channel'],
                ),
            )
            ->when(
                $except !== 'status' && $filters['status'] !== 'semua',
                fn (Builder $query) => $query->where('status', $filters['status']),
            )
            ->when(
                $filters['pj'] !== 'semua',
                fn (Builder $query) => $filters['pj'] === 'tanpa'
                    ? $query->where(fn (Builder $group) => $group->whereNull('owner')->orWhere('owner', ''))
                    : $query->where('owner', $filters['pj']),
            )
            ->when($filters['telat'] === '1', fn (Builder $query) => $query->late())
            ->when($filters['q'] !== '', function (Builder $query) use ($filters) {
                $like = '%'.$filters['q'].'%';

                $query->where(fn (Builder $group) => $group
                    ->where('title', 'like', $like)
                    ->orWhere('brief', 'like', $like)
                    ->orWhere('caption', 'like', $like)
                    ->orWhere('owner', 'like', $like));
            });
    }

    /**
     * When a piece counts as live. Set the day it is marked published, kept
     * while it stays published, and cleared if it is pulled back.
     *
     * @param  array<string, mixed>  $columns
     */
    private function publishedAt(array $columns, ?Content $current = null): ?string
    {
        if ($columns['status'] !== Content::PUBLISHED) {
            return null;
        }

        $given = $columns['published_at'] ?? null;

        if ($given) {
            return Carbon::parse($given)->toDateString();
        }

        if ($current?->published_at) {
            return $current->published_at->toDateString();
        }

        return Carbon::today()->toDateString();
    }

    private function date(mixed $value): ?string
    {
        try {
            return $value ? Carbon::parse((string) $value)->toDateString() : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function longDate(CarbonInterface $date): string
    {
        return $date->day.' '.self::MONTHS[$date->month - 1].' '.$date->year;
    }
}
