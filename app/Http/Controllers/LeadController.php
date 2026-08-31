<?php

namespace App\Http\Controllers;

use App\Http\Requests\LeadRequest;
use App\Models\Content;
use App\Models\Lead;
use App\Models\LeadStageEvent;
use App\Support\Attachments;
use App\Support\ContentPlan;
use App\Support\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class LeadController extends Controller
{
    /** Rows per page in the table. */
    private const PER_PAGE = 15;

    /** Cards loaded per board column before the column asks for more. */
    private const PER_COLUMN = 20;

    public function index(Request $request): Response
    {
        $filters = $this->filters($request);

        // The board is for work in progress; what has stopped has none left.
        if ($filters['tampil'] === 'tutup') {
            $filters['view'] = 'tabel';
        }

        $board = $filters['view'] === 'papan';

        /*
         | Two scopes: everything the filters match, and then only the leads in
         | the state being looked at. The closed count is read from the first,
         | so the chip that reveals them can say how many there are.
         */
        $unscoped = $this->matching($filters);
        $matching = $filters['tampil'] === 'semua'
            ? (clone $unscoped)
            : (clone $unscoped)->where(
                'status',
                $filters['tampil'] === 'tutup' ? Lead::CLOSED : Lead::ACTIVE,
            );

        /*
         | Stage chips count under every filter except the stage itself, so
         | switching stage never hides the size of the one you left.
         */
        $counts = (clone $matching)
            ->selectRaw('stage, count(*) as total')
            ->groupBy('stage')
            ->pluck('total', 'stage');

        $stages = collect(Pipeline::forClient())
            ->map(fn (array $stage) => [...$stage, 'count' => (int) ($counts[$stage['key']] ?? 0)])
            ->all();

        // The board shows every column at once, so its stage filter is moot.
        $scoped = $board || $filters['tahap'] === 'semua'
            ? clone $matching
            : (clone $matching)->where('stage', $filters['tahap']);

        return Inertia::render('leads', [
            'filters' => $filters,
            'stages' => $stages,
            // Its own chip: what stopped is read beside the pipeline, not inside it.
            'closedCount' => (clone $unscoped)->closed()->count(),
            'totals' => [
                'count' => (clone $scoped)->count(),
                'value' => (int) (clone $scoped)->sum('value'),
                'stalled' => (clone $scoped)->stalled()->count(),
            ],
            'rows' => $board ? null : $this->page($scoped, $filters),
            'columns' => $board
                ? $this->columns((clone $unscoped)->active(), $filters)
                : null,
        ]);
    }

    public function create(Request $request): Response
    {
        $stage = (string) $request->query('tahap', 'lead');

        return Inertia::render('lead-create', [
            'services' => Pipeline::services(),
            'contents' => $this->contents(),
            // The Client page opens the form on the last stage: a client that predates the tool.
            'stage' => in_array($stage, Pipeline::keys(), true) ? $stage : 'lead',
        ]);
    }

    public function store(LeadRequest $request)
    {
        $lead = DB::transaction(function () use ($request) {
            $lead = Lead::create([
                ...$request->columns(),
                'stage_changed_at' => $request->date('entered_at'),
                'last_contact_at' => $request->date('entered_at'),
            ]);

            /*
             | A lead that starts past the first stage still needs the stages
             | before it on record, or its journey would begin mid-sentence.
             */
            foreach (array_slice(Pipeline::keys(), 0, Pipeline::index($lead->stage) + 1) as $stage) {
                LeadStageEvent::create([
                    'lead_id' => $lead->id,
                    'stage' => $stage,
                    'entered_at' => $lead->entered_at,
                ]);
            }

            $files = $request->file('files', []);
            $body = trim((string) $request->input('note', ''));

            if ($body !== '' || $files !== []) {
                $note = $lead->notes()->create([
                    'author' => $request->user()->name,
                    'body' => $body,
                ]);

                Attachments::store($lead, $files, $note);
            }

            return $lead;
        });

        $this->toast(
            $lead->displayName().' tersimpan',
            'Masuk ke tahap '.Pipeline::label($lead->stage).'.',
        );

        return to_route('leads.show', $lead);
    }

    public function show(Lead $lead): Response
    {
        $lead->load(['stageEvents', 'notes.attachments', 'followUps']);

        return Inertia::render('lead-detail', [
            'lead' => [
                ...$lead->toRow(),
                'entity' => $lead->entity,
                'name' => $lead->company,
                'picRole' => $lead->pic_role,
                'phone' => $lead->phone,
                'email' => $lead->email,
                'npwp' => $lead->npwp,
                'address' => $lead->address,
                'city' => $lead->city,
                'owner' => $lead->owner,
                'office' => $lead->office_lat === null || $lead->office_lng === null
                    ? null
                    : ['lat' => $lead->office_lat, 'lng' => $lead->office_lng],
                'closedNote' => $lead->closed_note,
                'contentId' => $lead->content_id,
            ],
            'timeline' => $this->timeline($lead),
            'notes' => $lead->notes->map(fn ($note) => [
                'id' => $note->id,
                'author' => $note->author,
                'at' => $note->created_at->toDateString(),
                'body' => $note->body,
                'files' => $note->attachments->map(Attachments::toArray(...))->all(),
            ])->all(),
            'followUps' => $lead->followUps->map(fn ($followUp) => [
                'id' => $followUp->id,
                'at' => $followUp->scheduled_for->toDateString(),
                'via' => $followUp->via,
                'note' => $followUp->note,
                'done' => $followUp->done,
            ])->all(),
        ]);
    }

    public function edit(Lead $lead): Response
    {
        return Inertia::render('lead-edit', [
            'lead' => [
                'id' => $lead->id,
                'entity' => $lead->entity,
                'company' => $lead->company,
                'pic' => $lead->pic,
                'picRole' => $lead->pic_role,
                'phone' => $lead->phone,
                'email' => $lead->email,
                'npwp' => $lead->npwp,
                'address' => $lead->address,
                'city' => $lead->city,
                'office' => $lead->office_lat === null || $lead->office_lng === null
                    ? null
                    : ['lat' => $lead->office_lat, 'lng' => $lead->office_lng],
                'channel' => $lead->channel,
                'source' => $lead->source,
                'contentId' => $lead->content_id,
                'service' => $lead->service,
                'value' => $lead->value,
                'stage' => $lead->stage,
                'owner' => $lead->owner,
                'enteredAt' => $lead->entered_at->toDateString(),
            ],
            'services' => Pipeline::services(),
            'contents' => $this->contents(),
        ]);
    }

    public function update(LeadRequest $request, Lead $lead)
    {
        DB::transaction(function () use ($request, $lead) {
            $moved = $request->input('stage') !== $lead->stage;

            $lead->update([
                ...$request->columns(),
                ...($moved ? ['stage_changed_at' => Carbon::today()] : []),
            ]);

            if ($moved) {
                LeadStageEvent::create([
                    'lead_id' => $lead->id,
                    'stage' => $lead->stage,
                    'entered_at' => Carbon::today(),
                ]);
            }

            $files = $request->file('files', []);

            if ($files !== []) {
                $note = $lead->notes()->create([
                    'author' => $request->user()->name,
                    'body' => '',
                ]);

                Attachments::store($lead, $files, $note);
            }
        });

        $this->toast('Perubahan tersimpan', $lead->displayName().' sudah diperbarui.');

        return to_route('leads.show', $lead);
    }

    /**
     * What is live on each publishing channel, newest first, so the form
     * offers the calendar's own pieces and the chain back to them is a link.
     *
     * @return array<string, array<int, array{id: int, title: string}>>
     */
    private function contents(): array
    {
        $grouped = Content::published()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get(['id', 'title', 'channel'])
            ->groupBy('channel');

        return collect(ContentPlan::channels())
            ->mapWithKeys(fn (string $channel) => [
                $channel => ($grouped[$channel] ?? collect())
                    ->map(fn (Content $content) => ['id' => $content->id, 'title' => $content->title])
                    ->values()
                    ->all(),
            ])
            ->all();
    }

    /** The filters the list is read through, normalised and safe to trust. */
    private function filters(Request $request): array
    {
        $stages = Pipeline::keys();
        $channels = array_keys(Pipeline::channels());
        $sorts = ['lama', 'nilai', 'kontak', 'nama', 'masuk'];

        $date = function (?string $value): ?string {
            try {
                return $value ? Carbon::parse($value)->toDateString() : null;
            } catch (\Throwable) {
                return null;
            }
        };

        $tahap = (string) $request->query('tahap', 'semua');
        $channel = (string) $request->query('channel', 'semua');
        $urut = (string) $request->query('urut', 'lama');
        $view = (string) $request->query('view', 'tabel');
        $tampil = (string) $request->query('tampil', 'aktif');
        $kolom = (string) $request->query('kolom', '');

        return [
            'tahap' => in_array($tahap, $stages, true) ? $tahap : 'semua',
            'status' => $request->query('status') === 'mandek' ? 'mandek' : 'semua',
            'channel' => in_array($channel, $channels, true) ? $channel : 'semua',
            'dari' => $date($request->query('dari')),
            'sampai' => $date($request->query('sampai')),
            'q' => trim((string) $request->query('q', '')),
            'urut' => in_array($urut, $sorts, true) ? $urut : 'lama',
            'view' => $view === 'papan' ? 'papan' : 'tabel',
            // Leads still being worked, the ones that stopped, or both.
            'tampil' => in_array($tampil, ['aktif', 'tutup', 'semua'], true) ? $tampil : 'aktif',
            // Which board column has been asked to show more, and how many.
            'kolom' => in_array($kolom, $stages, true) ? $kolom : null,
            'per' => min(max((int) $request->query('per', self::PER_COLUMN), self::PER_COLUMN), 200),
        ];
    }

    /** Every filter except the stage, which the chips and the board need open. */
    private function matching(array $filters)
    {
        return Lead::query()
            ->when($filters['status'] === 'mandek', fn ($query) => $query->stalled())
            ->when($filters['channel'] !== 'semua', fn ($query) => $query->where('channel', $filters['channel']))
            ->when($filters['dari'], fn ($query, $from) => $query->whereDate('entered_at', '>=', $from))
            ->when($filters['sampai'], fn ($query, $to) => $query->whereDate('entered_at', '<=', $to))
            ->when($filters['q'], function ($query, $needle) {
                $like = '%'.$needle.'%';

                $query->where(fn ($group) => $group
                    ->where('company', 'like', $like)
                    ->orWhere('pic', 'like', $like)
                    ->orWhere('service', 'like', $like)
                    ->orWhere('source', 'like', $like)
                    ->orWhere('owner', 'like', $like));
            });
    }

    private function sorted($query, string $sort)
    {
        return match ($sort) {
            'nilai' => $query->orderByDesc('value'),
            'kontak' => $query->orderBy('last_contact_at'),
            'nama' => $query->orderBy('entity')->orderBy('company'),
            'masuk' => $query->orderByDesc('entered_at')->orderByDesc('id'),
            // Default surfaces the problem first: stalled, then longest waiting.
            default => $query
                ->orderByRaw('case when stalled_at < ? then 0 else 1 end', [Carbon::today()->toDateString()])
                ->orderBy('stage_changed_at'),
        };
    }

    private function page($query, array $filters): array
    {
        $page = $this->sorted($query, $filters['urut'])
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return [
            'data' => collect($page->items())->map->toRow()->all(),
            'from' => $page->firstItem() ?? 0,
            'to' => $page->lastItem() ?? 0,
            'total' => $page->total(),
            'current' => $page->currentPage(),
            'last' => $page->lastPage(),
        ];
    }

    /**
     * One entry per stage, each holding the first cards and the true totals.
     *
     * The totals are counted in the database rather than from the cards on
     * screen, so a column's header stays honest however few of its leads have
     * been loaded.
     */
    private function columns($matching, array $filters): array
    {
        $today = Carbon::today()->toDateString();

        $stats = (clone $matching)
            ->selectRaw('stage, count(*) as total, coalesce(sum(value), 0) as value')
            ->selectRaw('sum(case when stalled_at < ? then 1 else 0 end) as stalled', [$today])
            ->groupBy('stage')
            ->get()
            ->keyBy('stage');

        return collect(Pipeline::forClient())
            ->map(function (array $stage) use ($matching, $filters, $stats) {
                $limit = $filters['kolom'] === $stage['key'] ? $filters['per'] : self::PER_COLUMN;

                $rows = $this->sorted(
                    (clone $matching)->where('stage', $stage['key']),
                    $filters['urut'],
                )->limit($limit)->get();

                $stat = $stats[$stage['key']] ?? null;

                return [
                    ...$stage,
                    'count' => (int) ($stat->total ?? 0),
                    'stalled' => (int) ($stat->stalled ?? 0),
                    'value' => (int) ($stat->value ?? 0),
                    'rows' => $rows->map->toRow()->all(),
                ];
            })
            ->all();
    }

    /**
     * The lead's journey, read from the stage moves themselves.
     *
     * Each step lasts until the next one starts; the one still open is measured
     * against today, so it keeps counting while nobody touches the record — or
     * against the day the lead closed, where the story ends.
     */
    private function timeline(Lead $lead): array
    {
        $events = $lead->stageEvents;
        $today = $lead->closed_at ?? Carbon::today();

        return $events->map(function (LeadStageEvent $event, int $index) use ($events, $today) {
            $next = $events[$index + 1] ?? null;
            $ends = $next?->entered_at ?? $today;

            return [
                'key' => $event->stage,
                'label' => Pipeline::label($event->stage),
                'enteredAt' => $event->entered_at->toDateString(),
                'days' => (int) $event->entered_at->startOfDay()->diffInDays($ends),
                'current' => $next === null,
            ];
        })->all();
    }
}
