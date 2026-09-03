<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The morning brief, split the way the page reads it.
 *
 * Two tables rather than one, on a single rule: the part somebody acts on
 * becomes a row, and the part they only read stays JSON on the brief. An idea
 * can be sent to the backlog and has to remember it was, so it is a row.
 * Topics and the older templates' extra sections are read and nothing more.
 *
 * `raw` keeps the markdown as written. The pipeline has already rewritten its
 * own template twice while running, so a better parser must be able to
 * re-derive from what is held rather than re-fetch what may be gone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('news_briefs', function (Blueprint $table) {
            $table->id();
            $table->dateTime('published_at')->index();
            /* One sheet row is one brief, and the text is what identifies it:
               the pipeline writes twice on some mornings, so the date cannot. */
            $table->char('fingerprint', 40)->unique();
            $table->json('topics');
            $table->json('extras');
            $table->longText('raw');
            $table->timestamps();
        });

        Schema::create('brief_ideas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('news_brief_id')->constrained()->cascadeOnDelete();
            /* The brief's own running order, which is the order it is read in. */
            $table->unsignedTinyInteger('position');
            $table->string('title', 512);
            $table->text('body')->nullable();
            /* A publisher's own address, not a Google News redirect — the
               brief carries the real link where the news log does not. */
            $table->text('url')->nullable();
            $table->char('fingerprint', 40)->unique();
            $table->foreignId('content_idea_id')->nullable()->nullOnDelete()
                ->constrained('content_ideas');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brief_ideas');
        Schema::dropIfExists('news_briefs');
    }
};
