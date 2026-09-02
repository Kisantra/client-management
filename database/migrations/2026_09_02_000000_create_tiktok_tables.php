<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TikTok gets its own tables rather than a `platform` column on Instagram's.
 *
 * The two accounts are measured in different currencies: Instagram counts
 * plays and views and carousel slides, TikTok counts shares, saves and the
 * track a video used. Folding them into one table would mean a row where half
 * the columns are structurally null and a reader who cannot tell which half.
 * They meet where it matters — the screens read one shape, assembled at the
 * point the controller answers, not at the point the scraper writes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tiktok_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique();
            $table->string('tiktok_id')->nullable();
            /** The display name; `username` is the @handle. */
            $table->string('nickname')->nullable();
            $table->text('signature')->nullable();
            $table->string('bio_link')->nullable();
            $table->string('profile_url')->nullable();

            $table->unsignedBigInteger('followers')->default(0);
            $table->unsignedBigInteger('following')->default(0);
            /** Likes the account has received across everything it posted. */
            $table->unsignedBigInteger('hearts')->default(0);
            $table->unsignedBigInteger('videos_count')->default(0);

            /*
             | TikTok's own image URLs are signed and expire within days, so the
             | picture is copied to this app's storage. What is on screen has to
             | keep working after the link that delivered it has gone.
             */
            $table->string('avatar_path')->nullable();

            $table->boolean('verified')->default(false);
            $table->boolean('private')->default(false);
            $table->timestamp('fetched_at')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();
        });

        Schema::create('tiktok_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tiktok_profile_id')->constrained()->cascadeOnDelete();

            /*
             | One row per account per day. TikTok tells you what a number is
             | now and never what it was, so growth only exists if this app
             | writes it down as it goes.
             */
            $table->date('captured_on');
            $table->unsignedBigInteger('followers')->default(0);
            $table->unsignedBigInteger('following')->default(0);
            $table->unsignedBigInteger('hearts')->default(0);
            $table->unsignedBigInteger('videos_count')->default(0);
            $table->timestamps();

            $table->unique(['tiktok_profile_id', 'captured_on']);
        });

        Schema::create('tiktok_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tiktok_profile_id')->constrained()->cascadeOnDelete();

            $table->string('post_id')->unique();
            $table->text('caption')->nullable();
            $table->string('text_language')->nullable();
            $table->string('url');
            $table->string('cover_path')->nullable();

            /*
             | TikTok's four counts. Shares and saves have no Instagram
             | equivalent and are the reason this table is its own: on TikTok a
             | save is the strongest signal a piece of tax advice can earn.
             */
            $table->unsignedBigInteger('likes')->default(0);
            $table->unsignedBigInteger('comments')->default(0);
            $table->unsignedBigInteger('plays')->default(0);
            $table->unsignedBigInteger('shares')->default(0);
            $table->unsignedBigInteger('saves')->default(0);

            /** A slideshow is TikTok's carousel: photos, no duration. */
            $table->boolean('is_slideshow')->default(false);
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_ad')->default(false);

            $table->unsignedInteger('duration')->nullable();
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->string('definition')->nullable();

            $table->json('hashtags')->nullable();
            $table->json('mentions')->nullable();
            /** Which track it used, and whether the account made it. */
            $table->json('music')->nullable();
            $table->string('location_name')->nullable();

            $table->timestamp('posted_at');
            $table->timestamp('fetched_at')->nullable();

            /*
             | Everything the scraper returned, kept verbatim. The columns above
             | are what this app reads today; this is what it will be able to
             | read tomorrow without asking TikTok — and paying — again.
             */
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['tiktok_profile_id', 'posted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tiktok_posts');
        Schema::dropIfExists('tiktok_snapshots');
        Schema::dropIfExists('tiktok_profiles');
    }
};
