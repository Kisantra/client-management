<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\ContentComment;
use App\Models\User;
use App\Notifications\ContentCommentAdded;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * Reviewer notes on a piece of content.
 *
 * Writing one costs a sentence. Checking one off is signed, and checking off
 * is reversible, because a fix that turns out not to fix reopens the note
 * rather than a new thread.
 */
class ContentCommentController extends Controller
{
    public function store(Request $request, Content $content)
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ], [
            'body.required' => 'Tulis dulu catatannya.',
            'body.max' => 'Catatan terlalu panjang; pecah jadi beberapa poin.',
        ]);

        $content->comments()->create([
            'author' => $request->user()->name,
            'body' => trim($validated['body']),
        ]);

        // Everyone but the writer hears the bell, live, through Reverb.
        Notification::send(
            User::where('id', '!=', $request->user()->id)->get(),
            new ContentCommentAdded(
                $request->user()->name,
                $content->id,
                $content->title,
                Str::limit(trim($validated['body']), 80),
            ),
        );

        $this->toast('Catatan tersimpan', 'Menunggu ditindaklanjuti di '.$content->title.'.');

        return back();
    }

    public function update(Request $request, Content $content, ContentComment $comment)
    {
        abort_unless($comment->content_id === $content->id, 404);

        $validated = $request->validate([
            'resolved' => ['required', 'boolean'],
        ]);

        $comment->update($validated['resolved'] ? [
            'resolved_at' => now(),
            'resolved_by' => $request->user()->name,
        ] : [
            'resolved_at' => null,
            'resolved_by' => null,
        ]);

        $this->toast(
            $validated['resolved'] ? 'Catatan ditandai selesai' : 'Catatan dibuka lagi',
            $validated['resolved'] ? null : 'Kembali masuk hitungan yang belum selesai.',
        );

        return back();
    }

    public function destroy(Content $content, ContentComment $comment)
    {
        abort_unless($comment->content_id === $content->id, 404);

        $comment->delete();

        $this->toast('Catatan dihapus');

        return back();
    }
}
