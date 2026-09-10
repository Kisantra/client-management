<?php

namespace App\Http\Controllers;

use App\Models\ContentIdea;
use App\Models\NewsItem;
use App\Support\NewsSheet;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The news the content is made from: regulations, announcements, issues.
 *
 * Read-only on this side: the feed is written by `news:sync` out of the team's
 * pipeline sheet. A story can be turned into an idea in one press, and the row
 * remembers that it was.
 *
 * The archive is two thousand stories deep and every one of them used to be
 * sent to the browser at once — one payload, one enormous list, and no way to
 * reach a story except by scrolling until it appeared. It is a page for
 * finding something, so it now has the three things finding needs: a search,
 * a way to narrow, and a page at a time.
 */
class NewsController extends Controller
{
    /** How many stories one page holds. About a day and a half of the feed. */
    private const PER_PAGE = 50;

    /** Sources offered by name; the long tail is reached by searching. */
    private const SOURCES_OFFERED = 14;

    public function index(Request $request): Response
    {
        $filters = $this->filters($request);

        $items = $this->matching($filters)
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->simplePaginate(self::PER_PAGE)
            ->withQueryString();

        $rows = collect($items->items());

        return Inertia::render('content-news', [
            'filters' => $filters,
            'days' => $this->days($rows),

            /*
             | Counted with every filter in force except the one they belong to,
             | so a category's figure says how many stories switching to it
             | would find. A facet counted through its own filter can only ever
             | read as the number already on screen.
             */
            'categories' => $this->categories($filters),
            'sources' => $this->sources($filters),

            'total' => $this->matching($filters)->count(),
            'unused' => (int) $this->matching([...$filters, 'ide' => 'semua'])
                ->whereNull('content_idea_id')
                ->count(),

            'page' => [
                'shown' => $rows->count(),
                'hasMore' => $items->hasMorePages(),
                'next' => $items->nextPageUrl(),
                'prev' => $items->previousPageUrl(),
            ],

            /* The page says out loud what it is not showing. A feed that
               quietly withholds most of its source is one nobody can trust. */
            'window' => [
                'days' => (int) config('services.news_sheet.days'),
                'minScore' => (int) config('services.news_sheet.min_score'),
                'since' => NewsSheet::make()->since()?->toDateString(),
            ],
        ]);
    }

    /**
     * @return array{q: string, kategori: string, sumber: string, ide: string}
     */
    private function filters(Request $request): array
    {
        $used = (string) $request->query('ide', 'semua');

        return [
            'q' => trim((string) $request->query('q', '')),
            'kategori' => (string) $request->query('kategori', 'semua'),
            'sumber' => (string) $request->query('sumber', 'semua'),
            'ide' => in_array($used, ['semua', 'belum', 'sudah'], true) ? $used : 'semua',
        ];
    }

    /**
     * @param  array{q: string, kategori: string, sumber: string, ide: string}  $filters
     * @param  'kategori'|'sumber'|null  $except  Left out so a facet can count past itself.
     * @return Builder<NewsItem>
     */
    private function matching(array $filters, ?string $except = null): Builder
    {
        return NewsItem::query()
            ->recent()
            ->when($filters['q'] !== '', function (Builder $query) use ($filters) {
                /* One box over the three fields a person actually remembers a
                   story by: what it said, what it was about, and who ran it —
                   which is also how the three hundred sources with a handful
                   of stories each stay reachable without a list of them. */
                $needle = '%'.$filters['q'].'%';

                $query->where(fn (Builder $any) => $any
                    ->where('title', 'like', $needle)
                    ->orWhere('summary', 'like', $needle)
                    ->orWhere('source', 'like', $needle));
            })
            ->when(
                $except !== 'kategori' && $filters['kategori'] !== 'semua',
                fn (Builder $query) => $query->where('category', $filters['kategori']),
            )
            ->when(
                $except !== 'sumber' && $filters['sumber'] !== 'semua',
                fn (Builder $query) => $query->where('source', $filters['sumber']),
            )
            ->when(
                $filters['ide'] === 'belum',
                fn (Builder $query) => $query->whereNull('content_idea_id'),
            )
            ->when(
                $filters['ide'] === 'sudah',
                fn (Builder $query) => $query->whereNotNull('content_idea_id'),
            );
    }

    /**
     * The page's stories, cut into the days they ran.
     *
     * @param  Collection<int, NewsItem>  $rows
     * @return array<int, array{key: string, count: int, items: array<int, array<string, mixed>>}>
     */
    private function days(Collection $rows): array
    {
        return $rows
            ->groupBy(fn (NewsItem $item) => $item->published_at->toDateString())
            ->map(fn (Collection $items, string $day) => [
                'key' => $day,
                'count' => $items->count(),
                'items' => $items->map(fn (NewsItem $item) => $item->toRow())->values()->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array{q: string, kategori: string, sumber: string, ide: string}  $filters
     * @return array<int, array{key: string, count: int}>
     */
    private function categories(array $filters): array
    {
        return $this->matching($filters, except: 'kategori')
            ->toBase()
            ->selectRaw('category, count(*) as total')
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->groupBy('category')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => ['key' => $row->category, 'count' => (int) $row->total])
            ->all();
    }

    /**
     * The sources worth naming in a picker.
     *
     * There are three hundred and eighty of them and a long tail that ran one
     * story each; a list of all of them is a list nobody reads. The ones with
     * volume are offered, and the rest are found by typing their name into the
     * search, which looks at the source field for exactly this reason.
     *
     * @param  array{q: string, kategori: string, sumber: string, ide: string}  $filters
     * @return array<int, array{key: string, count: int}>
     */
    private function sources(array $filters): array
    {
        $top = $this->matching($filters, except: 'sumber')
            ->toBase()
            ->selectRaw('source, count(*) as total')
            ->whereNotNull('source')
            ->where('source', '!=', '')
            ->groupBy('source')
            ->orderByDesc('total')
            ->orderBy('source')
            ->limit(self::SOURCES_OFFERED)
            ->get()
            ->map(fn ($row) => ['key' => $row->source, 'count' => (int) $row->total]);

        /* A source that is filtered for but too small to make the list would
           otherwise vanish from its own picker the moment it was chosen. */
        if ($filters['sumber'] !== 'semua' && ! $top->contains('key', $filters['sumber'])) {
            $top->push([
                'key' => $filters['sumber'],
                'count' => $this->matching($filters)->count(),
            ]);
        }

        return $top->values()->all();
    }

    /** One press: the story lands on the idea backlog, and remembers it did. */
    public function idea(Request $request, NewsItem $news)
    {
        if ($news->content_idea_id !== null) {
            $this->toast(
                'Sudah ada di daftar ide',
                'Berita ini pernah dijadikan ide sebelumnya.',
                'info',
            );

            return back();
        }

        DB::transaction(function () use ($request, $news) {
            $idea = ContentIdea::create([
                'title' => $news->title,
                'note' => $news->summary,
                'source_url' => $news->url,
                'author' => $request->user()->name,
            ]);

            $news->update(['content_idea_id' => $idea->id]);
        });

        $this->toast(
            'Masuk ke daftar ide',
            $news->title.' siap dijadwalkan dari Ide Konten.',
        );

        return back();
    }
}
