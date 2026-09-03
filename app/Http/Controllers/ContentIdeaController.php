<?php

namespace App\Http\Controllers;

use App\Models\ContentIdea;
use App\Support\ContentPlan;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The idea backlog: everything the team might make, before it has a date.
 *
 * Writing one down costs a title; everything else is optional, because an
 * idea that has to be filled in like a form is an idea that never gets
 * written down. Scheduling happens through the calendar's own form, which
 * links the piece back here so the idea reads as done rather than lost.
 */
class ContentIdeaController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('content-ideas', [
            // The waiting ones first, newest on top; then what already became a piece.
            'ideas' => ContentIdea::query()
                ->with('content')
                ->orderByRaw('(content_id is null) desc')
                ->latest('id')
                ->get()
                ->map(fn (ContentIdea $idea) => $idea->toRow())
                ->all(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:140'],
            'channel' => ['nullable', Rule::in(ContentPlan::channelKeys())],
            'note' => ['nullable', 'string', 'max:1000'],
            'source_url' => ['nullable', 'url', 'max:255'],
        ], [
            'title.required' => 'Tulis dulu idenya, satu kalimat cukup.',
            'channel.in' => 'Channel itu tidak dikenal.',
            'source_url.url' => 'Sumber harus berupa alamat lengkap, diawali https://.',
        ]);

        ContentIdea::create([
            ...$validated,
            'author' => $request->user()->name,
        ]);

        $this->toast(
            'Ide tersimpan',
            'Jadwalkan kapan saja dari daftar ide.',
        );

        return back();
    }

    public function destroy(ContentIdea $idea)
    {
        $title = $idea->title;

        $idea->delete();

        $this->toast($title.' dihapus', 'Ide bisa ditulis lagi kapan saja.');

        return back();
    }
}
