<?php

namespace App\Support;

use App\Models\Content;
use App\Models\ContentLink;
use App\Models\Lead;
use App\Models\LeadStageEvent;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * One period's work, counted once and read the same way by every surface.
 *
 * The page and the CSV are the same report in two shapes, so the counting
 * lives here rather than in either of them. A figure that is worked out twice
 * is a figure that will eventually disagree with itself, and a report whose
 * printout and spreadsheet say different numbers is worse than no report.
 *
 * Every figure is compared with the same stretch immediately before it — last
 * month against this month, last week against this week. A count on its own
 * says what happened; a count beside the one before it says whether that is
 * normal, which is the only question anybody opens a report to ask.
 */
class Report
{
    public const MONTHLY = 'bulan';

    public const WEEKLY = 'minggu';

    private const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    private const SHORT_MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];

    private function __construct(
        public readonly string $kind,
        public readonly Carbon $start,
        public readonly Carbon $end,
    ) {}

    /** The period covering `$on`, monthly or weekly. */
    public static function make(string $kind, ?string $on = null): self
    {
        $kind = $kind === self::WEEKLY ? self::WEEKLY : self::MONTHLY;

        $anchor = $on !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $on) === 1
            ? Carbon::parse($on)
            : Carbon::today();

        return $kind === self::WEEKLY
            ? new self($kind, $anchor->copy()->startOfWeek(), $anchor->copy()->endOfWeek())
            : new self($kind, $anchor->copy()->startOfMonth(), $anchor->copy()->endOfMonth());
    }

    /** The same length of time, immediately before this one. */
    public function previous(): self
    {
        return $this->kind === self::WEEKLY
            ? self::make($this->kind, $this->start->copy()->subWeek()->toDateString())
            : self::make($this->kind, $this->start->copy()->subMonth()->toDateString());
    }

    /** The step in either direction, for the page's own navigation. */
    public function shifted(int $by): self
    {
        $anchor = $this->kind === self::WEEKLY
            ? $this->start->copy()->addWeeks($by)
            : $this->start->copy()->addMonthsNoOverflow($by);

        return self::make($this->kind, $anchor->toDateString());
    }

    /** "September 2026", or "7–13 September 2026". */
    public function label(): string
    {
        if ($this->kind === self::MONTHLY) {
            return self::MONTHS[$this->start->month - 1].' '.$this->start->year;
        }

        $sameMonth = $this->start->month === $this->end->month;

        return $this->start->day
            .($sameMonth ? '' : ' '.self::MONTHS[$this->start->month - 1])
            .'–'.$this->end->day.' '.self::MONTHS[$this->end->month - 1].' '.$this->end->year;
    }

    /** A filename stem nobody has to rename: kisantra-laporan-2026-09. */
    public function slug(): string
    {
        return $this->kind === self::MONTHLY
            ? $this->start->format('Y-m')
            : $this->start->format('Y-m-d').'-sd-'.$this->end->format('Y-m-d');
    }

    /** Whether the period has finished, so the page can say a figure is partial. */
    public function isOpen(): bool
    {
        return $this->end->isFuture();
    }

    /**
     * The four figures the report opens with, each beside the one before it.
     *
     * @return array<int, array{key: string, label: string, value: int, was: int, note: string}>
     */
    public function summary(): array
    {
        $before = $this->previous();

        /*
         | The same figure over the six periods ending in this one, oldest
         | first, for the small chart beside it. One comparison says whether
         | this period moved; six say whether that movement is news or the
         | ordinary wobble of a small team's calendar.
         */
        $recent = collect(range(-5, 0))->map(fn (int $by) => $this->shifted($by));
        $series = fn (callable $count) => $recent->map(fn (self $period) => $count($period))->all();

        return [
            [
                'key' => 'leads',
                'label' => 'Lead masuk',
                'value' => $this->leadsIn($this),
                'was' => $this->leadsIn($before),
                'note' => 'lead baru tercatat',
                'series' => $series(fn (self $period) => $this->leadsIn($period)),
            ],
            [
                'key' => 'clients',
                'label' => 'Jadi client',
                'value' => $this->becameClient($this),
                'was' => $this->becameClient($before),
                'note' => 'lead yang naik ke client pada periode ini',
                'series' => $series(fn (self $period) => $this->becameClient($period)),
            ],
            [
                'key' => 'published',
                'label' => 'Konten tayang',
                'value' => $this->published($this),
                'was' => $this->published($before),
                'note' => 'dari jadwal periode ini',
                'series' => $series(fn (self $period) => $this->published($period)),
            ],
            [
                'key' => 'late',
                'label' => 'Konten telat',
                'value' => $this->late($this),
                'was' => $this->late($before),
                'note' => 'lewat tanggal, belum tayang',
                'series' => $series(fn (self $period) => $this->late($period)),
            ],
        ];
    }

    /**
     * Content by channel: what was planned, what went out, what slipped.
     *
     * A piece on two channels counts on both. It was made once but it ran
     * twice, and a channel table that hides that cannot be read as a channel
     * table.
     *
     * @return array<int, array{key: string, label: string, planned: int, published: int, late: int}>
     */
    public function byChannel(): array
    {
        $rows = [];

        foreach ($this->contentInPeriod() as $piece) {
            foreach (($piece->channels ?: ['—']) as $channel) {
                $rows[$channel] ??= ['planned' => 0, 'published' => 0, 'late' => 0];
                $rows[$channel]['planned']++;
                $rows[$channel]['published'] += $piece->isPublished() ? 1 : 0;
                $rows[$channel]['late'] += $piece->isLate() ? 1 : 0;
            }
        }

        return collect($rows)
            ->map(fn (array $row, string $key) => [
                'key' => $key,
                'label' => ContentPlan::channelLabel($key),
                ...$row,
            ])
            ->sortByDesc('planned')
            ->values()
            ->all();
    }

    /**
     * The same, by the person who owns the piece.
     *
     * @return array<int, array{name: string, planned: int, published: int, late: int}>
     */
    public function byOwner(): array
    {
        $rows = [];

        foreach ($this->contentInPeriod() as $piece) {
            $name = trim((string) $piece->owner) ?: 'Belum ada PJ';
            $rows[$name] ??= ['planned' => 0, 'published' => 0, 'late' => 0];
            $rows[$name]['planned']++;
            $rows[$name]['published'] += $piece->isPublished() ? 1 : 0;
            $rows[$name]['late'] += $piece->isLate() ? 1 : 0;
        }

        return collect($rows)
            ->map(fn (array $row, string $name) => ['name' => $name, ...$row])
            ->sortByDesc('planned')
            ->values()
            ->all();
    }

    /**
     * Where the period's leads came from, and what they were worth.
     *
     * @return array<int, array{key: string, label: string, leads: int, value: int, clients: int}>
     */
    public function leadSources(): array
    {
        return $this->leadsQuery($this)
            ->get(['channel', 'value', 'stage', 'status'])
            ->groupBy(fn (Lead $lead) => (string) $lead->channel)
            ->map(fn (Collection $group, string $channel) => [
                'key' => $channel,
                'label' => Pipeline::channels()[$channel] ?? ContentPlan::channelLabel($channel),
                'leads' => $group->count(),
                'value' => (int) $group->sum('value'),
                /* Of the leads that came in during the period, how many are
                   client today. Not "converted within the period": a lead from
                   the first week can close in the third, and pretending
                   otherwise would undercount the month's own work. */
                'clients' => $group
                    ->filter(fn (Lead $lead) => $lead->stage === 'client' && $lead->status === Lead::ACTIVE)
                    ->count(),
            ])
            ->sortByDesc('leads')
            ->values()
            ->all();
    }

    /**
     * The period's posts on the accounts Performa follows, best first.
     *
     * Ranked by how far each post rose above what its own account usually
     * earns, not by the raw count. The two platforms keep different books —
     * TikTok adds shares and saves to the likes and comments that are all an
     * Instagram scrape can see, and it shows a clip to strangers rather than
     * to followers — so a raw ranking would put TikTok on top by arithmetic
     * alone. Against its own account's median every post is judged by the one
     * standard that is fair to it, and inside a single platform the order is
     * exactly the order of the raw count.
     *
     * Every post in the period is sent, not a top few: the page filters by
     * platform, and a top six cut before the filter would leave the TikTok tab
     * showing whichever clips happened to survive an Instagram-heavy list.
     *
     * @return array{
     *     posts: array<int, array<string, mixed>>,
     *     platforms: array<int, array{key: string, label: string, posts: int, typical: float}>
     * }
     */
    public function topContent(): array
    {
        ['rows' => $ledger, 'platforms' => $accounts] = $this->ledger();

        $found = $ledger
            ->filter(fn (array $row) => $row['post']->posted_at->between($this->start, $this->end))
            ->values();

        $platforms = collect($accounts)
            ->map(fn (array $account) => [
                'key' => $account['key'],
                'label' => $account['label'],
                'posts' => $found->where('platform', $account['key'])->count(),
                'typical' => $account['typical'],
            ])
            ->all();

        /* The calendar piece behind a post, when somebody tied one to it, and
           the leads that piece brought in — the bridge from "it did well" to
           "it did well for the business". */
        $links = ContentLink::query()
            ->whereIn('url', $found->map(fn (array $row) => $row['post']->url)->filter()->all())
            ->with('content:id,title')
            ->get()
            ->keyBy('url');

        $leads = $links->isEmpty() ? collect() : Lead::query()
            ->whereIn('content_id', $links->pluck('content_id')->unique())
            ->selectRaw('content_id, count(*) as total')
            ->groupBy('content_id')
            ->pluck('total', 'content_id');

        $posts = $found
            ->map(function (array $row) use ($links, $leads) {
                /** @var Model $post */
                $post = $row['post'];
                $link = $post->url ? $links->get($post->url) : null;
                $interactions = $post->interactions();

                return [
                    'id' => $row['platform'].':'.$post->key(),
                    'platform' => $row['platform'],
                    'url' => $post->url,
                    'href' => route('performance.content', [
                        'platform' => $row['platform'],
                        'konten' => $post->key(),
                    ], false),
                    'caption' => Str::limit(
                        trim((string) preg_replace('/\s+/u', ' ', (string) $post->caption)),
                        220,
                        '…',
                    ) ?: null,
                    'thumbnail' => $post->thumb(),
                    'format' => $post->format(),
                    'postedAt' => $post->posted_at->toDateString(),
                    'likes' => (int) $post->likes,
                    'comments' => (int) $post->comments,
                    'plays' => $post->plays(),
                    'shares' => $post->shares(),
                    'saves' => $post->saves(),
                    'interactions' => $interactions,
                    'typical' => round($row['typical'], 1),
                    /* Null rather than infinite when the account's typical
                       post earned nothing: "∞× biasanya" is not a finding. */
                    'lift' => $row['typical'] > 0 ? round($interactions / $row['typical'], 2) : null,
                    'content' => $link?->content ? [
                        'title' => (string) $link->content->title,
                        'leads' => (int) ($leads[$link->content_id] ?? 0),
                    ] : null,
                ];
            })
            ->sort(fn (array $a, array $b) => [$b['lift'] ?? 0, $b['interactions']] <=> [$a['lift'] ?? 0, $a['interactions']])
            ->values()
            ->all();

        return ['posts' => $posts, 'platforms' => $platforms];
    }

    /**
     * Which kinds of content have earned more than usual, over everything on
     * record and over this period alone.
     *
     * @return array<string, mixed>
     */
    public function patterns(): array
    {
        ['rows' => $ledger, 'platforms' => $accounts] = $this->ledger();

        return [
            ...(new ContentPatterns($ledger, $this->start, $this->end))->toArray(),
            'baseline' => $accounts,
        ];
    }

    /**
     * Every stored post on the accounts Performa follows, each with its own
     * account's typical post beside it. Read once per report: the top posts
     * and the patterns both start here.
     *
     * @return array{
     *     rows: Collection<int, array{platform: string, post: Model, typical: float}>,
     *     platforms: array<int, array{key: string, label: string, typical: float, posts: int}>
     * }
     */
    private function ledger(): array
    {
        return once(function () {
            $rows = collect();
            $platforms = [];

            foreach (SocialPlatform::KEYS as $key) {
                $platform = SocialPlatform::for($key);
                $profile = $platform->profile();

                if (! $profile) {
                    continue;
                }

                /* "Usually" is everything on record for the account, not just
                   this period: a month's own median would call half of any
                   month above average by definition. */
                $all = $profile->posts()->get();
                $typical = PerformanceReport::median($all->map(fn (Model $post) => $post->interactions()));

                $platforms[] = [
                    'key' => $key,
                    'label' => $platform->label(),
                    'typical' => round($typical, 1),
                    'posts' => $all->count(),
                ];

                foreach ($all as $post) {
                    $rows->push(['platform' => $key, 'post' => $post, 'typical' => $typical]);
                }
            }

            return ['rows' => $rows, 'platforms' => $platforms];
        });
    }

    /**
     * Every piece scheduled in the period, as spreadsheet rows.
     *
     * @return array<int, array<string, string>>
     */
    public function contentRows(): array
    {
        return $this->contentInPeriod()
            ->map(fn (Content $piece) => [
                'Tanggal tayang' => $piece->scheduled_for->toDateString(),
                'Judul' => (string) $piece->title,
                'Channel' => implode(', ', $piece->channels ?: []),
                'Status' => ContentPlan::label($piece->status),
                'PJ' => (string) $piece->owner,
                'Terlambat' => $piece->isLate() ? 'ya' : 'tidak',
                'Tayang pada' => $piece->published_at?->toDateString() ?? '',
                'Tautan' => implode(' ', $piece->linkMap()),
            ])
            ->all();
    }

    /**
     * Every lead that came in during the period, as spreadsheet rows.
     *
     * @return array<int, array<string, string>>
     */
    public function leadRows(): array
    {
        return $this->leadsQuery($this)
            ->orderBy('entered_at')
            ->orderBy('id')
            ->get()
            ->map(fn (Lead $lead) => [
                'Tanggal masuk' => $lead->entered_at->toDateString(),
                'Client' => trim($lead->entity.' '.$lead->company),
                'PIC' => (string) $lead->pic,
                'Channel' => ContentPlan::channelLabel((string) $lead->channel),
                'Asal' => (string) $lead->source,
                'Layanan' => (string) $lead->service,
                'Estimasi' => (string) $lead->value,
                'Tahap' => Pipeline::label($lead->stage),
                'Status' => $lead->status === Lead::ACTIVE ? 'aktif' : 'tidak lanjut',
                'PJ' => (string) $lead->owner,
            ])
            ->all();
    }

    /** @return array{kind: string, label: string, start: string, end: string, slug: string, open: bool} */
    public function toArray(): array
    {
        return [
            'kind' => $this->kind,
            'label' => $this->label(),
            'start' => $this->start->toDateString(),
            'end' => $this->end->toDateString(),
            'slug' => $this->slug(),
            'open' => $this->isOpen(),
        ];
    }

    /** A short date for a heading: 9 Sep 2026. */
    public static function shortDate(CarbonInterface $at): string
    {
        return $at->day.' '.self::SHORT_MONTHS[$at->month - 1].' '.$at->year;
    }

    /** @return Collection<int, Content> */
    private function contentInPeriod(): Collection
    {
        return once(fn () => Content::query()
            ->with('links')
            ->whereBetween('scheduled_for', [$this->start, $this->end])
            ->orderBy('scheduled_for')
            ->orderBy('id')
            ->get());
    }

    /** @return Builder<Lead> */
    private function leadsQuery(self $period)
    {
        return Lead::query()->whereBetween('entered_at', [$period->start, $period->end]);
    }

    private function leadsIn(self $period): int
    {
        return $this->leadsQuery($period)->count();
    }

    private function published(self $period): int
    {
        return Content::query()
            ->whereBetween('scheduled_for', [$period->start, $period->end])
            ->where('status', Content::PUBLISHED)
            ->count();
    }

    private function late(self $period): int
    {
        return Content::query()
            ->whereBetween('scheduled_for', [$period->start, $period->end])
            ->where('status', '!=', Content::PUBLISHED)
            ->whereDate('scheduled_for', '<', Carbon::today())
            ->count();
    }

    /**
     * Leads that reached client during the period.
     *
     * Read from the stage history rather than from the lead's stage today: a
     * client won in July is not this month's work, and the lead row alone
     * cannot tell you when it happened.
     */
    private function becameClient(self $period): int
    {
        return LeadStageEvent::query()
            ->where('stage', 'client')
            ->whereBetween('entered_at', [$period->start, $period->end])
            ->distinct()
            ->count('lead_id');
    }
}
