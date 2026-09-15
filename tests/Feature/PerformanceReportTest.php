<?php

use App\Models\Content;
use App\Models\InstagramPost;
use App\Models\InstagramProfile;
use App\Models\Lead;
use App\Models\LeadStageEvent;
use App\Models\TiktokPost;
use App\Models\TiktokProfile;
use App\Models\User;
use App\Support\Deepseek;
use App\Support\LeadsReport;
use App\Support\PerformanceReport;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    /* A Thursday ten days into September, so the closing month of a report
       ending in September is genuinely still running. */
    Carbon::setTestNow(Carbon::parse('2026-09-10 09:00:00'));
    $this->actingAs(User::factory()->create(['name' => 'Admin']));

    config()->set('services.deepseek.key', null);
});

afterEach(fn () => Carbon::setTestNow());

function gramAccount(array $attributes = []): InstagramProfile
{
    return InstagramProfile::create([
        'username' => config('services.apify.instagram.username'),
        'full_name' => 'Kisantra',
        'followers' => 10_000,
        'follows' => 120,
        'posts_count' => 400,
        'fetched_at' => Carbon::parse('2026-09-09 08:00:00'),
        ...$attributes,
    ]);
}

function gramReel(InstagramProfile $profile, string $on, int $likes, int $comments, array $attributes = []): InstagramPost
{
    return InstagramPost::create([
        'instagram_profile_id' => $profile->id,
        'short_code' => 'IG'.fake()->unique()->numberBetween(1, 999999),
        'type' => 'Video',
        'product_type' => 'clips',
        'caption' => 'Konten pajak',
        'url' => 'https://www.instagram.com/p/'.fake()->unique()->numberBetween(1, 999999).'/',
        'likes' => $likes,
        'comments' => $comments,
        'video_plays' => 1_000,
        'posted_at' => Carbon::parse($on),
        'fetched_at' => Carbon::parse('2026-09-09 08:00:00'),
        ...$attributes,
    ]);
}

function tokAccount(array $attributes = []): TiktokProfile
{
    return TiktokProfile::create([
        'username' => config('services.apify.tiktok.username'),
        'nickname' => 'Kisantra',
        'followers' => 2_000,
        'following' => 30,
        'videos_count' => 90,
        'fetched_at' => Carbon::parse('2026-09-09 08:00:00'),
        ...$attributes,
    ]);
}

function tokClip(TiktokProfile $profile, string $on, int $likes, array $attributes = []): TiktokPost
{
    return TiktokPost::create([
        'tiktok_profile_id' => $profile->id,
        'post_id' => 'TT'.fake()->unique()->numberBetween(1, 999999),
        'caption' => 'Video pajak',
        'url' => 'https://www.tiktok.com/@kisantra.official/video/'.fake()->unique()->numberBetween(1, 999999),
        'likes' => $likes,
        'comments' => 1,
        'plays' => 500,
        'shares' => 2,
        'saves' => 1,
        'is_slideshow' => false,
        'posted_at' => Carbon::parse($on),
        'fetched_at' => Carbon::parse('2026-09-09 08:00:00'),
        ...$attributes,
    ]);
}

/** A lead that came in during the window, unless told otherwise. */
function arrivedLead(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Bumi '.fake()->unique()->numberBetween(1, 99999),
        'pic' => 'Dewi',
        'channel' => 'instagram',
        'service' => 'PPh Badan',
        'stage' => 'lead',
        'owner' => 'Sari',
        'value' => 10_000_000,
        'entered_at' => '2026-08-01',
        'stage_changed_at' => '2026-08-01',
        'last_contact_at' => '2026-08-01',
        'stalled_at' => '2026-09-20',
        ...$attributes,
    ]);
}

/** The quarter every leads test reads: Juli–September 2026. */
function quarter(): LeadsReport
{
    return LeadsReport::between(
        CarbonImmutable::parse('2026-07-01'),
        CarbonImmutable::parse('2026-09-30'),
    );
}

test('guests are sent to the login page', function () {
    auth()->logout();
    $this->get(route('report.performance'))->assertRedirect(route('login'));
});

it('names the months it covers and counts only the posts inside them', function () {
    $profile = gramAccount();

    gramReel($profile, '2026-07-05', 10, 2);
    gramReel($profile, '2026-08-05', 10, 2);
    // Before the window opens: not this report's business.
    gramReel($profile, '2026-05-05', 900, 900);

    $facts = PerformanceReport::make('2026-09', 3)->toArray();

    expect($facts['period']['label'])->toBe('Juli–September 2026')
        ->and($facts['period']['from'])->toBe('2026-07-01')
        ->and($facts['period']['to'])->toBe('2026-09-30')
        ->and($facts['combined']['posts'])->toBe(2)
        ->and($facts['combined']['interactions'])->toBe(24);
});

/*
 | One post can carry more interactions than the fifty around it put together.
 | The middle post is what the team actually publishes; the mean describes the
 | outlier. Both are reported, and the gap between them is the finding.
 */
it('reports the middle post rather than the average one', function () {
    $profile = gramAccount();

    foreach (range(1, 5) as $day) {
        gramReel($profile, '2026-08-0'.$day, 10, 0);
    }

    gramReel($profile, '2026-08-20', 5_000, 0);

    $platform = collect(PerformanceReport::make('2026-09', 3)->toArray()['platforms'])
        ->firstWhere('key', 'instagram');

    expect($platform['typical']['interactions'])->toBe(10.0)
        ->and($platform['average']['interactions'])->toBe(841.7)
        // A mean eighty times the middle post is not a statistic, it is a warning.
        ->and($platform['average']['skew'])->toBe(84.17)
        ->and($platform['outlier']['times'])->toBe(500.0)
        ->and($platform['outlier']['share'])->toBe(99);
});

/*
 | Instagram shows a post to its followers; TikTok shows it to whoever the For
 | You page decides. Dividing by the same denominator would report a rate over
 | a thousand per cent on one of them, so the two are never added together.
 */
it('keeps each platform on its own denominator and refuses to combine them', function () {
    $ig = gramAccount(['followers' => 1_000]);
    $tt = tokAccount();

    gramReel($ig, '2026-08-05', 10, 0);
    tokClip($tt, '2026-08-05', 10);

    $facts = PerformanceReport::make('2026-09', 3)->toArray();
    $platforms = collect($facts['platforms']);

    expect($platforms->firstWhere('key', 'instagram')['engagement']['basis'])->toBe('pengikut')
        ->and($platforms->firstWhere('key', 'tiktok')['engagement']['basis'])->toBe('pemutaran')
        // Posts and interactions add up across accounts; rates do not appear.
        ->and($facts['combined']['posts'])->toBe(2)
        ->and($facts['combined'])->not->toHaveKey('engagement');
});

/*
 | A chart that silently drops a quiet month draws a straight line through a
 | gap and calls it steady.
 */
it('keeps a month with nothing in it on the chart', function () {
    $profile = gramAccount();

    gramReel($profile, '2026-07-05', 10, 0);
    gramReel($profile, '2026-09-05', 10, 0);

    $months = PerformanceReport::make('2026-09', 3)->toArray()['months'];

    expect($months)->toHaveCount(3)
        ->and($months[1]['label'])->toBe('Agu')
        ->and($months[1]['posts'])->toBe(0)
        ->and($months[1]['interactions'])->toBe(0);
});

/*
 | A report taken on the tenth reads its closing month against three whole
 | ones. Unsaid, the last column of every chart looks like a collapse.
 */
it('says when the closing month is still running', function () {
    gramAccount();

    $open = PerformanceReport::make('2026-09', 3)->toArray();

    expect($open['period']['open'])->toBeTrue()
        ->and($open['period']['elapsed'])->toBe(['days' => 10, 'of' => 30])
        ->and($open['period']['lastMonth'])->toBe('September')
        ->and(collect($open['months'])->firstWhere('key', '2026-09')['partial'])->toBeTrue()
        ->and(collect($open['months'])->firstWhere('key', '2026-07')['partial'])->toBeFalse();

    // A window that has finished says nothing of the kind.
    $closed = PerformanceReport::make('2026-08', 3)->toArray();

    expect($closed['period']['open'])->toBeFalse()
        ->and($closed['period']['elapsed'])->toBeNull();
});

/*
 | Manrope carries Latin and nothing else, so a caption full of emoji arrives
 | on paper as a row of black boxes — which reads as a rendering fault rather
 | than as a caption.
 */
it('strips from captions what the printed page cannot set', function () {
    $profile = gramAccount();

    gramReel($profile, '2026-08-05', 10, 0, [
        'caption' => "‼️ GIVEAWAY 🇦🇷 vs 🇪🇸 — hadiah 💸\n\nikuti caranya",
    ]);

    $top = collect(PerformanceReport::make('2026-09', 3)->toArray()['platforms'])
        ->firstWhere('key', 'instagram')['top'][0];

    expect($top['caption'])->toBe('GIVEAWAY vs — hadiah ikuti caranya');
});

it('states what the publishing was for, from the same window', function () {
    gramAccount();

    Content::create([
        'title' => 'Checklist dokumen pajak',
        'channels' => ['instagram'],
        'type' => 'carousel',
        'status' => Content::PUBLISHED,
        'scheduled_for' => '2026-08-10',
        'published_at' => '2026-08-10',
        'status_changed_at' => '2026-08-10',
    ]);

    Lead::create([
        'entity' => 'PT', 'company' => 'Bumi Mandiri', 'pic' => 'Dewi',
        'channel' => 'instagram', 'service' => 'PPh Badan', 'stage' => 'client',
        'value' => 10_000_000, 'entered_at' => '2026-08-12',
        'stage_changed_at' => '2026-08-12', 'last_contact_at' => '2026-08-12',
        'stalled_at' => '2026-09-20',
    ]);

    $business = PerformanceReport::make('2026-09', 3)->toArray()['business'];

    expect($business['publishedContent'])->toBe(1)
        ->and($business['leads'])->toBe(1)
        ->and($business['clients'])->toBe(1);
});

it('shows the figures first and fetches the reading separately', function () {
    gramAccount();

    $this->get(route('report.performance'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('performance-report')
            ->has('report.period')
            ->has('report.platforms', 2)
            ->where('analysisAvailable', false)
            /* The reading is a call to somebody else's server; the numbers
               are the report and must not wait behind it. */
            ->missing('analysis')
        );
});

it('hands over a PDF named for the period it covers', function () {
    $profile = gramAccount();
    gramReel($profile, '2026-08-05', 10, 2);

    $response = $this->get(route('report.performance.pdf', ['bulan' => 3, 'sampai' => '2026-09']));

    $response->assertOk()
        ->assertHeader('content-type', 'application/pdf')
        ->assertDownload('kisantra-laporan-2026-07_2026-09.pdf');

    $body = $response->streamedContent();

    expect($body)->toStartWith('%PDF-')
        // The document is set in the product's own face, not the renderer's.
        ->and($body)->toContain('Manrope');
});

/*
 | The model reads figures; it never supplies one. With no key, no network or
 | no patience, the report is still the whole report.
 */
it('renders in full when the analysis cannot be had', function () {
    config()->set('services.deepseek.key', 'sk-test');
    Http::fake(['api.deepseek.com/*' => Http::response('', 500)]);
    cache()->flush();

    $profile = gramAccount();
    gramReel($profile, '2026-08-05', 10, 2);

    $response = $this->get(route('report.performance.pdf', ['bulan' => 3, 'sampai' => '2026-09']));

    expect($response->streamedContent())->toStartWith('%PDF-');
});

it('sends the model figures and keeps only an answer in the shape it asked for', function () {
    config()->set('services.deepseek.key', 'sk-test');
    cache()->flush();

    Http::fake([
        'api.deepseek.com/*' => Http::response([
            'choices' => [[
                'message' => [
                    'content' => json_encode([
                        'ringkasan' => 'Interaksi terpusat pada satu post.',
                        'temuan' => [
                            ['judul' => 'Satu post mendominasi', 'isi' => 'Sebagian besar interaksi dari satu carousel.'],
                            ['isi' => 'Tanpa judul, jadi dibuang.'],
                        ],
                        'rekomendasi' => [['judul' => 'Naikkan volume', 'isi' => 'Tiga post seminggu.']],
                        'risiko' => '',
                        'ngarang' => 'harus diabaikan',
                    ]),
                ],
            ]],
        ]),
    ]);

    gramAccount();

    $reading = Deepseek::make()->read(PerformanceReport::make('2026-09', 3)->toArray());

    expect($reading['ringkasan'])->toBe('Interaksi terpusat pada satu post.')
        // An entry with no heading is not a finding, it is noise.
        ->and($reading['temuan'])->toHaveCount(1)
        ->and($reading['rekomendasi'])->toHaveCount(1)
        // An empty risk is no risk, not an empty paragraph on the page.
        ->and($reading['risiko'])->toBeNull()
        ->and($reading)->not->toHaveKey('ngarang');

    /* What went out: the computed figures, and an instruction not to invent
       any. Captions and links are deliberately not among them. */
    Http::assertSent(function ($request) {
        $body = json_encode($request->data());

        return str_contains($body, 'Jangan menghitung')
            && str_contains($body, 'post_terukur')
            && ! str_contains($body, 'caption');
    });
});

/*
 | ── Bagian I · Leads ──────────────────────────────────────────────────────
 |
 | The pipeline half of the document. Its whole difficulty is that two obvious
 | measures answer different questions, and mixing them produces a ratio with
 | no meaning: the leads that arrived in a window, and the leads that were won
 | in it — almost none of whom arrived in it.
 */
it('dates a win by the move, not by where the lead stands today', function () {
    $old = arrivedLead(['company' => 'Lama', 'entered_at' => '2026-02-01', 'stage' => 'client']);
    $new = arrivedLead(['company' => 'Baru', 'entered_at' => '2026-08-01', 'stage' => 'kontak']);

    // Signed in August, though it arrived in February.
    LeadStageEvent::create(['lead_id' => $old->id, 'stage' => 'client', 'entered_at' => '2026-08-15']);
    LeadStageEvent::create(['lead_id' => $new->id, 'stage' => 'kontak', 'entered_at' => '2026-08-05']);

    $leads = quarter()->toArray();

    expect($leads['summary']['arrived'])->toBe(1)
        // The February lead is not an arrival here, but its win is.
        ->and($leads['summary']['wonInWindow'])->toBe(1)
        // And nobody who arrived in the window has reached Client yet.
        ->and($leads['summary']['wonFromCohort'])->toBe(0);
});

it('follows one cohort down the funnel rather than photographing the board', function () {
    $reached = arrivedLead(['company' => 'Sampai proposal', 'entered_at' => '2026-07-05', 'stage' => 'proposal']);
    LeadStageEvent::create(['lead_id' => $reached->id, 'stage' => 'kontak', 'entered_at' => '2026-07-08']);
    LeadStageEvent::create(['lead_id' => $reached->id, 'stage' => 'proposal', 'entered_at' => '2026-07-20']);

    /* Closed at Kontak: the row keeps the stage it died at, and the history
       says it got there. */
    arrivedLead([
        'company' => 'Gugur di kontak',
        'entered_at' => '2026-07-06',
        'stage' => 'kontak',
        'status' => Lead::CLOSED,
        'closed_reason' => 'hilang_kontak',
    ]);

    arrivedLead(['company' => 'Diam di lead', 'entered_at' => '2026-07-07']);

    $funnel = collect(quarter()->toArray()['funnel']);

    expect($funnel->firstWhere('key', 'lead')['count'])->toBe(3)
        ->and($funnel->firstWhere('key', 'kontak')['count'])->toBe(2)
        ->and($funnel->firstWhere('key', 'proposal')['count'])->toBe(1)
        ->and($funnel->firstWhere('key', 'client')['count'])->toBe(0)
        // One fell away between Lead and Kontak.
        ->and($funnel->firstWhere('key', 'kontak')['dropped'])->toBe(1)
        // The first stage has nothing behind it to have fallen from.
        ->and($funnel->firstWhere('key', 'lead')['dropped'])->toBeNull();
});

/*
 | Arrivals and wins are counted over different populations, so the tables that
 | show both must never divide one into the other.
 */
it('never divides this window arrivals into this window wins', function () {
    $won = arrivedLead(['company' => 'Menang', 'entered_at' => '2026-01-05', 'stage' => 'client']);
    LeadStageEvent::create(['lead_id' => $won->id, 'stage' => 'client', 'entered_at' => '2026-08-10']);

    arrivedLead(['company' => 'Baru masuk', 'entered_at' => '2026-08-02']);

    $leads = quarter()->toArray();
    $source = collect($leads['sources'])->firstWhere('key', 'instagram');
    $owner = collect($leads['owners'])->firstWhere('name', 'Sari');

    expect($source['leads'])->toBe(1)
        ->and($source['clients'])->toBe(1)
        // A conversion column across two populations would be a lie; there is none.
        ->and($source)->not->toHaveKey('conversion')
        ->and($owner['leads'])->toBe(1)
        ->and($owner['clients'])->toBe(1)
        ->and($owner)->not->toHaveKey('conversion');
});

it('measures how long each step takes as a middle, not a mean', function () {
    foreach ([3, 5, 40] as $at => $days) {
        $lead = arrivedLead(['company' => 'Lead '.$at, 'entered_at' => '2026-07-01']);

        LeadStageEvent::create([
            'lead_id' => $lead->id,
            'stage' => 'kontak',
            'entered_at' => Carbon::parse('2026-07-01')->addDays($days),
        ]);
    }

    $speed = quarter()->toArray()['speed'];

    // The middle is 5; the mean would be 16 and describe nobody.
    expect($speed['toContact'])->toBe(5.0)
        // Nobody reached Client, and that is a real answer rather than a zero.
        ->and($speed['toClient'])->toBeNull();
});

it('binds both parts into one document, and one download', function () {
    $profile = gramAccount();
    gramReel($profile, '2026-08-05', 10, 2);
    arrivedLead(['entered_at' => '2026-08-02']);

    $this->get(route('report.performance'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('performance-report')
            ->has('report.platforms', 2)
            ->has('report.leads.funnel', 6)
            ->where('report.leads.summary.arrived', 1)
        );

    $response = $this->get(route('report.performance.pdf', ['bulan' => 3, 'sampai' => '2026-09']));

    $response->assertOk()->assertDownload('kisantra-laporan-2026-07_2026-09.pdf');

    expect($response->streamedContent())->toStartWith('%PDF-');
});
