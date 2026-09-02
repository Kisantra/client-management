<?php

namespace App\Http\Controllers;

use App\Support\Period;
use App\Support\SocialPlatform;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/**
 * How the firm's own Instagram account is actually doing.
 *
 * Everything here is read from what the last refresh wrote down, never from a
 * live call: the page must open instantly and say the same thing twice, and the
 * scrapers behind it are paid per run. The figures are deliberately framed as
 * "the last N posts" rather than "this month", because that is the window the
 * data actually covers.
 */
class PerformanceController extends Controller
{
    /** Posts shown in the leaderboard; the panel links to all of them. */
    private const TOP = 4;

    /** Rows per page in the content list. */
    private const PER_PAGE = 20;

    /**
     * The windows both Performa pages offer.
     *
     * All of them look backwards: nothing here has not happened yet. "Semua"
     * is the default because it is the honest one — the store reaches back
     * only as far as the last scrape did, and a shorter window chosen for you
     * would quietly hide the rest of what is on record.
     */
    private const PERIODS = ['30hari', '90hari', '6bulan', 'tahun', 'semua', 'khusus'];

    public function __invoke(Request $request): Response
    {
        $platform = $this->platform($request);
        $period = $this->period($request);

        $profile = $platform->profile();

        $posts = $profile
            ? $profile->posts()
                ->when(
                    ! $period->isOpen(),
                    fn (Builder $query) => $query->whereBetween('posted_at', $period->bounds()),
                )
                ->orderByDesc('posted_at')
                ->get()
            : collect();

        return Inertia::render('performance', [
            'connected' => $platform->configured(),
            'platform' => $platform->key(),
            'platforms' => SocialPlatform::all(),
            'period' => $period->toArray(),
            /*
             | What the window asked for against what the store actually holds.
             | A page scoped to a year while the last scrape reached back two
             | months would otherwise report a year it never saw.
             */
            'coverage' => $profile ? $this->coverage($profile, $posts) : null,
            'account' => $profile ? $platform->account($profile) : null,
            'summary' => $profile ? $this->summary($platform, $profile, $posts) : null,
            'followerTrend' => $profile ? $this->followerTrend($profile, $period) : [],
            'timeline' => $this->timeline($posts),
            'top' => $this->top($posts),
            'formats' => $this->formats($platform, $posts),
            'handle' => $platform->handle(),
        ]);
    }

    /**
     * Every post the account has been scraped for, as a working list.
     *
     * The statistics page answers "how is the account doing"; this one answers
     * "what exactly did we publish, and how did each one land" — so it is a
     * table with filters and paging, not a wall of cards.
     */
    public function content(Request $request): Response
    {
        $platform = $this->platform($request);
        $profile = $platform->profile();
        $filters = $this->contentFilters($request, $platform);
        $period = $this->period($request);

        if (! $profile) {
            return Inertia::render('performance-content', [
                'connected' => $platform->configured(),
                'platform' => $platform->key(),
                'platforms' => SocialPlatform::all(),
                'handle' => $platform->handle(),
                'account' => null,
                'period' => $period->toArray(),
                'filters' => $filters,
                'formatCounts' => [],
                'rows' => [],
                'totals' => null,
                'selected' => null,
            ]);
        }

        $matching = $this->matchingPosts($profile, $filters, $period);

        /* Format chips count under the search, but never under each other. */
        $counts = (clone $matching)
            ->get()
            ->groupBy(fn (Model $post) => $post->format())
            ->map->count();

        $scoped = $filters['format'] === 'semua'
            ? (clone $matching)
            : (clone $matching)->where(
                fn (Builder $query) => $platform->whereFormat($query, $filters['format']),
            );

        $page = $this->sortedPosts($scoped, $filters['urut'], $platform)
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return Inertia::render('performance-content', [
            'connected' => $platform->configured(),
            'platform' => $platform->key(),
            'platforms' => SocialPlatform::all(),
            'formatLabels' => $platform->formats(),
            'handle' => $profile->username,
            'account' => $platform->account($profile),
            'period' => $period->toArray(),
            'filters' => $filters,
            'formatCounts' => ['semua' => (clone $matching)->count(), ...$counts->all()],
            'totals' => [
                'stored' => $profile->posts()->count(),
                'onAccount' => $platform->account($profile)['postsOnAccount'],
                'matched' => $page->total(),
                'from' => $page->firstItem() ?? 0,
                'to' => $page->lastItem() ?? 0,
                'current' => $page->currentPage(),
                'last' => $page->lastPage(),
            ],
            'rows' => collect($page->items())
                ->map(fn (Model $post) => [
                    ...$this->card($post),
                    'rate' => $post->engagementRate($profile->followers),
                    'slides' => $post->slideCount(),
                    'hashtags' => array_slice($post->hashtags ?? [], 0, 3),
                ])
                ->all(),
            'selected' => $this->selected($platform, $profile, $request),
        ]);
    }

    /**
     * The one post whose panel the URL asks for, with everything on record.
     *
     * This is where "we stored it" has to be visible: caption in full, every
     * hashtag and mention, the track a Reel used, the frame it was shot in.
     */
    private function selected(SocialPlatform $platform, Model $profile, Request $request): ?array
    {
        $code = (string) $request->query('konten', '');

        if ($code === '') {
            return null;
        }

        $post = $profile->posts()
            ->where($platform->key() === 'tiktok' ? 'post_id' : 'short_code', $code)
            ->first();

        if (! $post) {
            return null;
        }

        /*
         | A rate on its own says nothing — 0,03% is only legible against what
         | this account usually earns. The median of every stored post is the
         | comparison, for the same reason the statistics page uses it.
         */
        $typical = $this->median(
            $profile->posts->map(fn (Model $item) => $item->interactions()),
        );

        return [
            ...$this->card($post),
            'platform' => $platform->key(),
            /* Our own copy, and the link one could still be made from. */
            'video' => $post->videoUrl(),
            'videoAvailable' => $post->videoSource() !== null,
            'caption' => $post->caption,
            'rate' => $post->engagementRate($profile->followers),
            'typicalRate' => $post->rateBasis($profile->followers) > 0
                ? round(($typical / $post->rateBasis($profile->followers)) * 100, 3)
                : 0,
            'rateBasis' => $post->rateBasis($profile->followers),
            'rateNoun' => $post->rateNoun(),
            'duration' => $post->seconds(),
            ...$platform->extras($post),
            'width' => $post->width,
            'height' => $post->height,
            'aspect' => $post->aspect(),
            'hashtags' => $post->hashtags ?? [],
            'mentions' => $post->mentions ?? [],
            'location' => $post->location_name,
            'music' => $post->track(),
            'fetchedAt' => $post->fetched_at?->toIso8601String(),
        ];
    }

    /** Which account both pages are looking at, as the URL asks for it. */
    private function platform(Request $request): SocialPlatform
    {
        $key = (string) $request->query('platform', 'instagram');

        return SocialPlatform::for(
            in_array($key, SocialPlatform::KEYS, true) ? $key : 'instagram',
        );
    }

    /** The window either page is scoped to, as its URL asks for it. */
    private function period(Request $request): Period
    {
        return Period::from(
            (string) $request->query('periode', 'semua'),
            $request->query('dari'),
            $request->query('sampai'),
            self::PERIODS,
            'semua',
        );
    }

    /**
     * How much of the asked-for window the store can actually answer for.
     *
     * @param  Collection<int, Model>  $posts
     * @return array<string, mixed>
     */
    private function coverage(Model $profile, Collection $posts): array
    {
        $earliest = $profile->posts()->min('posted_at');

        return [
            'posts' => $posts->count(),
            'stored' => $profile->posts()->count(),
            'from' => $posts->min('posted_at')?->toDateString(),
            'to' => $posts->max('posted_at')?->toDateString(),
            /* The oldest post on record at all: the floor of every window. */
            'earliest' => $earliest ? Carbon::parse($earliest)->toDateString() : null,
        ];
    }

    /** @return array<string, string> */
    private function contentFilters(Request $request, SocialPlatform $platform): array
    {
        $formats = ['semua', ...array_keys($platform->formats())];
        $sorts = ['terbaru', 'terlama', 'interaksi', 'pemutaran', 'suka'];

        $format = (string) $request->query('format', 'semua');
        $urut = (string) $request->query('urut', 'terbaru');

        return [
            'q' => trim((string) $request->query('q', '')),
            'format' => in_array($format, $formats, true) ? $format : 'semua',
            'urut' => in_array($urut, $sorts, true) ? $urut : 'terbaru',
        ];
    }

    private function matchingPosts(Model $profile, array $filters, Period $period): Builder
    {
        return $profile->posts()
            ->getQuery()
            ->when(
                ! $period->isOpen(),
                fn (Builder $query) => $query->whereBetween('posted_at', $period->bounds()),
            )
            ->when($filters['q'], function (Builder $query, string $needle) {
                $like = '%'.$needle.'%';

                /* Caption, hashtags and place are the only text a post carries. */
                $query->where(fn (Builder $group) => $group
                    ->where('caption', 'like', $like)
                    ->orWhere('hashtags', 'like', $like)
                    ->orWhere('location_name', 'like', $like));
            });
    }

    /** Format is a reading of two columns, so it is a clause, not a value. */
    private function sortedPosts(Builder $query, string $sort, SocialPlatform $platform): Builder
    {
        /*
         | The relation orders by date, and an order added after that one only
         | ever breaks ties inside it — so every sort but the two by date was
         | silently a no-op. Clear it first, then say what the list is ordered
         | by.
         */
        $query->reorder();

        return match ($sort) {
            'terlama' => $query->orderBy('posted_at'),
            'interaksi' => $query->orderByRaw($platform->interactionsSql().' desc'),
            'pemutaran' => $query->orderByRaw('coalesce('.$platform->playsColumn().', 0) desc'),
            'suka' => $query->orderByDesc('likes'),
            default => $query->orderByDesc('posted_at'),
        };
    }

    public function refresh(Request $request)
    {
        $platform = $this->platform($request);

        /*
         | Half a minute to two minutes of scraping, depending on the account.
         | It runs in the request because the team asks for it by hand and then
         | waits for it; if this ever moves onto a schedule it belongs in a
         | queued job instead.
         */
        @set_time_limit(300);

        try {
            $result = $platform->refresh();
        } catch (RuntimeException $e) {
            $this->toast('Gagal memperbarui data', $e->getMessage(), 'error');

            return back();
        }

        $this->toast(
            'Data '.$platform->label().' diperbarui',
            $result['posts'].' konten terakhir dan '
                .number_format($result['followers'], 0, ',', '.').' pengikut tercatat.',
        );

        return back();
    }

    /**
     * The four figures the page opens with.
     *
     * Engagement rate is the one that matters most here and the one a follower
     * count alone hides, so it is measured against the audience it was earned
     * from rather than reported as a bare average.
     */
    private function summary(SocialPlatform $platform, Model $profile, Collection $posts): array
    {
        /*
         | Growth is read between two readings, not between a reading and the
         | profile row: the two agree right after a refresh and there is no
         | reason to make the figure depend on that staying true.
         */
        $snapshots = $profile->snapshots;
        $latest = $snapshots->last();
        $previous = $snapshots->count() > 1 ? $snapshots[$snapshots->count() - 2] : null;

        $interactions = $posts->map(fn (Model $post) => $post->interactions());

        /*
         | The typical post, not the average one. One giveaway can carry more
         | interactions than the fifty posts around it put together, and a mean
         | pulled that far describes nothing the team actually published. The
         | mean still travels beside it, because the gap between the two is
         | itself the finding.
         */
        $typical = $this->median($interactions);
        $average = $posts->isEmpty() ? 0 : $interactions->avg();

        $basis = $platform->rateBasis($profile, $posts);

        return [
            'followers' => [
                'value' => $profile->followers,
                'follows' => $platform->account($profile)['follows'],
                'delta' => $previous ? $latest->followers - $previous->followers : null,
                'since' => $previous?->captured_on->toDateString(),
            ],
            'posts' => [
                'total' => $platform->account($profile)['postsOnAccount'],
                'measured' => $posts->count(),
                'span' => $posts->isEmpty() ? null : [
                    'from' => $posts->last()->posted_at->toDateString(),
                    'to' => $posts->first()->posted_at->toDateString(),
                ],
            ],
            'interactions' => [
                'typical' => round($typical, 1),
                'average' => round($average, 1),
                'likes' => round($this->median($posts->pluck('likes')), 1),
                'comments' => round($this->median($posts->pluck('comments')), 1),
                'best' => (int) ($interactions->max() ?? 0),
            ],
            'engagement' => [
                /* Interactions per post against the audience that could have
                   given them — followers on Instagram, plays on TikTok. */
                'rate' => $basis['value'] > 0
                    ? round(($typical / $basis['value']) * 100, 3)
                    : 0,
                'mean' => $basis['value'] > 0
                    ? round(($average / $basis['value']) * 100, 3)
                    : 0,
                'measured' => $posts->count(),
                'basis' => $basis['noun'],
            ],
            'outlier' => $this->outlier($posts, $typical),
            /* The one figure this platform has that the three above do not
               cover: Instagram's Reel plays, TikTok's saves. */
            'highlight' => $platform->highlight($posts),
        ];
    }

    /**
     * The middle value, which is what "typical" means on a skewed set.
     *
     * @param  Collection<int, int|float|null>  $values
     */
    private function median(Collection $values): float
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
     * The one post that is bending every average, if there is one.
     *
     * Named rather than hidden: a chart with a single spike is confusing until
     * you know what the spike was, and then it is the most useful thing on it.
     */
    private function outlier(Collection $posts, float $typical): ?array
    {
        if ($posts->count() < 5 || $typical <= 0) {
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
            'shortCode' => $best->key(),
            'format' => $best->format(),
            'postedAt' => $best->posted_at->toDateString(),
            'likes' => $best->likes,
            'comments' => $best->comments,
            'interactions' => $best->interactions(),
            'share' => round($share * 100),
        ];
    }

    /** @return array<int, array{date: string, followers: int}> */
    private function followerTrend(Model $profile, Period $period): array
    {
        return $profile->snapshots
            /* The line covers the same stretch as the figures beside it. */
            ->when(
                ! $period->isOpen(),
                fn (Collection $snapshots) => $snapshots->filter(
                    fn ($snapshot) => $snapshot->captured_on->betweenIncluded(...$period->bounds()),
                ),
            )
            ->map(fn ($snapshot) => [
                'date' => $snapshot->captured_on->toDateString(),
                'followers' => $snapshot->followers,
            ])
            ->values()
            ->all();
    }

    /**
     * Every measured post, oldest first, as the chart reads them.
     */
    private function timeline(Collection $posts): array
    {
        return $posts
            ->sortBy('posted_at')
            ->map(fn (Model $post) => [
                'shortCode' => $post->key(),
                'date' => $post->posted_at->toDateString(),
                'format' => $post->format(),
                'interactions' => $post->interactions(),
                'likes' => $post->likes,
                'comments' => $post->comments,
            ])
            ->values()
            ->all();
    }

    private function top(Collection $posts): array
    {
        return $posts
            ->sortByDesc(fn (Model $post) => $post->interactions())
            ->take(self::TOP)
            ->map(fn (Model $post) => $this->card($post))
            ->values()
            ->all();
    }

    private function card(Model $post): array
    {
        return [
            'shortCode' => $post->key(),
            'caption' => $post->caption ? mb_substr(trim($post->caption), 0, 160) : null,
            'url' => $post->url,
            'thumbnail' => $post->thumb(),
            'format' => $post->format(),
            'likes' => $post->likes,
            'comments' => $post->comments,
            'views' => $post->views(),
            'plays' => $post->plays(),
            'shares' => $post->shares(),
            'saves' => $post->saves(),
            'interactions' => $post->interactions(),
            'postedAt' => $post->posted_at->toDateString(),
            'pinned' => $post->is_pinned,
        ];
    }

    /**
     * What each kind of post is worth.
     *
     * The count travels with the average because an average over two posts is
     * not the same claim as an average over twelve.
     */
    private function formats(SocialPlatform $platform, Collection $posts): array
    {
        return collect(array_keys($platform->formats()))
            ->map(function (string $format) use ($posts) {
                $group = $posts->filter(
                    fn (Model $post) => $post->format() === $format,
                );

                return [
                    'format' => $format,
                    'count' => $group->count(),
                    /* Median here too, for the same reason as the tiles. */
                    'typical' => round($this->median(
                        $group->map(fn (Model $post) => $post->interactions()),
                    ), 1),
                    /* Only the shapes that carry plays report one. */
                    'views' => $group->isNotEmpty() && $group->first()->plays() !== null
                        ? (int) round($this->median($group->map(fn (Model $post) => $post->plays())))
                        : null,
                ];
            })
            ->filter(fn (array $row) => $row['count'] > 0)
            ->values()
            ->all();
    }
}
