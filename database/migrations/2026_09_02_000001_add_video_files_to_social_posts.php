<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Room for the video file itself, beside the link that delivers it.
 *
 * Both platforms hand out signed URLs that expire within days, so a post whose
 * only video is a link is a post that will not play next month. Keeping the
 * file makes the archive an archive.
 *
 * Nothing is fetched during a scrape. Sixty videos is half a gigabyte and ten
 * minutes of wall time, and the refresh already runs inside the request the
 * team is waiting on; the file arrives when somebody asks to watch it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('instagram_posts', function (Blueprint $table) {
            $table->string('video_path')->nullable()->after('video_url');
        });

        Schema::table('tiktok_posts', function (Blueprint $table) {
            /** Where the file can still be fetched from, while the link lasts. */
            $table->text('video_url')->nullable()->after('cover_path');
            $table->string('video_path')->nullable()->after('video_url');
        });
    }

    public function down(): void
    {
        Schema::table('instagram_posts', function (Blueprint $table) {
            $table->dropColumn('video_path');
        });

        Schema::table('tiktok_posts', function (Blueprint $table) {
            $table->dropColumn(['video_url', 'video_path']);
        });
    }
};
