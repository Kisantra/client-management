<?php

use App\Models\Content;
use App\Models\InstagramPost;
use App\Models\InstagramProfile;
use App\Models\TiktokPost;
use App\Models\TiktokProfile;
use App\Models\User;
use App\Support\ReleasedPosts;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-09-08 09:30:00'));
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

/**
 * Asks a page for the one prop it deliberately left behind.
 *
 * Inertia refuses a partial request whose asset version does not match, and
 * the version is only settled once a page has actually rendered — so it is
 * taken from the full load rather than guessed at.
 */
function askFor(string $url, string $component, string $prop): TestResponse
{
    $version = test()->get($url)->viewData('page')['version'] ?? '';

    return test()->get($url, [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => (string) $version,
        'X-Inertia-Partial-Component' => $component,
        'X-Inertia-Partial-Data' => $prop,
    ]);
}

function igPost(array $attributes = []): InstagramPost
{
    $profile = InstagramProfile::firstOrCreate(
        ['username' => 'kisantra.official'],
        ['followers' => 1200],
    );

    return InstagramPost::create([
        'instagram_profile_id' => $profile->id,
        'short_code' => 'ABC'.fake()->unique()->numberBetween(1, 99999),
        'type' => 'Sidecar',
        'caption' => 'Batas lapor SPT badan sudah dekat',
        'url' => 'https://www.instagram.com/p/ABC123/',
        'posted_at' => Carbon::parse('2026-09-02 10:00:00'),
        ...$attributes,
    ]);
}

/*
 | The point of the picker: the address the Tautan field wants is already in
 | the app, scraped by Performa. This is the seam between the two modules, so
 | it is asserted on the shape the picker actually reads.
 */
it('offers the posts Performa already scraped, newest first, across both channels', function () {
    igPost(['caption' => 'Yang lama', 'url' => 'https://www.instagram.com/p/OLD/', 'posted_at' => Carbon::parse('2026-08-01 09:00:00')]);
    igPost(['caption' => 'Yang baru', 'url' => 'https://www.instagram.com/p/NEW/', 'posted_at' => Carbon::parse('2026-09-05 09:00:00')]);

    $tiktok = TiktokProfile::firstOrCreate(['username' => 'kisantra'], ['followers' => 800]);
    TiktokPost::create([
        'tiktok_profile_id' => $tiktok->id,
        'post_id' => '7300000000000000001',
        'caption' => "Reels pajak\nbaris kedua",
        'url' => 'https://www.tiktok.com/@kisantra/video/7300000000000000001',
        'posted_at' => Carbon::parse('2026-09-06 09:00:00'),
    ]);

    $posts = ReleasedPosts::all();

    expect($posts)->toHaveCount(3)
        // Newest first, and the two channels sorted into one run rather than
        // stacked one after the other.
        ->and(array_column($posts, 'channel'))->toBe(['tiktok', 'instagram', 'instagram'])
        ->and($posts[0]['url'])->toBe('https://www.tiktok.com/@kisantra/video/7300000000000000001')
        // A caption's own line breaks would turn each option into a paragraph.
        ->and($posts[0]['caption'])->toBe('Reels pajak baris kedua')
        ->and($posts[1]['caption'])->toBe('Yang baru')
        ->and($posts[0]['date'])->toBe('6 Sep');
});

it('marks a post that another piece already points at', function () {
    igPost(['url' => 'https://www.instagram.com/p/TAKEN/']);
    igPost(['url' => 'https://www.instagram.com/p/FREE/']);

    Content::create([
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'status' => 'published',
        'scheduled_for' => Carbon::today(),
        'status_changed_at' => Carbon::today(),
        'url' => 'https://www.instagram.com/p/TAKEN/',
    ]);

    $taken = collect(ReleasedPosts::all())->keyBy('url');

    expect($taken['https://www.instagram.com/p/TAKEN/']['taken'])->toBeTrue()
        ->and($taken['https://www.instagram.com/p/FREE/']['taken'])->toBeFalse();
});

it('offers nothing when Performa has never been synced', function () {
    expect(ReleasedPosts::all())->toBe([]);
});

/*
 | Optional, not absent: two hundred scraped posts should not ride along on
 | every calendar load for a field most pieces never fill. The picker asks for
 | them the first time it is opened, and only then.
 */
it('keeps the options off the calendar until the picker asks for them', function () {
    igPost();

    $this->get(route('content'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('content')->missing('released'));

    /* A partial response is JSON with no rendered view, so it is read as
       JSON — assertInertia only understands a full page. */
    askFor(route('content'), 'content', 'released')
        ->assertOk()
        ->assertJsonCount(1, 'props.released')
        ->assertJsonPath('props.released.0.url', 'https://www.instagram.com/p/ABC123/')
        ->assertJsonPath('props.released.0.channel', 'instagram');
});

it('offers the same options from the ideas page, where the form also opens', function () {
    igPost();

    $this->get(route('content.ideas'))
        ->assertInertia(fn ($page) => $page->component('content-ideas')->missing('released'));

    askFor(route('content.ideas'), 'content-ideas', 'released')
        ->assertOk()
        ->assertJsonCount(1, 'props.released');
});

it('still accepts a link that is not one of them', function () {
    $content = Content::create([
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'status' => 'review',
        'scheduled_for' => Carbon::today(),
        'status_changed_at' => Carbon::today(),
    ]);

    // A link from an account Performa does not follow: the picker is a
    // shortcut, and a field that refuses this cannot record what was needed.
    $this->post(route('content.update', $content), [
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'scheduled_for' => Carbon::today()->toDateString(),
        'status' => 'review',
        'url' => 'https://kisantra.com/artikel/batas-lapor-spt',
    ])->assertRedirect();

    expect($content->fresh()->url)->toBe('https://kisantra.com/artikel/batas-lapor-spt');
});

/*
 | The other half of the link: once a piece points at a post Performa follows,
 | its panel stops being a plan and starts being a result.
 */
it('shows the linked post and what it earned on the piece own panel', function () {
    igPost([
        'url' => 'https://www.instagram.com/p/LIVE/',
        'caption' => 'Batas lapor SPT badan sudah dekat',
        'product_type' => 'clips',
        'likes' => 233,
        'comments' => 33,
        'video_plays' => 10970,
        'posted_at' => Carbon::parse('2026-09-02 10:00:00'),
        'fetched_at' => Carbon::parse('2026-09-07 06:00:00'),
    ]);

    $piece = Content::create([
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'status' => 'published',
        'scheduled_for' => Carbon::parse('2026-09-02'),
        'status_changed_at' => Carbon::parse('2026-09-02'),
        'url' => 'https://www.instagram.com/p/LIVE/',
    ]);

    $this->get(route('content', ['bulan' => '2026-09', 'konten' => $piece->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('selected.live.channel', 'instagram')
            ->where('selected.live.format', 'reel')
            ->where('selected.live.counts.0', ['label' => 'suka', 'value' => 233])
            ->where('selected.live.counts.1', ['label' => 'komentar', 'value' => 33])
            ->where('selected.live.counts.2', ['label' => 'pemutaran', 'value' => 10970])
            // Straight through to the same post inside Performa.
            ->where('selected.live.href', '/performance/konten?platform=instagram&konten='.InstagramPost::sole()->short_code)
            /* Written out on this side. Shipping an ISO timestamp crashed the
               panel: the page's date helper splits on the hyphen and expects a
               bare Y-m-d, so the extra time part made an Invalid Date and Intl
               threw on it — a white screen with the whole record behind it. */
            ->where('selected.live.date', '2 Sep 2026')
            ->where('selected.live.syncedAt', '7 Sep 2026')
        );
});

it('says nothing when the link is not a post Performa follows', function () {
    $piece = Content::create([
        'title' => 'Artikel di situs sendiri',
        'channels' => ['web'],
        'pillar' => 'informasi',
        'type' => 'artikel',
        'status' => 'published',
        'scheduled_for' => Carbon::today(),
        'status_changed_at' => Carbon::today(),
        'url' => 'https://kisantra.com/artikel/batas-lapor-spt',
    ]);

    $this->get(route('content', ['bulan' => Carbon::today()->format('Y-m'), 'konten' => $piece->id]))
        ->assertInertia(fn ($page) => $page->where('selected.live', null));
});

it('leaves a photo without a play count rather than reporting nought', function () {
    igPost(['url' => 'https://www.instagram.com/p/PHOTO/', 'type' => 'Image', 'video_plays' => null]);

    $piece = Content::create([
        'title' => 'Foto',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'single_photo',
        'status' => 'published',
        'scheduled_for' => Carbon::today(),
        'status_changed_at' => Carbon::today(),
        'url' => 'https://www.instagram.com/p/PHOTO/',
    ]);

    $this->get(route('content', ['bulan' => Carbon::today()->format('Y-m'), 'konten' => $piece->id]))
        ->assertInertia(fn ($page) => $page->has('selected.live.counts', 2));
});
