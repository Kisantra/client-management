<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * What the team did, newest first, in days.
 *
 * The grouping is the whole point. A flat run of three hundred lines answers
 * "what happened" only if you already know when; broken into days it answers
 * the question people actually arrive with — what happened today, and what did
 * I miss yesterday. Within a day the entries stay in clock order, because
 * inside one day the sequence is the story.
 *
 * Three filters, and each one is a question somebody asks out loud: who did
 * it, what kind of thing was it done to, and was it made, changed or removed.
 */
class ActivityController extends Controller
{
    /** How many entries one page holds before it asks you to go back further. */
    private const PER_PAGE = 60;

    /** The stretches the page offers, and how far back each reaches. */
    private const PERIODS = [
        'hari-ini' => 0,
        '7-hari' => 6,
        '30-hari' => 29,
        'semua' => null,
    ];

    public function __invoke(Request $request): Response
    {
        $filters = $this->filters($request);

        $entries = $this->matching($filters)
            ->with('user:id,name')
            ->latest('created_at')
            ->latest('id')
            ->simplePaginate(self::PER_PAGE)
            ->withQueryString();

        $rows = collect($entries->items());

        return Inertia::render('activity', [
            'filters' => $filters,
            'days' => $this->days($rows),
            'summary' => $this->summary($filters),
            /* The people who have ever done anything, so the picker offers
               names that will actually return rows. */
            'actors' => Activity::query()
                ->select('actor')
                ->distinct()
                ->orderBy('actor')
                ->pluck('actor')
                ->all(),
            'types' => $this->types(),
            'page' => [
                'shown' => $rows->count(),
                'hasMore' => $entries->hasMorePages(),
                'next' => $entries->nextPageUrl(),
                'prev' => $entries->previousPageUrl(),
            ],
        ]);
    }

    /**
     * @return array{siapa: string, jenis: string, aksi: string, periode: string}
     */
    private function filters(Request $request): array
    {
        $period = (string) $request->query('periode', '30-hari');

        return [
            'siapa' => (string) $request->query('siapa', 'semua'),
            'jenis' => (string) $request->query('jenis', 'semua'),
            'aksi' => (string) $request->query('aksi', 'semua'),
            'periode' => array_key_exists($period, self::PERIODS) ? $period : '30-hari',
        ];
    }

    /**
     * @param  array{siapa: string, jenis: string, aksi: string, periode: string}  $filters
     * @return Builder<Activity>
     */
    private function matching(array $filters): Builder
    {
        $days = self::PERIODS[$filters['periode']];

        return Activity::query()
            ->when($filters['siapa'] !== 'semua', fn (Builder $q) => $q->where('actor', $filters['siapa']))
            ->when($filters['jenis'] !== 'semua', fn (Builder $q) => $q->where('subject_type', $filters['jenis']))
            ->when($filters['aksi'] !== 'semua', fn (Builder $q) => $q->where('action', $filters['aksi']))
            ->when($days !== null, fn (Builder $q) => $q->where(
                'created_at',
                '>=',
                Carbon::today()->subDays($days),
            ));
    }

    /**
     * The page's entries, cut into days.
     *
     * @param  Collection<int, Activity>  $rows
     * @return array<int, array{key: string, label: string, count: int, entries: array<int, array<string, mixed>>}>
     */
    private function days(Collection $rows): array
    {
        return $rows
            ->groupBy(fn (Activity $entry) => $entry->day())
            ->map(fn (Collection $entries, string $day) => [
                'key' => $day,
                'label' => Activity::dayLabel($day),
                'count' => $entries->count(),
                'entries' => $entries->map(fn (Activity $entry) => $entry->toRow())->values()->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * The counts under the title, over the same stretch the list covers but
     * before the other three filters narrow it — a filtered total that moves
     * with its own filter tells you nothing about what you filtered out of.
     *
     * @param  array{siapa: string, jenis: string, aksi: string, periode: string}  $filters
     * @return array{total: int, created: int, updated: int, deleted: int, people: int}
     */
    private function summary(array $filters): array
    {
        $window = $this->matching([
            'siapa' => 'semua',
            'jenis' => 'semua',
            'aksi' => 'semua',
            'periode' => $filters['periode'],
        ]);

        $byAction = (clone $window)
            ->toBase()
            ->selectRaw('action, count(*) as total')
            ->groupBy('action')
            ->pluck('total', 'action');

        return [
            'total' => (int) $byAction->sum(),
            'created' => (int) ($byAction[Activity::CREATED] ?? 0),
            'updated' => (int) ($byAction[Activity::UPDATED] ?? 0),
            'deleted' => (int) ($byAction[Activity::DELETED] ?? 0),
            'people' => (int) (clone $window)->distinct()->count('actor'),
        ];
    }

    /**
     * The kinds of record in the log, each with how many entries it holds, so
     * the picker never offers a filter that empties the page.
     *
     * @return array<int, array{key: string, label: string, count: int}>
     */
    private function types(): array
    {
        $labels = [
            'lead' => 'Lead',
            'konten' => 'Konten',
            'ide' => 'Ide konten',
            'komentar' => 'Komentar',
            'catatan' => 'Catatan lead',
            'follow-up' => 'Follow-up',
            'tanggal-penting' => 'Tanggal penting',
            'anggota' => 'Anggota',
        ];

        $counts = Activity::query()
            ->toBase()
            ->selectRaw('subject_type, count(*) as total')
            ->groupBy('subject_type')
            ->pluck('total', 'subject_type');

        return collect($labels)
            ->map(fn (string $label, string $key) => [
                'key' => $key,
                'label' => $label,
                'count' => (int) ($counts[$key] ?? 0),
            ])
            ->filter(fn (array $type) => $type['count'] > 0)
            ->values()
            ->all();
    }
}
