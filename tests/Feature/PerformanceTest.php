<?php

use App\Models\InstagramPost;
use App\Models\InstagramProfile;
use App\Models\InstagramSnapshot;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->actingAs(User::factory()->create());
    Storage::fake('public');

    config()->set('services.apify.token', 'test-token');
    config()->set('services.apify.instagram.username', 'kisantra.official');
    config()->set('services.apify.instagram.profile_actor', 'PROFILE');
    config()->set('services.apify.instagram.posts_actor', 'POSTS');
    config()->set('services.apify.instagram.posts_limit', 24);
    config()->set('services.apify.instagram.timeout', 30);
});

function account(array $overrides = []): InstagramProfile
{
    return InstagramProfile::create([
        'username' => 'kisantra.official',
        'full_name' => 'Konsultan Bisnis Samarinda',
        'followers' => 10_000,
        'follows' => 76,
        'posts_count' => 322,
        'fetched_at' => now(),
        ...$overrides,
    ]);
}

function post(InstagramProfile $profile, array $overrides = []): InstagramPost
{
    return InstagramPost::create([
        'instagram_profile_id' => $profile->id,
        'short_code' => 'A'.fake()->unique()->numberBetween(1000, 9999),
        'type' => 'Image',
        'url' => 'https://www.instagram.com/p/x/',
        'likes' => 10,
        'comments' => 0,
        'posted_at' => Carbon::today(),
        ...$overrides,
    ]);
}

it('says the page is not connected when no token is set', function () {
    config()->set('services.apify.token', null);

    $this->get(route('performance'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('performance')
            ->where('connected', false)
            ->where('account', null)
        );
});

it('opens on an empty state before anything has been fetched', function () {
    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page
            ->where('connected', true)
            ->where('account', null)
            ->where('summary', null)
            ->where('top', [])
        );
});

it('measures engagement against the audience that could have given it', function () {
    $profile = account(['followers' => 1000]);

    // 20 + 10 + 0 interactions over three posts averages 10 a post.
    post($profile, ['likes' => 18, 'comments' => 2]);
    post($profile, ['likes' => 10, 'comments' => 0]);
    post($profile, ['likes' => 0, 'comments' => 0]);

    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page
            ->where('summary.interactions.typical', 10)
            ->where('summary.interactions.average', 10)
            ->where('summary.interactions.best', 20)
            // 10 interactions from 1000 followers is one per cent.
            ->where('summary.engagement.rate', 1)
            ->where('summary.posts.measured', 3)
        );
});

it('reports the typical post, not the one that went viral', function () {
    $profile = account(['followers' => 10_000]);

    /*
     | Nine ordinary posts and one giveaway. The mean says every post earns
     | about 200 interactions; not one of them did.
     */
    foreach (range(1, 9) as $i) {
        post($profile, ['likes' => 10, 'comments' => 0]);
    }

    post($profile, ['likes' => 1_000, 'comments' => 900]);

    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page
            ->where('summary.interactions.typical', 10)
            ->where('summary.interactions.average', 199)
            ->where('summary.engagement.rate', 0.1)
            ->where('summary.engagement.mean', 1.99)
            // The spike is named rather than left to distort in silence.
            ->where('summary.outlier.interactions', 1_900)
            ->where('summary.outlier.share', 95)
        );
});

it('names no outlier when the set is even', function () {
    $profile = account();

    foreach (range(1, 8) as $i) {
        post($profile, ['likes' => 10 + $i, 'comments' => 1]);
    }

    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page->where('summary.outlier', null));
});

it('separates reels from the rest and counts each format it averages', function () {
    $profile = account();

    post($profile, [
        'type' => 'Video',
        'product_type' => 'clips',
        'likes' => 40,
        'video_views' => 500,
        'video_plays' => 900,
    ]);
    post($profile, [
        'type' => 'Video',
        'product_type' => 'clips',
        'likes' => 20,
        'video_views' => 300,
        'video_plays' => 700,
    ]);
    post($profile, ['type' => 'Sidecar', 'likes' => 4]);

    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page
            ->where('summary.highlight.label', 'Pemutaran Reel')
            ->where('summary.highlight.value', 800)
            ->where('summary.highlight.note', '2 reel · 400 view rata-rata')
            ->where('formats.0.format', 'reel')
            ->where('formats.0.count', 2)
            ->where('formats.0.typical', 30)
            ->where('formats.1.format', 'carousel')
            ->where('formats.1.count', 1)
        );
});

it('ranks the leaderboard by interactions, not by likes alone', function () {
    $profile = account();

    post($profile, ['short_code' => 'LIKED', 'likes' => 30, 'comments' => 0]);
    post($profile, ['short_code' => 'TALKED', 'likes' => 25, 'comments' => 9]);

    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page
            ->where('top.0.shortCode', 'TALKED')
            ->where('top.0.interactions', 34)
            ->where('top.1.shortCode', 'LIKED')
        );
});

it('has no follower delta until a second day has been recorded', function () {
    $profile = account(['followers' => 10_000]);

    InstagramSnapshot::create([
        'instagram_profile_id' => $profile->id,
        'captured_on' => Carbon::today(),
        'followers' => 10_000,
    ]);

    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page->where('summary.followers.delta', null));

    InstagramSnapshot::create([
        'instagram_profile_id' => $profile->id,
        'captured_on' => Carbon::today()->addDay(),
        'followers' => 10_120,
    ]);

    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page
            ->where('summary.followers.delta', 120)
            ->has('followerTrend', 2)
        );
});

it('stores the account, its posts and a snapshot of the day', function () {
    Http::fake([
        'api.apify.com/v2/acts/PROFILE/*' => Http::response([[
            'id' => '77154176591',
            'username' => 'kisantra.official',
            'fullName' => 'Konsultan Bisnis Samarinda',
            'biography' => 'Konsultan Bisnis | Pajak',
            'externalUrl' => 'https://kisantra.com/layanan',
            'followersCount' => 13055,
            'followsCount' => 76,
            'postsCount' => 322,
            'verified' => false,
            'isBusinessAccount' => true,
            'profilePicUrlHD' => 'https://cdn.example/avatar.jpg',
        ]]),
        'api.apify.com/v2/acts/POSTS/*' => Http::response([[
            'id' => '3973564199083066908',
            'shortCode' => 'Dck75YSjkYc',
            'type' => 'Video',
            'productType' => 'clips',
            'caption' => 'PMK Nomor 44 Tahun 2026',
            'url' => 'https://www.instagram.com/p/Dck75YSjkYc/',
            'displayUrl' => 'https://cdn.example/thumb.jpg',
            'likesCount' => 8,
            'commentsCount' => 2,
            'videoViewCount' => 67,
            'videoPlayCount' => 286,
            'videoDuration' => 45.486439,
            'hashtags' => ['pajak', 'umkm'],
            'locationName' => 'Samarinda',
            'isPinned' => false,
            'timestamp' => '2026-08-28T08:30:14.000Z',
        ]]),
        '*' => Http::response('image-bytes'),
    ]);

    $this->post(route('performance.refresh'))->assertRedirect();

    $profile = InstagramProfile::firstWhere('username', 'kisantra.official');

    expect($profile->followers)->toBe(13055)
        ->and($profile->posts_count)->toBe(322)
        ->and($profile->is_business)->toBeTrue()
        ->and($profile->snapshots)->toHaveCount(1);

    $post = $profile->posts->first();

    expect($post->short_code)->toBe('Dck75YSjkYc')
        ->and($post->isReel())->toBeTrue()
        ->and($post->format())->toBe('reel')
        ->and($post->interactions())->toBe(10)
        ->and($post->video_plays)->toBe(286)
        ->and($post->video_duration)->toBe(45)
        ->and($post->hashtags)->toBe(['pajak', 'umkm']);

    // Instagram's own links expire, so the pictures are held here instead.
    Storage::disk('public')->assertExists($profile->avatar_path);
    Storage::disk('public')->assertExists($post->thumbnail_path);
});

it('overwrites the day it already recorded rather than stacking readings', function () {
    Http::fake([
        'api.apify.com/v2/acts/PROFILE/*' => Http::response([[
            'username' => 'kisantra.official',
            'followersCount' => 13060,
            'followsCount' => 76,
            'postsCount' => 322,
        ]]),
        'api.apify.com/v2/acts/POSTS/*' => Http::response([]),
        '*' => Http::response('image-bytes'),
    ]);

    $this->post(route('performance.refresh'));
    $this->post(route('performance.refresh'));

    expect(InstagramSnapshot::count())->toBe(1)
        ->and(InstagramProfile::count())->toBe(1);
});

it('reports a refusal from Apify instead of failing silently', function () {
    Http::fake([
        'api.apify.com/*' => Http::response(['error' => 'unauthorized'], 401),
    ]);

    $this->post(route('performance.refresh'))
        ->assertRedirect();

    expect(InstagramProfile::count())->toBe(0);

    $this->withHeaders([
        'X-Inertia' => 'true',
        'X-Inertia-Version' => Inertia\Inertia::getVersion(),
    ])->get(route('performance'))
        ->assertJsonPath('flash.toast.type', 'error')
        ->assertJsonPath('flash.toast.message', 'Gagal memperbarui data');
});

it('refuses to reach for Apify when no token is configured', function () {
    config()->set('services.apify.token', null);
    Http::fake();

    $this->post(route('performance.refresh'))->assertRedirect();

    Http::assertNothingSent();
    expect(InstagramProfile::count())->toBe(0);
});

it('reads both Performa pages over the window they were asked for', function () {
    Carbon::setTestNow('2026-08-20');

    $profile = account();
    post($profile, ['likes' => 100, 'posted_at' => Carbon::parse('2026-08-14')]);
    post($profile, ['likes' => 200, 'posted_at' => Carbon::parse('2026-06-14')]);
    post($profile, ['likes' => 300, 'posted_at' => Carbon::parse('2025-11-14')]);

    // Unbounded by default: the store reaches as far back as the last scrape.
    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page
            ->where('period.key', 'semua')
            ->where('coverage.posts', 3)
            ->where('coverage.earliest', '2025-11-14')
        );

    $this->get(route('performance', ['periode' => '30hari']))
        ->assertInertia(fn ($page) => $page
            ->where('period.key', '30hari')
            ->where('coverage.posts', 1)
            ->where('summary.posts.measured', 1)
        );

    $this->get(route('performance', ['periode' => '90hari']))
        ->assertInertia(fn ($page) => $page->where('coverage.posts', 2));

    /* The window a page is asked for can reach further back than anything on
       record, and the page has to be able to say so. */
    $this->get(route('performance', ['periode' => 'tahun']))
        ->assertInertia(fn ($page) => $page
            ->where('coverage.posts', 2)
            ->where('coverage.stored', 3)
            ->where('coverage.earliest', '2025-11-14')
        );

    // The content list reads the same window, and by the same names.
    $this->get(route('performance.content', ['periode' => '30hari']))
        ->assertInertia(fn ($page) => $page
            ->where('period.key', '30hari')
            ->has('rows', 1)
            ->where('totals.matched', 1)
            ->where('totals.stored', 3)
        );

    $this->get(route('performance.content', [
        'periode' => 'khusus',
        'dari' => '2026-06-01',
        'sampai' => '2026-06-30',
    ]))->assertInertia(fn ($page) => $page
        ->where('period.label', '1 – 30 Jun 2026')
        ->has('rows', 1)
    );

    Carbon::setTestNow();
});

it('keeps the follower line over the same stretch as the figures beside it', function () {
    Carbon::setTestNow('2026-08-20');

    $profile = account();

    foreach (['2026-05-01', '2026-08-01', '2026-08-19'] as $index => $day) {
        InstagramSnapshot::create([
            'instagram_profile_id' => $profile->id,
            'captured_on' => Carbon::parse($day),
            'followers' => 9_000 + $index,
            'follows' => 76,
            'posts_count' => 322,
        ]);
    }

    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page->has('followerTrend', 3));

    $this->get(route('performance', ['periode' => '30hari']))
        ->assertInertia(fn ($page) => $page->has('followerTrend', 2));

    Carbon::setTestNow();
});

it('keeps one video when somebody asks to watch it, and only then', function () {
    $profile = account();
    $post = post($profile, [
        'short_code' => 'REEL',
        'type' => 'Video',
        'product_type' => 'clips',
        'video_url' => 'https://cdn.instagram/reel.mp4',
    ]);

    Http::fake(['cdn.instagram/*' => Http::response('a-real-mp4-body')]);

    /* Nothing is fetched during a scrape: sixty videos is half a gigabyte and
       ten minutes, and the refresh runs inside a request someone waits on. */
    expect($post->video_path)->toBeNull()
        ->and($post->videoSource())->toBe('https://cdn.instagram/reel.mp4')
        ->and($post->videoUrl())->toBeNull();

    $this->get(route('performance.content', ['konten' => 'REEL']))
        ->assertInertia(fn ($page) => $page
            ->where('selected.video', null)
            ->where('selected.videoAvailable', true)
        );

    $this->post(route('performance.video', ['platform' => 'instagram', 'code' => 'REEL']))
        ->assertRedirect();

    $post->refresh();

    expect($post->video_path)->toBe("instagram/{$profile->id}/videos/REEL.mp4");
    Storage::disk('public')->assertExists($post->video_path);

    // And the panel now plays this app's own copy, not the link.
    $this->get(route('performance.content', ['konten' => 'REEL']))
        ->assertInertia(fn ($page) => $page->where(
            'selected.video',
            fn (?string $url) => str_contains((string) $url, 'videos/REEL.mp4'),
        ));

    /* Asking twice does not fetch twice: the copy already on disk is the
       answer, and six megabytes is not worth re-reading to say so. */
    Http::fake(['cdn.instagram/*' => Http::response('', 500)]);

    $this->post(route('performance.video', ['platform' => 'instagram', 'code' => 'REEL']))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($post->fresh()->video_path)->toBe("instagram/{$profile->id}/videos/REEL.mp4");
});

it('says so plainly when there is no video to keep', function () {
    $profile = account();

    // A photo has no video, and never will.
    post($profile, ['short_code' => 'FOTO', 'type' => 'Image']);

    $this->get(route('performance.content', ['konten' => 'FOTO']))
        ->assertInertia(fn ($page) => $page->where('selected.videoAvailable', false));

    $this->post(route('performance.video', ['platform' => 'instagram', 'code' => 'FOTO']))
        ->assertRedirect();

    expect($profile->posts()->firstWhere('short_code', 'FOTO')->video_path)->toBeNull();

    // A link that has since expired leaves the still in place rather than a
    // half-written file.
    post($profile, [
        'short_code' => 'MATI',
        'type' => 'Video',
        'video_url' => 'https://cdn.instagram/gone.mp4',
    ]);

    Http::fake(['cdn.instagram/*' => Http::response('', 403)]);

    $this->post(route('performance.video', ['platform' => 'instagram', 'code' => 'MATI']))
        ->assertRedirect();

    expect($profile->posts()->firstWhere('short_code', 'MATI')->video_path)->toBeNull();
});

it('lists every stored post, newest first', function () {
    $profile = account();

    post($profile, [
        'short_code' => 'LAMA',
        'posted_at' => Carbon::today()->subDays(10),
    ]);
    post($profile, [
        'short_code' => 'BARU',
        'posted_at' => Carbon::today(),
    ]);

    $this->get(route('performance.content'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('performance-content')
            ->where('rows.0.shortCode', 'BARU')
            ->where('rows.1.shortCode', 'LAMA')
            ->where('totals.stored', 2)
            ->where('formatCounts.semua', 2)
        );
});

it('keeps the sidebar counts it does not own', function () {
    account();

    /*
     | The page's own tally is named for what it counts. A prop called `counts`
     | here would quietly replace the shared one and blank every nav badge.
     */
    $this->get(route('performance.content'))
        ->assertInertia(fn ($page) => $page->has('formatCounts'));
});

it('filters by format and searches caption, hashtag and place', function () {
    $profile = account();

    post($profile, [
        'short_code' => 'REEL',
        'type' => 'Video',
        'product_type' => 'clips',
        'caption' => 'Cara hitung PPh final',
    ]);
    post($profile, [
        'short_code' => 'KARTU',
        'type' => 'Sidecar',
        'caption' => 'Checklist dokumen',
        'hashtags' => ['pajak'],
        'location_name' => 'Samarinda',
    ]);

    $this->get(route('performance.content', ['format' => 'reel']))
        ->assertInertia(fn ($page) => $page
            ->has('rows', 1)
            ->where('rows.0.shortCode', 'REEL')
        );

    $this->get(route('performance.content', ['q' => 'checklist']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'KARTU'));

    $this->get(route('performance.content', ['q' => 'pajak']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'KARTU'));

    $this->get(route('performance.content', ['q' => 'samarinda']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'KARTU'));
});

it('sorts by what was asked for', function () {
    $profile = account();

    /*
     | Deliberately dated against the answer: the relation orders by date, so
     | posts sharing one day let a broken sort look right. Here the strongest
     | post by every measure is also the oldest, and only an order that
     | actually replaces the date one can put it first.
     */
    post($profile, [
        'short_code' => 'RAMAI',
        'likes' => 50,
        'comments' => 80,
        'posted_at' => Carbon::today()->subDays(3),
    ]);
    post($profile, [
        'short_code' => 'SUKA',
        'likes' => 90,
        'comments' => 0,
        'posted_at' => Carbon::today()->subDays(2),
    ]);
    post($profile, [
        'short_code' => 'PUTAR',
        'likes' => 5,
        'comments' => 0,
        'type' => 'Video',
        'product_type' => 'clips',
        'video_plays' => 9_000,
        'posted_at' => Carbon::today()->subDay(),
    ]);

    $this->get(route('performance.content', ['urut' => 'suka']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'SUKA'));

    $this->get(route('performance.content', ['urut' => 'interaksi']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'RAMAI'));

    $this->get(route('performance.content', ['urut' => 'pemutaran']))
        ->assertInertia(fn ($page) => $page
            ->where('rows.0.shortCode', 'PUTAR')
            /* A post with no plays never outranks one with nine thousand. */
            ->where('rows.1.plays', null)
        );

    // The two date orders still mean what they say.
    $this->get(route('performance.content', ['urut' => 'terbaru']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'PUTAR'));

    $this->get(route('performance.content', ['urut' => 'terlama']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'RAMAI'));
});

it('hands the panel everything the scraper gave for one post', function () {
    $profile = account(['followers' => 10_000]);

    post($profile, [
        'short_code' => 'PENUH',
        'type' => 'Video',
        'product_type' => 'clips',
        'caption' => 'PMK Nomor 44 Tahun 2026',
        'likes' => 90,
        'comments' => 10,
        'video_views' => 500,
        'video_plays' => 1_200,
        'video_duration' => 45,
        'width' => 720,
        'height' => 1_280,
        'hashtags' => ['pajak', 'umkm'],
        'mentions' => ['kisantra.official'],
        'tagged_users' => ['rekan'],
        'location_name' => 'Samarinda',
        'music' => ['song_name' => 'Original audio', 'artist_name' => 'kisantra'],
        'first_comment' => 'Mantap',
        'paid_partnership' => true,
    ]);

    $this->get(route('performance.content', ['konten' => 'PENUH']))
        ->assertInertia(fn ($page) => $page
            ->where('selected.shortCode', 'PENUH')
            ->where('selected.rate', 1)
            ->where('selected.rateBasis', 10_000)
            ->where('selected.rateNoun', 'pengikut')
            ->where('selected.duration', 45)
            ->where('selected.aspect', 'portrait')
            ->where('selected.hashtags', ['pajak', 'umkm'])
            ->where('selected.mentions', ['kisantra.official'])
            ->where('selected.taggedUsers', ['rekan'])
            ->where('selected.location', 'Samarinda')
            ->where('selected.music.song', 'Original audio')
            ->where('selected.firstComment', 'Mantap')
            ->where('selected.paidPartnership', true)
        );

    $this->get(route('performance.content', ['konten' => 'TIDAK-ADA']))
        ->assertInertia(fn ($page) => $page->where('selected', null));
});

it('keeps every field the scraper returned, even the ones no screen reads', function () {
    Http::fake([
        'api.apify.com/v2/acts/PROFILE/*' => Http::response([[
            'username' => 'kisantra.official',
            'followersCount' => 13055,
        ]]),
        'api.apify.com/v2/acts/POSTS/*' => Http::response([[
            'shortCode' => 'UTUH',
            'type' => 'Sidecar',
            'productType' => 'carousel_container',
            'timestamp' => '2026-08-28T08:30:14.000Z',
            'childPosts' => [['id' => 1], ['id' => 2], ['id' => 3]],
            'taggedUsers' => [['username' => 'rekan'], ['username' => 'mitra']],
            'coauthorProducers' => [['username' => 'kolaborator']],
            'musicInfo' => ['song_name' => 'Original audio'],
        ]]),
        '*' => Http::response('image-bytes'),
    ]);

    $this->post(route('performance.refresh'));

    $post = InstagramPost::firstWhere('short_code', 'UTUH');

    expect($post->slides)->toBe(3)
        ->and($post->tagged_users)->toBe(['rekan', 'mitra'])
        ->and($post->format())->toBe('carousel')
        // Nothing on screen reads coauthors yet; the record keeps them anyway.
        ->and($post->payload['coauthorProducers'][0]['username'])->toBe('kolaborator');
});
