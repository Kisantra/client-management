<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instagram_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique();
            $table->string('ig_id')->nullable();
            $table->string('full_name')->nullable();
            $table->text('biography')->nullable();
            $table->string('external_url')->nullable();

            $table->unsignedBigInteger('followers')->default(0);
            $table->unsignedBigInteger('follows')->default(0);
            $table->unsignedBigInteger('posts_count')->default(0);

            /*
             | Instagram's own image URLs expire within days, so the picture is
             | copied to this app's storage. What is on screen has to keep
             | working after the link that delivered it has gone.
             */
            $table->string('avatar_path')->nullable();

            $table->boolean('verified')->default(false);
            $table->boolean('is_business')->default(false);
            $table->timestamp('fetched_at')->nullable();
            $table->timestamps();
        });

        Schema::create('instagram_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instagram_profile_id')->constrained()->cascadeOnDelete();

            /*
             | One row per account per day. Instagram tells you what a number is
             | now and never what it was, so growth only exists if this app
             | writes it down as it goes.
             */
            $table->date('captured_on');
            $table->unsignedBigInteger('followers')->default(0);
            $table->unsignedBigInteger('follows')->default(0);
            $table->unsignedBigInteger('posts_count')->default(0);
            $table->timestamps();

            $table->unique(['instagram_profile_id', 'captured_on']);
        });

        Schema::create('instagram_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instagram_profile_id')->constrained()->cascadeOnDelete();

            $table->string('short_code')->unique();
            $table->string('ig_id')->nullable();
            /** Image, Sidecar (carousel) or Video, as Instagram names them. */
            $table->string('type');
            /** 'clips' for a Reel, 'feed' for a video posted to the grid. */
            $table->string('product_type')->nullable();

            $table->text('caption')->nullable();
            $table->string('url');
            $table->string('thumbnail_path')->nullable();

            $table->unsignedBigInteger('likes')->default(0);
            $table->unsignedBigInteger('comments')->default(0);
            /** Videos only: accounts reached, and total plays. */
            $table->unsignedBigInteger('video_views')->nullable();
            $table->unsignedBigInteger('video_plays')->nullable();
            $table->unsignedInteger('video_duration')->nullable();

            $table->json('hashtags')->nullable();
            $table->string('location_name')->nullable();
            $table->boolean('is_pinned')->default(false);

            $table->timestamp('posted_at');
            $table->timestamp('fetched_at')->nullable();
            $table->timestamps();

            $table->index(['instagram_profile_id', 'posted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('instagram_posts');
        Schema::dropIfExists('instagram_snapshots');
        Schema::dropIfExists('instagram_profiles');
    }
};
