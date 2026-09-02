<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('instagram_posts', function (Blueprint $table) {
            $table->string('owner_username')->nullable()->after('ig_id');

            $table->json('mentions')->nullable()->after('hashtags');
            $table->json('tagged_users')->nullable()->after('mentions');
            /** Slides in a carousel. One for anything that is not one. */
            $table->unsignedSmallInteger('slides')->default(1)->after('tagged_users');

            $table->unsignedSmallInteger('width')->nullable()->after('slides');
            $table->unsignedSmallInteger('height')->nullable()->after('width');
            $table->text('alt')->nullable()->after('height');

            $table->boolean('paid_partnership')->default(false)->after('is_pinned');
            $table->boolean('comments_disabled')->default(false)->after('paid_partnership');
            $table->string('location_id')->nullable()->after('location_name');

            /** Reels carry a track; knowing which one is part of reading them. */
            $table->json('music')->nullable()->after('video_duration');
            $table->text('video_url')->nullable()->after('music');
            $table->text('first_comment')->nullable()->after('video_url');

            /*
             | Everything the scraper returned, kept verbatim. The columns above
             | are what this app reads today; this is what it will be able to
             | read tomorrow without asking Instagram — and paying — again.
             */
            $table->json('payload')->nullable()->after('first_comment');
        });
    }

    public function down(): void
    {
        Schema::table('instagram_posts', function (Blueprint $table) {
            $table->dropColumn([
                'owner_username',
                'mentions',
                'tagged_users',
                'slides',
                'width',
                'height',
                'alt',
                'paid_partnership',
                'comments_disabled',
                'location_id',
                'music',
                'video_url',
                'first_comment',
                'payload',
            ]);
        });
    }
};
