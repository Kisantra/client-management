<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the real feed needs that the sample rows did not.
 *
 * Measured against the sheet rather than guessed at. Every link in it is a
 * Google News redirect rather than the publisher's own address, and 77% of
 * them run past 255 characters — median 286, longest 777. Left as it was,
 * this table would have refused three rows in four.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('news_items', function (Blueprint $table) {
            $table->text('url')->nullable()->change();
            $table->string('title', 512)->change();

            /* Close to thirty stories land on an ordinary day, so the date on
               its own cannot put them in order. */
            $table->dateTime('published_at')->change();

            /* The pipeline's own taxonomy: Kebijakan, Regulasi,
               DJP/Operasional, Ekonomi Makro, Lainnya. */
            $table->string('category', 48)->nullable()->after('source');

            /* Kept even though the feed only admits 9 and 10 — without it
               there is no way to see what the threshold let through. */
            $table->unsignedTinyInteger('score')->nullable()->after('category');

            /* The same story comes back the next day under a fresh redirect,
               so the link cannot say what is the same story twice. A
               normalised title can. */
            $table->char('fingerprint', 40)->nullable()->unique()->after('score');
        });
    }

    public function down(): void
    {
        Schema::table('news_items', function (Blueprint $table) {
            $table->dropUnique(['fingerprint']);
            $table->dropColumn(['category', 'score', 'fingerprint']);
        });

        Schema::table('news_items', function (Blueprint $table) {
            $table->date('published_at')->change();
            $table->string('title')->change();
            $table->string('url')->nullable()->change();
        });
    }
};
