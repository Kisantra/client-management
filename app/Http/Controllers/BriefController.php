<?php

namespace App\Http\Controllers;

use App\Models\BriefIdea;
use App\Models\ContentIdea;
use App\Models\NewsBrief;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The morning brief: what the day is about, and what can be made from it.
 *
 * Read-only on this side — `news:sync` writes it out of the team's pipeline
 * sheet. The one thing a person does here is take an idea, which lands on the
 * content backlog and is remembered on the row, so nobody sends the same one
 * twice before the ten o'clock meeting.
 */
class BriefController extends Controller
{
    public function index(?NewsBrief $brief = null): Response
    {
        $brief = $brief?->exists
            ? $brief->load('ideas')
            : NewsBrief::with('ideas')->latest('published_at')->latest('id')->first();

        return Inertia::render('content-brief', [
            'brief' => $brief?->toRow(),
            /*
             | The whole archive, not a page of it: 87 briefs is a list the
             | rail can hold, and a brief you cannot reach is a brief that may
             | as well not have been written. Each row carries the day's
             | leading topic, because a column of dates is unscannable.
             */
            'archive' => NewsBrief::query()
                ->withCount('ideas')
                ->orderByDesc('published_at')
                ->orderByDesc('id')
                ->get()
                ->map(fn (NewsBrief $row) => [
                    'id' => $row->id,
                    'publishedAt' => $row->published_at->toDateTimeString(),
                    'lead' => $row->topics[0]['title'] ?? null,
                    'ideas' => $row->ideas_count,
                ])
                ->all(),
        ]);
    }

    /** One press: the idea lands on the backlog, and the row remembers it. */
    public function idea(Request $request, BriefIdea $briefIdea)
    {
        if ($briefIdea->content_idea_id !== null) {
            $this->toast(
                'Sudah ada di daftar ide',
                'Ide ini pernah diambil dari brief sebelumnya.',
                'info',
            );

            return back();
        }

        DB::transaction(function () use ($request, $briefIdea) {
            $idea = ContentIdea::create([
                'title' => $briefIdea->title,
                'note' => $briefIdea->body,
                'source_url' => $briefIdea->url,
                'author' => $request->user()->name,
            ]);

            $briefIdea->update(['content_idea_id' => $idea->id]);
        });

        $this->toast(
            'Masuk ke daftar ide',
            $briefIdea->title.' siap dijadwalkan dari Ide Konten.',
        );

        return back();
    }
}
