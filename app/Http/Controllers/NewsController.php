<?php

namespace App\Http\Controllers;

use App\Models\ContentIdea;
use App\Models\NewsItem;
use App\Support\NewsSheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The news the content is made from: regulations, announcements, issues.
 *
 * Read-only on this side: the feed is written by `news:sync` out of the team's
 * pipeline sheet. A story can be turned into an idea in one press, and the row
 * remembers that it was.
 */
class NewsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('content-news', [
            'items' => NewsItem::query()
                ->recent()
                ->orderByDesc('published_at')
                ->orderByDesc('id')
                ->get()
                ->map(fn (NewsItem $item) => $item->toRow())
                ->all(),
            /* The page says out loud what it is not showing. A feed that
               quietly withholds most of its source is one nobody can trust. */
            'window' => [
                'days' => (int) config('services.news_sheet.days'),
                'minScore' => (int) config('services.news_sheet.min_score'),
                'since' => NewsSheet::make()->since()?->toDateString(),
            ],
        ]);
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
