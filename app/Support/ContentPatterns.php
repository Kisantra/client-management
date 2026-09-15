<?php

namespace App\Support;

use App\Models\ContentLink;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * What kind of content earns more than usual, and what kind earns less.
 *
 * Every post is measured against its own account's typical post, so a group's
 * figure reads the same on both platforms: 2× is twice what that account's
 * ordinary post earns, whichever account it is. The group's figure is the
 * median of those, not the mean — one post that went far would otherwise make
 * a whole format look like a winner.
 *
 * Two kinds of category, from two places, and the difference is said out
 * loud rather than hidden. Format, length and posting day belong to the post
 * itself, so every scraped post counts. Pillar and content type belong to the
 * calendar piece, and a post only has one when somebody tied the two together
 * — so those groups are counted from the linked posts alone, and the page is
 * told how few that is.
 */
class ContentPatterns
{
    /** A group smaller than this is still shown, but not called a finding. */
    public const ENOUGH = 3;

    /*
     | The firm posts from Jakarta. Timestamps are stored in UTC, and a post
     | that went up at eight in the evening would otherwise be filed under the
     | next day.
     */
    private const LOCAL = 'Asia/Jakarta';

    private const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    /** Each bucket's upper bound in seconds, and its name. */
    private const LENGTHS = [
        [15, '< 15 detik'],
        [30, '15–30 detik'],
        [60, '30–60 detik'],
        [180, '1–3 menit'],
        [PHP_INT_MAX, '> 3 menit'],
    ];

    /**
     * @param  Collection<int, array{platform: string, post: Model, typical: float}>  $ledger
     */
    public function __construct(
        private readonly Collection $ledger,
        private readonly CarbonInterface $start,
        private readonly CarbonInterface $end,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $rows = $this->rows();
        $first = $rows->min(fn (array $row) => $row['post']->posted_at);

        return [
            'all' => $this->breakdown($rows),
            'period' => $this->breakdown($rows->filter(fn (array $row) => $row['inPeriod'])->values()),
            'enough' => self::ENOUGH,
            'since' => $first ? Dates::shortMonthName($first->month).' '.$first->year : null,
        ];
    }

    /** @return Collection<int, array<string, mixed>> */
    private function rows(): Collection
    {
        $urls = $this->ledger
            ->map(fn (array $row) => $row['post']->url)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $links = $urls === [] ? collect() : ContentLink::query()
            ->whereIn('url', $urls)
            ->with('content:id,type,pillar')
            ->get()
            ->keyBy('url');

        return $this->ledger
            /* A post whose account's typical post earned nothing has no
               yardstick, and cannot be said to have beaten it. */
            ->filter(fn (array $row) => $row['typical'] > 0)
            ->map(function (array $row) use ($links) {
                /** @var Model $post */
                $post = $row['post'];
                $piece = $post->url ? $links->get($post->url)?->content : null;
                $interactions = $post->interactions();

                return [
                    'platform' => $row['platform'],
                    'post' => $post,
                    'interactions' => $interactions,
                    'lift' => $interactions / $row['typical'],
                    'format' => $post->format(),
                    'seconds' => $post->seconds(),
                    'weekday' => $post->posted_at->copy()->setTimezone(self::LOCAL)->dayOfWeekIso,
                    'type' => $piece?->type,
                    'pillar' => $piece?->pillar,
                    'inPeriod' => $post->posted_at->between($this->start, $this->end),
                ];
            })
            ->values();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    private function breakdown(Collection $rows): array
    {
        $formats = SocialPlatform::for('instagram')->formats() + SocialPlatform::for('tiktok')->formats();
        $videos = $rows->filter(fn (array $row) => ($row['seconds'] ?? 0) > 0);

        return [
            'posts' => $rows->count(),
            'linked' => $rows->filter(fn (array $row) => $row['type'] !== null || $row['pillar'] !== null)->count(),
            'dimensions' => [
                $this->dimension(
                    key: 'format',
                    label: 'Format',
                    source: 'post',
                    rows: $rows,
                    group: fn (array $row) => $row['format'],
                    name: fn ($key) => $formats[$key] ?? Str::headline((string) $key),
                ),
                $this->dimension(
                    key: 'duration',
                    label: 'Durasi video',
                    source: 'post',
                    rows: $videos,
                    group: fn (array $row) => $this->length((int) $row['seconds']),
                    name: fn ($key) => self::LENGTHS[(int) $key][1],
                    ordered: true,
                ),
                $this->dimension(
                    key: 'type',
                    label: 'Jenis konten',
                    source: 'calendar',
                    rows: $rows->filter(fn (array $row) => $row['type'] !== null),
                    group: fn (array $row) => $row['type'],
                    name: fn ($key) => ContentPlan::typeLabel((string) $key),
                ),
                $this->dimension(
                    key: 'pillar',
                    label: 'Pillar',
                    source: 'calendar',
                    rows: $rows->filter(fn (array $row) => $row['pillar'] !== null),
                    group: fn (array $row) => $row['pillar'],
                    name: fn ($key) => (string) ContentPlan::pillarLabel((string) $key),
                ),
                $this->dimension(
                    key: 'weekday',
                    label: 'Hari tayang',
                    source: 'post',
                    rows: $rows,
                    group: fn (array $row) => $row['weekday'],
                    name: fn ($key) => self::WEEKDAYS[(int) $key - 1],
                    ordered: true,
                ),
            ],
        ];
    }

    /**
     * One way of slicing the posts, each slice with its median lift.
     *
     * Formats, types and pillars are ranked best first, because the question
     * there is which one. Lengths and weekdays keep their own order — a week
     * read Rabu, Senin, Sabtu is a week nobody can find their way around.
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    private function dimension(
        string $key,
        string $label,
        string $source,
        Collection $rows,
        callable $group,
        callable $name,
        bool $ordered = false,
    ): array {
        $groups = $rows
            ->groupBy($group)
            ->map(fn (Collection $members, $value) => [
                'key' => (string) $value,
                'label' => (string) $name($value),
                'posts' => $members->count(),
                'lift' => round(PerformanceReport::median($members->pluck('lift')), 2),
                'above' => $members->filter(fn (array $row) => $row['lift'] > 1)->count(),
                'interactions' => round(PerformanceReport::median($members->pluck('interactions')), 1),
                'platforms' => $members->countBy('platform')->all(),
                'best' => $this->example($members->sortByDesc('lift')->first()),
            ]);

        $groups = $ordered
            ? $groups->sortKeys()
            : $groups->sort(fn (array $a, array $b) => [$b['lift'], $b['posts']] <=> [$a['lift'], $a['posts']]);

        return [
            'key' => $key,
            'label' => $label,
            'source' => $source,
            'ordered' => $ordered,
            'posts' => $rows->count(),
            'groups' => $groups->values()->all(),
        ];
    }

    private function length(int $seconds): int
    {
        foreach (self::LENGTHS as $at => [$below]) {
            if ($seconds < $below) {
                return $at;
            }
        }

        return count(self::LENGTHS) - 1;
    }

    /**
     * The group's best post, so a category is never only a word.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function example(array $row): array
    {
        /** @var Model $post */
        $post = $row['post'];

        return [
            'platform' => $row['platform'],
            'caption' => Str::limit(
                trim((string) preg_replace('/\s+/u', ' ', (string) $post->caption)),
                140,
                '…',
            ) ?: null,
            'thumbnail' => $post->thumb(),
            'href' => route('performance.content', [
                'platform' => $row['platform'],
                'konten' => $post->key(),
            ], false),
            'format' => $post->format(),
            'postedAt' => $post->posted_at->toDateString(),
            'interactions' => $row['interactions'],
            'lift' => round($row['lift'], 2),
        ];
    }
}
