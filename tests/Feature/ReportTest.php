<?php

use App\Models\Content;
use App\Models\Lead;
use App\Models\LeadStageEvent;
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
 | The one table that answers what the whole app is built around, read from the
 | lead's own content_id rather than guessed at.
 */
it('names the pieces that actually brought somebody in', function () {
    $piece = scheduled(['title' => 'Checklist dokumen pajak']);

    arrived(['content_id' => $piece->id, 'stage' => 'client']);
    arrived(['content_id' => $piece->id, 'stage' => 'proposal']);
    arrived(); // no content behind it

    $this->get(route('report', ['periode' => 'bulan', 'pada' => '2026-09-09']))
        ->assertInertia(fn ($page) => $page
            ->has('earning', 1)
            ->where('earning.0.title', 'Checklist dokumen pajak')
            ->where('earning.0.leads', 2)
            ->where('earning.0.clients', 1)
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
    scheduled(['title' => 'Checklist dokumen pajak', 'scheduled_for' => '2026-09-10', 'owner' => 'Sari']);
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
        ->and($body)->toContain('Sari');

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
