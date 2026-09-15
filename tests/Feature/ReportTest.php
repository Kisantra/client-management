<?php

use App\Models\Content;
use App\Models\InstagramPost;
use App\Models\InstagramProfile;
use App\Models\Lead;
use App\Models\LeadStageEvent;
use App\Models\TiktokPost;
use App\Models\TiktokProfile;
use App\Models\User;
use App\Support\Report;
use Illuminate\Support\Carbon;

beforeEach(function () {
    // A Wednesday in September, so the week has days on both sides of today.
    Carbon::setTestNow('2026-09-09 09:00:00');
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

function scheduled(array $attributes = []): Content
{
    return Content::create([
        'title' => 'Konten '.fake()->unique()->numberBetween(1, 99999),
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'status' => 'review',
        'owner' => 'Sari',
        'scheduled_for' => '2026-09-10',
        'status_changed_at' => '2026-09-01',
        ...$attributes,
    ]);
}

function arrived(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Bumi '.fake()->unique()->numberBetween(1, 99999),
        'pic' => 'Dewi',
        'channel' => 'instagram',
        'service' => 'PPh Badan',
        'stage' => 'lead',
        'value' => 10_000_000,
        'entered_at' => '2026-09-05',
        'stage_changed_at' => '2026-09-05',
        'last_contact_at' => '2026-09-05',
        'stalled_at' => '2026-09-20',
        ...$attributes,
    ]);
}

function postedOnInstagram(InstagramProfile $profile, string $on, int $likes, array $attributes = []): InstagramPost
{
    $code = 'IG'.fake()->unique()->numberBetween(1, 999999);

    return InstagramPost::create([
        'instagram_profile_id' => $profile->id,
        'short_code' => $code,
        'type' => 'Video',
        'product_type' => 'clips',
        'caption' => 'Konten pajak',
        'url' => 'https://www.instagram.com/p/'.($attributes['short_code'] ?? $code).'/',
        'likes' => $likes,
        'comments' => 0,
        'posted_at' => $on,
        'fetched_at' => '2026-09-09 08:00:00',
        ...$attributes,
    ]);
}

function postedOnTiktok(TiktokProfile $profile, string $on, int $likes): TiktokPost
{
    $id = 'TT'.fake()->unique()->numberBetween(1, 999999);

    return TiktokPost::create([
        'tiktok_profile_id' => $profile->id,
        'post_id' => $id,
        'caption' => 'Video pajak',
        'url' => 'https://www.tiktok.com/@kisantra.official/video/'.$id,
        'likes' => $likes,
        'comments' => 0,
        'plays' => 500,
        'shares' => 0,
        'saves' => 0,
        'is_slideshow' => false,
        'posted_at' => $on,
        'fetched_at' => '2026-09-09 08:00:00',
    ]);
}

test('guests are sent to the login page', function () {
    auth()->logout();
    $this->get(route('report'))->assertRedirect(route('login'));
});

it('names the month and the week it counted', function () {
    expect(Report::make('bulan', '2026-09-09')->label())->toBe('September 2026')
        ->and(Report::make('minggu', '2026-09-09')->label())->toBe('7–13 September 2026')
        // A week that straddles two months has to name both.
        ->and(Report::make('minggu', '2026-10-01')->label())->toBe('28 September–4 Oktober 2026')
        ->and(Report::make('bulan', '2026-09-09')->slug())->toBe('2026-09');
});

/*
 | A count on its own says what happened. The same count beside the period
 | before it says whether that is normal, which is the only question anybody
 | opens a report to ask.
 */
it('sets every figure beside the same figure over the period before', function () {
    arrived(['entered_at' => '2026-09-05']);
    arrived(['entered_at' => '2026-09-06']);
    arrived(['entered_at' => '2026-08-10']);

    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('report')
            ->where('period.label', 'September 2026')
            ->where('previous.label', 'Agustus 2026')
            ->where('summary.0.key', 'leads')
            ->where('summary.0.value', 2)
            ->where('summary.0.was', 1)
        );
});

/*
 | The tiles draw the last six periods beside each figure, so the series has
 | to end in the period on screen and step back one period at a time — a week
 | report plotting months would draw a shape that means nothing.
 */
it('gives every figure the six periods ending in this one, oldest first', function () {
    arrived(['entered_at' => '2026-09-05']);
    arrived(['entered_at' => '2026-09-06']);
    arrived(['entered_at' => '2026-08-10']);
    arrived(['entered_at' => '2026-04-01']);
    // Seven months back: outside the window, and must not be counted.
    arrived(['entered_at' => '2026-03-15']);

    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->where('summary.0.series', [1, 0, 0, 0, 1, 2])
            ->has('summary.3.series', 6)
        );

    // Week of 7–13 September: the fifth and sixth fall in the week before it,
    // and 10 August is four weeks back.
    $this->get(route('report', ['periode' => 'minggu', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->where('summary.0.series', [0, 1, 0, 0, 2, 0])
        );
});

/*
 | Read from the stage history rather than from the lead's stage today: a
 | client won in July is not this month's work, and the lead row alone cannot
 | say when it happened.
 */
it('counts a client by the month it was won, not by what the lead is today', function () {
    $lead = arrived(['stage' => 'client', 'entered_at' => '2026-07-02']);

    LeadStageEvent::create([
        'lead_id' => $lead->id,
        'stage' => 'client',
        'entered_at' => '2026-07-20',
    ]);

    // July's report claims it.
    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-07-10']))
        ->assertInertia(fn ($page) => $page->where('summary.1.value', 1));

    // September's does not, even though the lead is a client today.
    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page->where('summary.1.value', 0));
});

it('counts a piece on two channels in both of them', function () {
    scheduled(['channels' => ['instagram', 'linkedin'], 'scheduled_for' => '2026-09-10']);
    scheduled(['channels' => ['instagram'], 'scheduled_for' => '2026-09-11']);

    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->has('channels', 2)
            ->where('channels.0.key', 'instagram')
            ->where('channels.0.planned', 2)
            ->where('channels.1.key', 'linkedin')
            ->where('channels.1.planned', 1)
        );
});

it('separates what went out from what slipped, per person', function () {
    scheduled(['owner' => 'Sari', 'scheduled_for' => '2026-09-01', 'status' => 'published']);
    scheduled(['owner' => 'Sari', 'scheduled_for' => '2026-09-02']); // past, not out
    scheduled(['owner' => 'Dimas', 'scheduled_for' => '2026-09-30']); // still ahead

    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->where('owners.0.name', 'Sari')
            ->where('owners.0.planned', 2)
            ->where('owners.0.published', 1)
            ->where('owners.0.late', 1)
            ->where('owners.1.name', 'Dimas')
            ->where('owners.1.late', 0)
        );
});

/*
 | The two accounts keep different books — TikTok counts shares and saves that
 | an Instagram scrape never sees — so the ranking is each post against its own
 | account's usual, not raw interactions against each other.
 */
it('ranks the period\'s posts by how far each rose above its own account', function () {
    $gram = InstagramProfile::create([
        'username' => config('services.apify.instagram.username'),
        'followers' => 10_000,
        'fetched_at' => '2026-09-09 08:00:00',
    ]);
    $tok = TiktokProfile::create([
        'username' => config('services.apify.tiktok.username'),
        'followers' => 2_000,
        'fetched_at' => '2026-09-09 08:00:00',
    ]);

    // The accounts' usual: Instagram 10, TikTok 100.
    foreach ([10, 10, 10] as $likes) {
        postedOnInstagram($gram, '2026-07-10', $likes);
    }
    foreach ([100, 100, 100] as $likes) {
        postedOnTiktok($tok, '2026-07-10', $likes);
    }

    // In September: an Instagram post at 4x its usual beats a TikTok clip at
    // 2x, even though the clip has five times the interactions.
    $reel = postedOnInstagram($gram, '2026-09-03', 40, ['short_code' => 'REEL1']);
    postedOnTiktok($tok, '2026-09-04', 200);
    postedOnInstagram($gram, '2026-09-05', 5);
    // August: another period entirely.
    postedOnInstagram($gram, '2026-08-30', 900);

    $piece = scheduled(['title' => 'Checklist SPT', 'status' => 'published']);
    $piece->links()->create(['channel' => 'instagram', 'url' => $reel->url]);
    arrived(['content_id' => $piece->id]);
    arrived(['content_id' => $piece->id]);

    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->has('top.posts', 3)
            ->where('top.posts.0.id', 'instagram:REEL1')
            ->where('top.posts.0.lift', 4)
            ->where('top.posts.0.interactions', 40)
            ->where('top.posts.0.href', '/performance/konten?platform=instagram&konten=REEL1')
            ->where('top.posts.0.content.title', 'Checklist SPT')
            ->where('top.posts.0.content.leads', 2)
            ->where('top.posts.1.platform', 'tiktok')
            ->where('top.posts.1.lift', 2)
            ->where('top.posts.1.content', null)
            ->where('top.posts.2.lift', 0.5)
            ->where('top.platforms.0.key', 'instagram')
            ->where('top.platforms.0.posts', 2)
            ->where('top.platforms.1.posts', 1)
        );
});

/*
 | Each group is read against its own account's typical post, as a median, so
 | a format is a winner only when its ordinary post beats the account's
 | ordinary post — not when one of its posts went far.
 */
it('says which kinds of content earn more than their account usually does', function () {
    $gram = InstagramProfile::create([
        'username' => config('services.apify.instagram.username'),
        'followers' => 10_000,
        'fetched_at' => '2026-09-09 08:00:00',
    ]);

    // The account's typical post: the median of 5,5,5,10,10,10,30,30,30 is 10.
    $reel = postedOnInstagram($gram, '2026-07-06 03:00:00', 30, ['video_duration' => 45, 'short_code' => 'R1']);
    // 20:00 UTC on a Friday is 03:00 on Saturday in Jakarta.
    postedOnInstagram($gram, '2026-07-10 20:00:00', 30, ['video_duration' => 45]);
    // The one post inside September.
    postedOnInstagram($gram, '2026-09-03 03:00:00', 30, ['video_duration' => 45]);

    foreach (range(1, 3) as $i) {
        postedOnInstagram($gram, '2026-07-06 03:00:00', 10, ['type' => 'Sidecar', 'product_type' => null]);
        postedOnInstagram($gram, '2026-07-06 03:00:00', 5, ['type' => 'Image', 'product_type' => null]);
    }

    // Pillar and type come from the calendar, so only a linked post has them.
    $piece = scheduled(['type' => 'short_video', 'pillar' => 'tips', 'status' => 'published']);
    $piece->links()->create(['channel' => 'instagram', 'url' => $reel->url]);

    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->where('patterns.baseline.0.typical', 10)
            ->where('patterns.all.posts', 9)
            ->where('patterns.all.linked', 1)
            // Format: ranked best first.
            ->where('patterns.all.dimensions.0.key', 'format')
            ->where('patterns.all.dimensions.0.groups.0.label', 'Reel')
            ->where('patterns.all.dimensions.0.groups.0.lift', 3)
            ->where('patterns.all.dimensions.0.groups.0.above', 3)
            ->where('patterns.all.dimensions.0.groups.1.label', 'Carousel')
            ->where('patterns.all.dimensions.0.groups.1.lift', 1)
            ->where('patterns.all.dimensions.0.groups.1.above', 0)
            ->where('patterns.all.dimensions.0.groups.2.label', 'Foto')
            ->where('patterns.all.dimensions.0.groups.2.lift', 0.5)
            // Length: only posts that have one.
            ->where('patterns.all.dimensions.1.posts', 3)
            ->where('patterns.all.dimensions.1.groups.0.label', '30–60 detik')
            // Calendar categories: the one linked post, and nothing guessed.
            ->where('patterns.all.dimensions.2.source', 'calendar')
            ->where('patterns.all.dimensions.2.posts', 1)
            ->where('patterns.all.dimensions.2.groups.0.label', 'Short Video')
            ->where('patterns.all.dimensions.3.groups.0.label', 'Tips')
            // Weekdays keep the week's order, in Jakarta time.
            ->where('patterns.all.dimensions.4.groups.0.label', 'Senin')
            ->where('patterns.all.dimensions.4.groups.1.label', 'Kamis')
            ->where('patterns.all.dimensions.4.groups.2.label', 'Sabtu')
            // The period scope reads September alone.
            ->where('patterns.period.posts', 1)
            ->where('patterns.period.dimensions.0.groups.0.label', 'Reel')
            ->where('patterns.since', 'Jul 2026')
        );
});

it('ranks nothing when Performa follows no account yet', function () {
    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->where('top.posts', [])
            ->where('top.platforms', [])
        );
});

it('says when a period has not finished counting', function () {
    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->where('period.open', true)
            /* Nowhere forward to step: a report of a month that has not begun
               counts nothing and reads as a fault. */
            ->where('steps.forward', null)
        );

    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-08-09']))
        ->assertInertia(fn ($page) => $page
            ->where('period.open', false)
            ->where('steps.forward', '2026-09-01')
        );
});

it('exports the period rows as a spreadsheet can read them', function () {
    $piece = scheduled(['title' => 'Checklist dokumen pajak', 'scheduled_for' => '2026-09-10', 'owner' => 'Sari']);
    $piece->links()->create(['channel' => 'instagram', 'url' => 'https://www.instagram.com/p/CEK1/']);
    arrived(['company' => 'Bumi Mandiri', 'entered_at' => '2026-09-05']);

    $konten = $this->get(route('report.export', ['part' => 'konten', 'periode' => 'bulan', 'pada' => '2026-09-09']));
    $konten->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=UTF-8')
        ->assertDownload('kisantra-konten-2026-09.csv');

    $body = $konten->streamedContent();

    /* Excel reads a UTF-8 file as the local codepage without the mark, and
       every accented name arrives as mojibake. */
    expect($body)->toStartWith("\xEF\xBB\xBF")
        ->and($body)->toContain('Tanggal tayang')
        ->and($body)->toContain('Checklist dokumen pajak')
        ->and($body)->toContain('Sari')
        ->and($body)->toContain('https://www.instagram.com/p/CEK1/');

    $lead = $this->get(route('report.export', ['part' => 'lead', 'periode' => 'bulan', 'pada' => '2026-09-09']));
    $lead->assertOk()->assertDownload('kisantra-lead-2026-09.csv');

    expect($lead->streamedContent())->toContain('PT Bumi Mandiri');
});

it('exports the week under its own date range', function () {
    scheduled(['scheduled_for' => '2026-09-10']);

    $this->get(route('report.export', ['part' => 'konten', 'periode' => 'minggu', 'pada' => '2026-09-09']))
        ->assertOk()
        ->assertDownload('kisantra-konten-2026-09-07-sd-2026-09-13.csv');
});

it('refuses a part it does not have', function () {
    $this->get('/laporan/ekspor/rahasia')->assertNotFound();
});

it('says so rather than sending an empty file', function () {
    $body = $this->get(route('report.export', ['part' => 'lead', 'periode' => 'bulan', 'pada' => '2026-01-09']))
        ->assertOk()
        ->streamedContent();

    expect($body)->toContain('Tidak ada data pada periode ini');
});
