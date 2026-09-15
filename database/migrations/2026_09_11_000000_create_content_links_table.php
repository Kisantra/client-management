<?php

use App\Support\ContentPlan;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A piece's live addresses, one per channel.
 *
 * `contents.channels` has been a set since the calendar was built — the same
 * cut posted to Instagram and TikTok is one piece of work, not two — but the
 * address it went live at was a single column. A piece on both platforms could
 * record only one of its two links, and the second was simply lost, along with
 * the figures Performa could have read from it.
 *
 * One row per channel per piece, so the two sides of the record finally agree.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')->constrained()->cascadeOnDelete();
            $table->string('channel');
            $table->string('url');
            $table->timestamps();

            /* One address per channel: a piece cannot be at two places on
               Instagram, and a second row for the same channel would make
               "the Instagram link" a question with two answers. */
            $table->unique(['content_id', 'channel']);
            /* Performa looks a scraped post up by address to see which piece
               it belongs to, and the picker marks the ones already spoken for. */
            $table->index('url');
        });

        $this->carryOver();

        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn('url');
        });
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->string('url')->nullable()->after('caption');
        });

        /* Back to one address per piece, which is all the column can hold. The
           first link by channel order wins; anything else it carried is gone,
           which is exactly the limitation this table was created to remove. */
        foreach (DB::table('content_links')->orderBy('id')->get() as $link) {
            DB::table('contents')
                ->where('id', $link->content_id)
                ->whereNull('url')
                ->update(['url' => $link->url]);
        }

        Schema::dropIfExists('content_links');
    }

    /**
     * Every address already recorded, moved across and given a channel.
     *
     * The channel is read from the address's own host, which is right for
     * everything the team publishes to. A link that matches none of them falls
     * back to the piece's first channel — a guess, but the only one available,
     * and better than dropping a link that somebody took the trouble to record.
     */
    private function carryOver(): void
    {
        $rows = DB::table('contents')
            ->whereNotNull('url')
            ->where('url', '!=', '')
            ->get(['id', 'url', 'channels']);

        $now = now();

        foreach ($rows as $row) {
            $channels = json_decode((string) $row->channels, true) ?: [];

            DB::table('content_links')->insertOrIgnore([
                'content_id' => $row->id,
                'channel' => ContentPlan::channelForUrl($row->url, $channels),
                'url' => trim($row->url),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
};
