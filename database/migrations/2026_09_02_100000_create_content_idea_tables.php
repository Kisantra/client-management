<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_ideas', function (Blueprint $table) {
            $table->id();
            $table->string('title');

            // A suggestion, not a commitment: the real set is picked on scheduling.
            $table->string('channel')->nullable();
            $table->text('note')->nullable();

            // Where the idea came from: an article, a regulation, a comment.
            $table->string('source_url')->nullable();
            $table->string('author')->nullable();

            /*
             | Set once the idea becomes a piece on the calendar. The idea is
             | kept, not deleted: "what did we plan and did it happen" is a
             | question this table exists to answer.
             */
            $table->foreignId('content_id')
                ->nullable()
                ->constrained('contents')
                ->nullOnDelete();

            $table->timestamps();
        });

        Schema::create('news_items', function (Blueprint $table) {
            $table->id();
            $table->string('title');

            // A category, not an outlet: Regulasi, Media, Komunitas, Internal.
            $table->string('source');
            $table->string('url')->nullable();
            $table->text('summary')->nullable();
            $table->date('published_at')->index();

            // Set once someone turns the story into an idea.
            $table->foreignId('content_idea_id')
                ->nullable()
                ->constrained('content_ideas')
                ->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('news_items');
        Schema::dropIfExists('content_ideas');
    }
};
