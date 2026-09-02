<?php

use App\Models\TiktokPost;
use App\Models\TiktokProfile;
use App\Models\TiktokSnapshot;
use App\Models\User;
use App\Support\ApifyTiktok;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->actingAs(User::factory()->create());
    Storage::fake('public');

    config()->set('services.apify.token', 'test-token');
    config()->set('services.apify.tiktok.username', 'kisantra.official');
    config()->set('services.apify.tiktok.actor', 'TIKTOK');
    config()->set('services.apify.tiktok.posts_limit', 24);
    config()->set('services.apify.tiktok.timeout', 30);
});

function ttAccount(array $overrides = []): TiktokProfile
{
    return TiktokProfile::create([
        'username' => 'kisantra.official',
        'nickname' => 'Kisantra Consultant',
        'followers' => 1_000,
        'following' => 8,
        'hearts' => 5_000,
        'videos_count' => 109,
        'fetched_at' => now(),
        ...$overrides,
    ]);
}

function ttPost(TiktokProfile $profile, array $overrides = []): TiktokPost
{
    return TiktokPost::create([
        'tiktok_profile_id' => $profile->id,
        'post_id' => (string) fake()->unique()->numberBetween(1000, 9999),
        'url' => 'https://www.tiktok.com/@kisantra.official/video/1',
        'likes' => 10,
        'comments' => 0,
        'plays' => 100,
        'shares' => 0,
        'saves' => 0,
        'posted_at' => Carbon::today(),
        ...$overrides,
    ]);
}

/** One video as the actor really returns it, trimmed to what is read. */
function ttPayload(array $overrides = []): array
{
    return [
        'id' => '7633987323461471508',
        'text' => 'CARA BALIK NAMA SERTIFIKAT TANPA BONCOS!',
        'textLanguage' => 'id',
        'createTimeISO' => '2026-04-29T01:29:50.000Z',
        'webVideoUrl' => 'https://www.tiktok.com/@kisantra.official/video/7633987323461471508',
        'diggCount' => 4911,
        'commentCount' => 342,
        'playCount' => 296700,
        'shareCount' => 8561,
        'collectCount' => 4099,
        'isSlideshow' => false,
        'isPinned' => true,
        'isAd' => false,
        'hashtags' => [['name' => 'kisantra'], ['name' => 'pajak']],
        'mentions' => [],
        'musicMeta' => [
            'musicName' => 'suara asli - Kisantra',
            'musicAuthor' => 'Kisantra Consultant',
            'musicOriginal' => true,
        ],
        'locationMeta' => ['locationName' => 'Samarinda'],
        'videoMeta' => [
            'width' => 576,
            'height' => 1024,
            'duration' => 89,
            'definition' => '540p',
            'coverUrl' => 'https://cdn.tiktok/cover.jpg',
        ],
        'authorMeta' => [
            'id' => '7553616677017224209',
            'name' => 'kisantra.official',
            'nickName' => 'Kisantra Consultant',
            'signature' => 'Urusan bisnis biar kami yang bantu',
            'bioLink' => 'instagram.com/kisantra.official',
            'profileUrl' => 'https://www.tiktok.com/@kisantra.official',
            'avatar' => 'https://cdn.tiktok/avatar.jpg',
            'verified' => false,
            'privateAccount' => false,
            'fans' => 1644,
            'following' => 8,
            'heart' => 5749,
            'video' => 109,
        ],
        ...$overrides,
    ];
}

it('stores the account, its videos and a snapshot of the day', function () {
    Http::fake([
        'api.apify.com/*' => Http::response([
            ttPayload(),
            ttPayload([
                'id' => '7678499618648296725',
                'isSlideshow' => true,
                'isPinned' => false,
                'diggCount' => 7,
                'playCount' => 424,
                /* A slideshow reports zeroes for all three. */
                'videoMeta' => ['width' => 0, 'height' => 0, 'duration' => 0],
            ]),
        ]),
        'cdn.tiktok/*' => Http::response('binary'),
    ]);

    $result = ApifyTiktok::make()->refresh();

    expect($result)->toBe(['posts' => 2, 'followers' => 1644]);

    $profile = TiktokProfile::firstWhere('username', 'kisantra.official');

    expect($profile->nickname)->toBe('Kisantra Consultant')
        ->and($profile->followers)->toBe(1644)
        ->and($profile->hearts)->toBe(5749)
        ->and($profile->videos_count)->toBe(109)
        ->and($profile->avatar_path)->toBe("tiktok/{$profile->id}/avatar.jpg");

    Storage::disk('public')->assertExists($profile->avatar_path);

    $video = TiktokPost::firstWhere('post_id', '7633987323461471508');

    expect($video->likes)->toBe(4911)
        ->and($video->comments)->toBe(342)
        ->and($video->plays)->toBe(296700)
        ->and($video->shares)->toBe(8561)
        ->and($video->saves)->toBe(4099)
        ->and($video->duration)->toBe(89)
        ->and($video->is_pinned)->toBeTrue()
        ->and($video->format())->toBe('video')
        /* Hashtags arrive as objects and are unwrapped, so every screen reads
           one shape whichever account it is looking at. */
        ->and($video->hashtags)->toBe(['kisantra', 'pajak'])
        ->and($video->track())->toBe(['song' => 'suara asli - Kisantra', 'artist' => 'Kisantra Consultant'])
        ->and($video->posted_at->toDateString())->toBe('2026-04-29');

    /* A slideshow has no length. Null says "not a video"; a nought would say
       "a video of no length". */
    $slideshow = TiktokPost::firstWhere('post_id', '7678499618648296725');

    expect($slideshow->format())->toBe('slideshow')
        ->and($slideshow->duration)->toBeNull()
        ->and($slideshow->width)->toBeNull()
        ->and($slideshow->aspect())->toBe('portrait');

    expect(TiktokSnapshot::where('tiktok_profile_id', $profile->id)->count())->toBe(1);
});

it('counts every way a viewer can respond, not only likes', function () {
    $profile = ttAccount(['followers' => 1_000]);
    $post = ttPost($profile, ['likes' => 10, 'comments' => 5, 'shares' => 3, 'saves' => 2, 'plays' => 1_000]);

    /* TikTok reports four where Instagram's public scrape reports two, and a
       save is the strongest signal a piece of tax advice can earn. */
    expect($post->interactions())->toBe(20);

    /*
     | And the rate divides by the plays, not the followers. The For You page
     | shows a video to strangers by the thousand: this account's best video
     | earned 17.913 interactions against 1.644 followers, and reporting that
     | as 1.089% would be arithmetically true and useless.
     */
    expect($post->rateNoun())->toBe('pemutaran')
        ->and($post->rateBasis(1_000))->toBe(1_000)
        ->and($post->engagementRate(1_000))->toBe(2.0);

    // A video with no plays on record falls back to the followers.
    $unplayed = ttPost($profile, ['likes' => 20, 'plays' => 0]);

    expect($unplayed->rateBasis(1_000))->toBe(1_000)
        ->and($unplayed->rateNoun())->toBe('pemutaran')
        ->and($unplayed->engagementRate(0))->toBe(0.0);
});

it('refuses to invent an account when the run comes back empty', function () {
    Http::fake(['api.apify.com/*' => Http::response([])]);

    /* A run that returns nothing has told us nothing. Writing zero followers
       would be this app making a claim the scrape never made. */
    expect(fn () => ApifyTiktok::make()->refresh())
        ->toThrow(RuntimeException::class);

    expect(TiktokProfile::count())->toBe(0);
});

it('reads the TikTok account on the same pages as the Instagram one', function () {
    $profile = ttAccount();
    ttPost($profile, ['likes' => 90, 'saves' => 40, 'shares' => 10, 'plays' => 9_000, 'posted_at' => Carbon::today()]);
    ttPost($profile, ['likes' => 4, 'saves' => 1, 'is_slideshow' => true, 'plays' => 100, 'posted_at' => Carbon::today()->subDay()]);

    $this->get(route('performance', ['platform' => 'tiktok']))
        ->assertInertia(fn ($page) => $page
            ->where('platform', 'tiktok')
            ->where('handle', 'kisantra.official')
            ->where('account.name', 'Kisantra Consultant')
            ->where('summary.followers.value', 1_000)
            /* The fourth tile is the platform's own figure: TikTok counts
               saves where Instagram counts Reel plays. */
            ->where('summary.highlight.label', 'Disimpan')
            ->where('summary.highlight.value', 41)
            ->has('platforms', 2)
        );

    $this->get(route('performance.content', ['platform' => 'tiktok']))
        ->assertInertia(fn ($page) => $page
            ->where('platform', 'tiktok')
            /* Two shapes here, not Instagram's four. */
            ->where('formatLabels', ['video' => 'Video', 'slideshow' => 'Slideshow'])
            ->where('formatCounts.video', 1)
            ->where('formatCounts.slideshow', 1)
            ->has('rows', 2)
            ->where('rows.0.shares', 10)
            ->where('rows.0.saves', 40)
        );
});

it('measures the rate against what each platform actually reaches', function () {
    $profile = ttAccount(['followers' => 1_644]);

    /* The real shape of this account: one video the For You page carried far
       past the follower count, and a run of ordinary ones. */
    ttPost($profile, ['likes' => 4_911, 'comments' => 342, 'shares' => 8_561, 'saves' => 4_099, 'plays' => 296_700]);
    ttPost($profile, ['likes' => 7, 'comments' => 1, 'shares' => 4, 'saves' => 5, 'plays' => 443]);
    ttPost($profile, ['likes' => 4, 'comments' => 0, 'shares' => 2, 'saves' => 0, 'plays' => 214]);

    $this->get(route('performance', ['platform' => 'tiktok']))
        ->assertInertia(fn ($page) => $page
            /* Against followers the typical post would read 1,03%; against the
               typical video's plays it reads 3,84%, which is the figure the
               rest of the world means by engagement rate on TikTok. */
            ->where('summary.engagement.basis', 'pemutaran')
            ->where('summary.engagement.rate', 3.837)
        );

    $this->get(route('performance', ['platform' => 'instagram']))
        ->assertInertia(fn ($page) => $page->where('account', null));
});

it('asks Apify for the video links, and keeps a file only on request', function () {
    Http::fake([
        'api.apify.com/*' => Http::response([
            ttPayload(['mediaUrls' => ['https://kv.apify/video.mp4']]),
        ]),
        'cdn.tiktok/*' => Http::response('binary'),
        'kv.apify/*' => Http::response('a-real-mp4-body'),
    ]);

    ApifyTiktok::make()->refresh();

    /* TikTok's payload carries no video link of its own, so the run has to ask
       for one; without it the file is unreachable afterwards at any price. */
    Http::assertSent(fn ($request) => str_contains($request->url(), 'api.apify.com')
        && $request['shouldDownloadVideos'] === true
        && filled($request['videoKvStoreIdOrName']));

    $post = TiktokPost::firstWhere('post_id', '7633987323461471508');

    // Asked for, not fetched: the run stores the link and nothing else.
    expect($post->videoSource())->toBe('https://kv.apify/video.mp4')
        ->and($post->video_path)->toBeNull();

    $this->post(route('performance.video', [
        'platform' => 'tiktok',
        'code' => '7633987323461471508',
    ]))->assertRedirect();

    $post->refresh();

    expect($post->video_path)->toContain('videos/7633987323461471508.mp4');
    Storage::disk('public')->assertExists($post->video_path);
});

it('has nothing to keep for a slideshow', function () {
    $profile = ttAccount();
    $slides = ttPost($profile, ['post_id' => 'SLIDE', 'is_slideshow' => true]);

    /* A slideshow is photos. There is no file, and the panel says so rather
       than offering a button that cannot work. */
    expect($slides->videoSource())->toBeNull();

    $this->get(route('performance.content', ['platform' => 'tiktok', 'konten' => 'SLIDE']))
        ->assertInertia(fn ($page) => $page
            ->where('selected.videoAvailable', false)
            ->where('selected.video', null)
        );
});

it('keeps each account on its own page', function () {
    $tiktok = ttAccount();
    ttPost($tiktok, ['likes' => 90]);

    // No platform named means Instagram, which has nothing stored here.
    $this->get(route('performance'))
        ->assertInertia(fn ($page) => $page
            ->where('platform', 'instagram')
            ->where('account', null)
        );

    // And a platform nobody offers falls back to it rather than to an error.
    $this->get(route('performance', ['platform' => 'threads']))
        ->assertInertia(fn ($page) => $page->where('platform', 'instagram'));
});

it('sorts and filters the TikTok list by what that account has', function () {
    $profile = ttAccount();
    ttPost($profile, ['post_id' => 'RAMAI', 'likes' => 5, 'saves' => 90, 'plays' => 10, 'posted_at' => Carbon::today()->subDays(3)]);
    ttPost($profile, ['post_id' => 'DILIHAT', 'likes' => 9, 'saves' => 1, 'plays' => 9_000, 'posted_at' => Carbon::today()->subDay()]);

    /* Dated against the answer: the most played is also the newest, so the
       most-liked check has to beat the date order to pass. */
    $this->get(route('performance.content', ['platform' => 'tiktok', 'urut' => 'pemutaran']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'DILIHAT'));

    $this->get(route('performance.content', ['platform' => 'tiktok', 'urut' => 'interaksi']))
        ->assertInertia(fn ($page) => $page->where('rows.0.shortCode', 'RAMAI'));

    $this->get(route('performance.content', ['platform' => 'tiktok', 'format' => 'slideshow']))
        ->assertInertia(fn ($page) => $page->has('rows', 0));

    // The panel opens on a TikTok id, which is not an Instagram short code.
    $this->get(route('performance.content', ['platform' => 'tiktok', 'konten' => 'RAMAI']))
        ->assertInertia(fn ($page) => $page
            ->where('selected.shortCode', 'RAMAI')
            ->where('selected.saves', 90)
        );
});
