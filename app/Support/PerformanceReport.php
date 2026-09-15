<?php

namespace App\Support;

use App\Models\Content;
use App\Models\ContentLink;
use App\Models\Lead;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The quantitative reading of what the accounts published, over a stretch of
 * months, on both platforms at once.
 *
 * The Performa pages answer "how is this account doing right now"; they hold
 * one platform, one period, and they are read on a screen. This answers a
 * different question — what did the last quarter amount to — and it is read on
 * paper, by somebody who was not watching the pages all along. That is why it
 * is a document rather than a view: sections in a fixed order, every figure
 * next to the one it should be compared against, and nothing that needs a
 * pointer hovered over it to mean anything.
 *
 * Every statistic here is computed the way the pages compute theirs, from the
 * same models and the same definitions. A report that quietly used the mean
 * where the page used the median would be a second set of books.
 *
 * Nothing in here is estimated, modelled or filled in. What the scrapers did
 * not collect is reported absent, and the closing section says so in words.
 */
final class PerformanceReport
{
    /** Spans the report offers, in months. */
    public const SPANS = [3, 6, 12];

    /** How many posts each platform's roll of honour names. */
    private const TOP = 5;

    /**
     * The posts a platform must have before a distribution is worth drawing.
     * Below this, a "typical" post is one of three, and saying so as a
     * statistic dresses up a number that is really just a list.
     */
    private const ENOUGH = 5;

    private function __construct(
        public readonly CarbonImmutable $from,
        public readonly CarbonImmutable $to,
        public readonly int $months,
    ) {}

    /**
     * The report ending in the given month, covering the given span.
     *
     * The default end is the last month either account actually published in,
     * not today: a report generated on the second of the month is otherwise a
     * report of two days, and it reads as a collapse rather than as a calendar.
     */
    public static function make(?string $ending = null, int $months = 3): self
    {
        $span = in_array($months, self::SPANS, true) ? $months : 3;

        $end = self::month($ending) ?? self::lastMonthWithPosts();

        return new self(
            $end->subMonths($span - 1)->startOfMonth(),
            $end->endOfMonth(),
            $span,
        );
    }

    /** "Juli–September 2026", or "Desember 2025–Februari 2026" across a year. */
    public function label(): string
    {
        $from = Dates::monthName($this->from->month);
        $to = Dates::monthName($this->to->month);

        return $this->from->year === $this->to->year
            ? ($this->from->month === $this->to->month
                ? $from.' '.$this->to->year
                : $from.'–'.$to.' '.$this->to->year)
            : $from.' '.$this->from->year.'–'.$to.' '.$this->to->year;
    }

    /** What the downloaded file is called. */
    public function slug(): string
    {
        return $this->from->format('Y-m').'_'.$this->to->format('Y-m');
    }

    /**
     * Everything the document states, in the order it states it.
     *
     * One array, built once: the printed page, the screen and the prompt sent
     * to the model all read from this, so none of them can hold a figure the
     * others do not.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $platforms = collect(SocialPlatform::KEYS)
            ->map(fn (string $key) => $this->platform(SocialPlatform::for($key)))
            ->all();

        return [
            'period' => [
                'label' => $this->label(),
                'from' => $this->from->toDateString(),
                'to' => $this->to->toDateString(),
                'months' => $this->months,
                'slug' => $this->slug(),
                'generatedAt' => Carbon::now()->format('j/n/Y, H.i'),
                /* The closing month is usually still running, and its figures
                   are a part-month read against three whole ones. Said out
                   loud here, because otherwise the last column of every chart
                   reads as a collapse rather than as a month in progress. */
                'open' => $this->isOpen(),
                'elapsed' => $this->elapsed(),
                'lastMonth' => Dates::monthName($this->to->month),
            ],
            'platforms' => $platforms,
            'combined' => $this->combined($platforms),
            'months' => $this->timeline($platforms),
            'business' => $this->business($platforms),
        ];
    }

    /**
     * One platform's whole account of itself.
     *
     * @return array<string, mixed>
     */
    private function platform(SocialPlatform $platform): array
    {
        $profile = $platform->profile();
        $posts = $profile ? $this->posts($platform, $profile) : collect();

        $base = [
            'key' => $platform->key(),
            'label' => $platform->label(),
            'handle' => $profile ? $platform->account($profile)['username'] : $platform->handle(),
            'measured' => $posts->count(),
            'enough' => $posts->count() >= self::ENOUGH,
            /* Anything published after this was never scraped, so it is not in
               a single figure below. A report that does not say when it stopped
               looking is a report you cannot date. */
            'syncedAt' => $profile?->fetched_at?->format('j/n/Y, H.i'),
        ];

        if ($posts->isEmpty()) {
            /* An account with nothing in the window is a fact about the window,
               not a hole in the report: it is stated and the section moves on. */
            return $base + [
                'followers' => $profile?->followers,
                'totals' => null,
                'typical' => null,
                'average' => null,
                'engagement' => null,
                'cadence' => null,
                'formats' => [],
                'top' => [],
                'concentration' => null,
                'outlier' => null,
                'months' => $this->platformMonths($posts),
            ];
        }

        $interactions = $posts->map(fn (Model $post) => $post->interactions());
        $typical = self::median($interactions);
        $average = $interactions->avg();
        $basis = $platform->rateBasis($profile, $posts);

        return $base + [
            'followers' => $profile->followers,
            'totals' => [
                'interactions' => (int) $interactions->sum(),
                'likes' => (int) $posts->sum('likes'),
                'comments' => (int) $posts->sum('comments'),
                'plays' => $this->sumOf($posts, 'plays'),
                'shares' => $this->sumOf($posts, 'shares'),
                'saves' => $this->sumOf($posts, 'saves'),
            ],
            /* The typical post, not the average one. One post can carry more
               interactions than the fifty around it put together, and a mean
               pulled that far describes nothing anybody published. The mean
               travels beside it because the gap is itself the finding. */
            'typical' => [
                'interactions' => round($typical, 1),
                'likes' => round(self::median($posts->pluck('likes')), 1),
                'comments' => round(self::median($posts->pluck('comments')), 1),
                'plays' => $this->medianOf($posts, 'plays'),
            ],
            'average' => [
                'interactions' => round($average, 1),
                /* How far the mean sits above the middle post, as a multiple.
                   One is an even spread; three means a handful carried it. */
                'skew' => $typical > 0 ? round($average / $typical, 2) : null,
            ],
            'engagement' => [
                'rate' => $basis['value'] > 0 ? round(($typical / $basis['value']) * 100, 2) : null,
                'basis' => $basis['noun'],
                'basisValue' => $basis['value'],
            ],
            'cadence' => $this->cadence($posts),
            'formats' => $this->formats($platform, $posts),
            'top' => $this->top($posts),
            'concentration' => $this->concentration($posts),
            'outlier' => $this->outlier($posts, $typical),
            'months' => $this->platformMonths($posts),
        ];
    }

    /**
     * The posts a platform published inside the window.
     *
     * @return Collection<int, Model>
     */
    private function posts(SocialPlatform $platform, Model $profile): Collection
    {
        return $profile->posts()
            ->whereBetween('posted_at', [$this->from->startOfDay(), $this->to->endOfDay()])
            ->orderByDesc('posted_at')
            ->get();
    }

    /**
     * How often the account published, and how evenly.
     *
     * A count of posts says nothing on its own — twenty posts is a busy month
     * or a quiet quarter. The rhythm is what a team can act on, and the widest
     * gap is what an audience actually notices.
     *
     * @param  Collection<int, Model>  $posts
     * @return array<string, mixed>
     */
    private function cadence(Collection $posts): array
    {
        $dates = $posts->map(fn (Model $post) => $post->posted_at->startOfDay())->sort()->values();
        $days = max(1, (int) round($this->from->diffInDays($this->to)) + 1);

        $gaps = $dates->count() > 1
            ? $dates->sliding(2)->map(
                fn (Collection $pair) => (int) round($pair->first()->diffInDays($pair->last())),
            )
            : collect();

        return [
            'perWeek' => round($posts->count() / ($days / 7), 1),
            'perMonth' => round($posts->count() / max(1, $this->months), 1),
            'days' => $days,
            'activeDays' => $dates->unique(fn (Carbon|CarbonImmutable $date) => $date->toDateString())->count(),
            /* The longest the account went quiet, in days. */
            'longestGap' => $gaps->isEmpty() ? null : (int) $gaps->max(),
            'medianGap' => $gaps->isEmpty() ? null : round(self::median($gaps), 1),
        ];
    }

    /**
     * What each shape of post was worth, and how much of the output it was.
     *
     * The count travels with the figure, because a median over two posts is
     * not the same claim as a median over twelve.
     *
     * @param  Collection<int, Model>  $posts
     * @return array<int, array<string, mixed>>
     */
    private function formats(SocialPlatform $platform, Collection $posts): array
    {
        $labels = $platform->formats();

        return collect(array_keys($labels))
            ->map(function (string $format) use ($labels, $posts) {
                $group = $posts->filter(fn (Model $post) => $post->format() === $format);

                return [
                    'key' => $format,
                    'label' => $labels[$format],
                    'count' => $group->count(),
                    'share' => $posts->isEmpty() ? 0 : round(($group->count() / $posts->count()) * 100),
                    'typical' => $group->isEmpty()
                        ? 0
                        : round(self::median($group->map(fn (Model $post) => $post->interactions())), 1),
                    'plays' => $this->medianOf($group, 'plays'),
                    'total' => (int) $group->sum(fn (Model $post) => $post->interactions()),
                ];
            })
            ->filter(fn (array $row) => $row['count'] > 0)
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    /**
     * The posts that earned the most, named.
     *
     * @param  Collection<int, Model>  $posts
     * @return array<int, array<string, mixed>>
     */
    private function top(Collection $posts): array
    {
        return $posts
            ->sortByDesc(fn (Model $post) => $post->interactions())
            ->take(self::TOP)
            ->values()
            ->map(fn (Model $post, int $at) => [
                'rank' => $at + 1,
                'key' => $post->key(),
                'url' => $post->url,
                'caption' => self::plain($post->caption),
                'format' => $post->format(),
                'postedAt' => $post->posted_at->format('j/n/Y'),
                'likes' => (int) $post->likes,
                'comments' => (int) $post->comments,
                'plays' => $post->plays(),
                'shares' => $post->shares(),
                'saves' => $post->saves(),
                'interactions' => $post->interactions(),
            ])
            ->all();
    }

    /**
     * How much of everything earned came from the few at the top.
     *
     * A high number is not a failure — it is how these platforms work — but it
     * decides what to do next: repeat the few, or lift the floor.
     *
     * @param  Collection<int, Model>  $posts
     * @return array<string, mixed>|null
     */
    private function concentration(Collection $posts): ?array
    {
        $total = $posts->sum(fn (Model $post) => $post->interactions());

        if ($posts->count() < self::ENOUGH || $total <= 0) {
            return null;
        }

        $sorted = $posts->sortByDesc(fn (Model $post) => $post->interactions())->values();
        $topFive = $sorted->take(self::TOP)->sum(fn (Model $post) => $post->interactions());
        $topFifth = $sorted->take((int) max(1, ceil($posts->count() / 5)))
            ->sum(fn (Model $post) => $post->interactions());

        return [
            'topFiveShare' => (int) round(($topFive / $total) * 100),
            'topFifthShare' => (int) round(($topFifth / $total) * 100),
            'posts' => $posts->count(),
        ];
    }

    /**
     * The one post bending every figure, if there is one.
     *
     * Named rather than hidden: a chart with a single spike is confusing until
     * you know what the spike was, and then it is the most useful thing on it.
     *
     * @param  Collection<int, Model>  $posts
     * @return array<string, mixed>|null
     */
    private function outlier(Collection $posts, float $typical): ?array
    {
        if ($posts->count() < self::ENOUGH || $typical <= 0) {
            return null;
        }

        $total = $posts->sum(fn (Model $post) => $post->interactions());
        $best = $posts->sortByDesc(fn (Model $post) => $post->interactions())->first();
        $share = $total > 0 ? $best->interactions() / $total : 0;

        /* Four times the typical post and a fifth of everything earned. */
        if ($best->interactions() < $typical * 4 || $share < 0.2) {
            return null;
        }

        return [
            'key' => $best->key(),
            'format' => $best->format(),
            'postedAt' => $best->posted_at->format('j/n/Y'),
            'interactions' => $best->interactions(),
            'times' => round($best->interactions() / $typical, 1),
            'share' => (int) round($share * 100),
        ];
    }

    /**
     * Month by month, for one platform.
     *
     * Every month in the window appears, including the empty ones. A chart
     * that silently drops a quiet month draws a straight line through a gap
     * and calls it steady.
     *
     * @param  Collection<int, Model>  $posts
     * @return array<int, array<string, mixed>>
     */
    private function platformMonths(Collection $posts): array
    {
        $byMonth = $posts->groupBy(fn (Model $post) => $post->posted_at->format('Y-m'));

        $out = [];

        for ($at = $this->from; $at->lessThanOrEqualTo($this->to); $at = $at->addMonth()) {
            $key = $at->format('Y-m');
            $group = $byMonth->get($key, collect());

            $out[] = [
                'key' => $key,
                'label' => Dates::shortMonthName($at->month),
                'year' => $at->year,
                'posts' => $group->count(),
                'interactions' => (int) $group->sum(fn (Model $post) => $post->interactions()),
                'typical' => $group->isEmpty()
                    ? 0
                    : round(self::median($group->map(fn (Model $post) => $post->interactions())), 1),
                'plays' => $this->sumOf($group, 'plays'),
                'partial' => $this->isPartial($at),
            ];
        }

        return $out;
    }

    /**
     * The two platforms' months side by side, for the trend chart.
     *
     * @param  array<int, array<string, mixed>>  $platforms
     * @return array<int, array<string, mixed>>
     */
    private function timeline(array $platforms): array
    {
        $out = [];

        for ($at = $this->from; $at->lessThanOrEqualTo($this->to); $at = $at->addMonth()) {
            $key = $at->format('Y-m');
            $row = [
                'key' => $key,
                'label' => Dates::shortMonthName($at->month),
                'year' => $at->year,
                'posts' => 0,
                'interactions' => 0,
                'partial' => $this->isPartial($at),
                'by' => [],
            ];

            foreach ($platforms as $platform) {
                $month = collect($platform['months'])->firstWhere('key', $key);

                $row['by'][$platform['key']] = [
                    'label' => $platform['label'],
                    'posts' => $month['posts'] ?? 0,
                    'interactions' => $month['interactions'] ?? 0,
                ];
                $row['posts'] += $month['posts'] ?? 0;
                $row['interactions'] += $month['interactions'] ?? 0;
            }

            $out[] = $row;
        }

        return $out;
    }

    /**
     * Both accounts added up, where adding them up is honest.
     *
     * Posts, likes, comments and interactions mean the same thing on either
     * platform and are summed. Engagement rate is not: the two are divided by
     * different denominators, so a combined rate would be a number with no
     * definition. It is left to the per-platform sections.
     *
     * @param  array<int, array<string, mixed>>  $platforms
     * @return array<string, mixed>
     */
    private function combined(array $platforms): array
    {
        $live = collect($platforms)->filter(fn (array $row) => $row['measured'] > 0);

        return [
            'posts' => (int) $live->sum('measured'),
            'interactions' => (int) $live->sum(fn (array $row) => $row['totals']['interactions']),
            'likes' => (int) $live->sum(fn (array $row) => $row['totals']['likes']),
            'comments' => (int) $live->sum(fn (array $row) => $row['totals']['comments']),
            'plays' => (int) $live->sum(fn (array $row) => $row['totals']['plays'] ?? 0),
            'followers' => (int) $live->sum(fn (array $row) => $row['followers'] ?? 0),
            'platforms' => $live->count(),
        ];
    }

    /**
     * What the publishing was for, in the same window.
     *
     * The accounts are a means, not the point: the firm publishes to bring
     * clients in. These figures come from the calendar and the pipeline, and
     * they are stated beside the reach so the report cannot end up celebrating
     * a quarter that produced nothing.
     *
     * @param  array<int, array<string, mixed>>  $platforms
     * @return array<string, mixed>
     */
    private function business(array $platforms): array
    {
        $from = $this->from->toDateString();
        $to = $this->to->toDateString();

        $published = Content::query()
            ->where('status', Content::PUBLISHED)
            ->whereBetween('published_at', [$from, $to])
            ->count();

        $planned = Content::query()
            ->whereBetween('scheduled_for', [$from, $to])
            ->count();

        $leads = Lead::query()->whereBetween('entered_at', [$from, $to])->get();

        /* Which of the measured posts the calendar knows about. A post nobody
           linked back is not a failure of the post; it is a gap in the record,
           and it is the reason the lead figures below cannot be attributed. */
        $urls = collect($platforms)
            ->flatMap(fn (array $row) => collect($row['top'])->pluck('url'))
            ->filter()
            ->all();

        $linked = $urls === [] ? 0 : ContentLink::query()->whereIn('url', $urls)->count();

        return [
            'plannedContent' => $planned,
            'publishedContent' => $published,
            /* How much of the plan actually went out. The pair on its own
               invites the reader to do this division badly in their head. */
            'publishedShare' => $planned > 0 ? (int) round(($published / $planned) * 100) : null,
            'leads' => $leads->count(),
            'clients' => $leads->where('stage', 'client')->count(),
            /* Leads per piece that went out. A simple average, and it is only
               a coincidence rate: nothing here proves one produced the other. */
            'leadsPerPost' => $published > 0 ? round($leads->count() / $published, 1) : null,
            'leadsFromContent' => $leads->whereNotNull('content_id')->count(),
            'topLinked' => $linked,
            'topTotal' => count($urls),
        ];
    }

    /**
     * A caption a printed page can actually set.
     *
     * The report is typeset in Manrope, which carries Latin and nothing else,
     * and a caption full of emoji arrives on paper as a row of black boxes —
     * worse than the caption missing, because it reads as a rendering fault.
     * They are dropped rather than substituted: a printed report is not where
     * anybody was going to read the emoji back.
     */
    private static function plain(?string $caption): ?string
    {
        if ($caption === null) {
            return null;
        }

        $stripped = preg_replace(
            [
                // Pictographs, symbols and flags. The stragglers below U+2190
                // are named one by one so the dashes and curly quotes in the
                // same block survive — those Manrope does carry, and a caption
                // is worse off without them.
                '/[\x{1F000}-\x{1FAFF}\x{2190}-\x{2BFF}\x{2600}-\x{27BF}]/u',
                '/[\x{00A9}\x{00AE}\x{203C}\x{2049}\x{2122}\x{2139}]/u',
                // Variation selectors, joiners, keycaps, private use.
                '/[\x{FE00}-\x{FE0F}\x{200D}\x{20E3}\x{E000}-\x{F8FF}]/u',
                '/\s+/u',
            ],
            ['', '', '', ' '],
            $caption,
        );

        return trim((string) $stripped) ?: null;
    }

    /**
     * The middle value, which is what "typical" means on a set this skewed.
     *
     * Public because the Performa page reads its figures the same way, and one
     * of the two having its own idea of the middle is how a report and the
     * screen it came from end up disagreeing.
     *
     * @param  Collection<int, int|float|null>  $values
     */
    public static function median(Collection $values): float
    {
        $sorted = $values->filter(fn ($value) => $value !== null)->sort()->values();

        if ($sorted->isEmpty()) {
            return 0.0;
        }

        $middle = intdiv($sorted->count(), 2);

        return $sorted->count() % 2 === 1
            ? (float) $sorted[$middle]
            : ((float) $sorted[$middle - 1] + (float) $sorted[$middle]) / 2;
    }

    /**
     * A figure only some platforms carry, summed where it exists.
     *
     * @param  Collection<int, Model>  $posts
     */
    private function sumOf(Collection $posts, string $method): ?int
    {
        $values = $posts->map(fn (Model $post) => $post->{$method}())->filter(fn ($value) => $value !== null);

        return $values->isEmpty() ? null : (int) $values->sum();
    }

    /** @param  Collection<int, Model>  $posts */
    private function medianOf(Collection $posts, string $method): ?int
    {
        $values = $posts->map(fn (Model $post) => $post->{$method}())->filter(fn ($value) => $value !== null);

        return $values->isEmpty() ? null : (int) round(self::median($values));
    }

    /** True while the closing month of the window has not finished. */
    private function isOpen(): bool
    {
        return $this->to->isFuture();
    }

    /** Whether the given month is the one still being lived through. */
    private function isPartial(CarbonImmutable $month): bool
    {
        return $month->isSameMonth(CarbonImmutable::now()) && $this->isOpen();
    }

    /**
     * How far into the closing month the report was taken, in days.
     *
     * @return array{days: int, of: int}|null
     */
    private function elapsed(): ?array
    {
        if (! $this->isOpen()) {
            return null;
        }

        $now = CarbonImmutable::now();

        return ['days' => $now->day, 'of' => $now->daysInMonth];
    }

    /** The last month either account published in, or this one if neither has. */
    private static function lastMonthWithPosts(): CarbonImmutable
    {
        $latest = collect(SocialPlatform::KEYS)
            ->map(fn (string $key) => SocialPlatform::for($key))
            ->map(fn (SocialPlatform $platform) => $platform->profile()?->posts()->max('posted_at'))
            ->filter()
            ->map(fn (string $date) => CarbonImmutable::parse($date))
            ->max();

        return ($latest ?? CarbonImmutable::now())->startOfMonth();
    }

    private static function month(?string $value): ?CarbonImmutable
    {
        if (! $value || preg_match('/^\d{4}-\d{2}$/', $value) !== 1) {
            return null;
        }

        return CarbonImmutable::createFromFormat('Y-m-d', $value.'-01')->startOfMonth();
    }
}
