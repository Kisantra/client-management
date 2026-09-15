<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\User;
use App\Notifications\ContentStatusChanged;
use App\Support\ContentPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
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
            /* One address per channel it went out on, asked for at the moment
               both are known. Only the channels sent are touched: going live
               on Instagram today says nothing about the TikTok link. */
            'links' => ['nullable', 'array:'.implode(',', ContentPlan::channelKeys())],
            'links.*' => ['nullable', 'url', 'max:255'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'status.not_in' => 'Konten ini sudah ada di status tersebut.',
            'links.array' => 'Ada channel yang tidak dikenal di daftar tautan.',
            'links.*.url' => 'Tautan harus berupa alamat lengkap, diawali https://.',
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
            ]);

            foreach ($validated['links'] ?? [] as $channel => $url) {
                if (trim((string) $url) !== '') {
                    $content->links()->updateOrCreate(['channel' => $channel], ['url' => trim($url)]);
                }
            }

            $content->statusEvents()->create([
                'status' => $content->status,
                'author' => $request->user()->name,
                'note' => trim((string) ($validated['note'] ?? '')) ?: null,
                'at' => $today,
            ]);
        });

        // Everyone but the mover hears it, live, through Reverb.
        Notification::send(
            User::where('id', '!=', $request->user()->id)->get(),
            new ContentStatusChanged(
                $request->user()->name,
                $content->id,
                $content->title,
                $from,
                ContentPlan::label($content->status),
            ),
        );

        $this->toast(
            $content->title.($publishing ? ' sudah tayang' : ': '.$from.' → '.ContentPlan::label($content->status)),
            $publishing
                ? 'Tercatat tayang '.$content->published_at->format('j/n/Y').'.'
                : 'Perpindahan tercatat di riwayat konten.',
        );

        return back();
    }
}
