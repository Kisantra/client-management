<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Support\ContentPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Moving a piece of content along its flow: to review, back to draft, on to
 * approved, and finally live.
 *
 * Every move is recorded, so the calendar can later say how long review
 * takes and where pieces get held up. Going live also records when, and
 * where it can be seen.
 */
class ContentStatusController extends Controller
{
    public function store(Request $request, Content $content)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(ContentPlan::keys()), Rule::notIn([$content->status])],
            'published_at' => ['nullable', 'date'],
            'url' => ['nullable', 'url', 'max:255'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'status.not_in' => 'Konten ini sudah ada di status tersebut.',
            'url.url' => 'Tautan harus berupa alamat lengkap, diawali https://.',
        ]);

        $from = ContentPlan::label($content->status);
        $publishing = $validated['status'] === Content::PUBLISHED;
        $today = Carbon::today();

        DB::transaction(function () use ($content, $validated, $publishing, $today, $request) {
            $content->update([
                'status' => $validated['status'],
                'status_changed_at' => $today,
                'published_at' => $publishing
                    ? Carbon::parse($validated['published_at'] ?? $today)->toDateString()
                    : null,
                ...(isset($validated['url']) && $validated['url'] !== ''
                    ? ['url' => trim($validated['url'])]
                    : []),
            ]);

            $content->statusEvents()->create([
                'status' => $content->status,
                'author' => $request->user()->name,
                'note' => trim((string) ($validated['note'] ?? '')) ?: null,
                'at' => $today,
            ]);
        });

        $this->toast(
            $content->title.($publishing ? ' sudah tayang' : ': '.$from.' → '.ContentPlan::label($content->status)),
            $publishing
                ? 'Tercatat tayang '.$content->published_at->format('j/n/Y').'.'
                : 'Perpindahan tercatat di riwayat konten.',
        );

        return back();
    }
}
