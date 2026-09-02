<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The per-channel format each old row carried, mapped onto the flat list
     * of shapes. A piece keeps meaning what it meant; only the vocabulary the
     * team writes it in has changed.
     */
    private const TYPE = [
        'feed' => 'single_photo',
        'carousel' => 'carousel',
        'reels' => 'short_video',
        'story' => 'story',
        'video' => 'videos',
        'post' => 'single_photo',
        'artikel' => 'artikel',
        'dokumen' => 'carousel',
        'halaman' => 'artikel',
        'update' => 'artikel',
    ];

    public function up(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            /*
             | One piece, several channels: the same cut posted to Instagram,
             | Facebook and TikTok is one piece of work. Held as a list rather
             | than a pivot because nothing joins on it — every screen reads
             | the whole set, and a piece carries at most a handful.
             */
            $table->json('channels')->nullable()->after('title');
            $table->string('pillar')->nullable()->after('channels');
            $table->string('type')->nullable()->after('pillar');

            /** Where the material came from — a regulation, an article. */
            $table->string('reference_url')->nullable()->after('brief');
            /** The copy itself, as it will be posted. Not the brief for it. */
            $table->longText('caption')->nullable()->after('reference_url');
        });

        foreach (DB::table('contents')->select('id', 'channel', 'format')->get() as $row) {
            DB::table('contents')->where('id', $row->id)->update([
                'channels' => json_encode([$row->channel]),
                'type' => self::TYPE[$row->format] ?? 'single_photo',
            ]);
        }

        /*
         | Both indexes on `channel` have to go before the column does: MySQL
         | drops them with it, SQLite refuses the column while either stands.
         */
        Schema::table('contents', function (Blueprint $table) {
            $table->dropIndex(['channel', 'scheduled_for']);
            $table->dropIndex(['channel']);
        });

        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn(['channel', 'format']);
        });

        Schema::table('contents', function (Blueprint $table) {
            $table->string('type')->default('single_photo')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->string('channel')->nullable()->index()->after('title');
            $table->string('format')->nullable()->after('channel');
        });

        foreach (DB::table('contents')->select('id', 'channels')->get() as $row) {
            $channels = json_decode((string) $row->channels, true) ?: ['instagram'];

            DB::table('contents')->where('id', $row->id)->update([
                'channel' => $channels[0],
                'format' => 'feed',
            ]);
        }

        Schema::table('contents', function (Blueprint $table) {
            $table->index(['channel', 'scheduled_for']);
            $table->dropColumn(['channels', 'pillar', 'type', 'reference_url', 'caption']);
        });
    }
};
