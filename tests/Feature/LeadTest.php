<?php

use App\Models\Lead;
use App\Models\LeadFollowUp;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

beforeEach(function () {
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
    Storage::fake('public');
});

/** A lead sitting well inside its stage's tolerance. */
function lead(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Sinar Rejeki',
        'pic' => 'Dewi Wijaya',
        'channel' => 'instagram',
        'source' => 'Batas Lapor SPT Badan',
        'service' => 'PPh Badan',
        'value' => 40_000_000,
        'stage' => 'lead',
        'entered_at' => Carbon::today()->subDays(3),
        'stage_changed_at' => Carbon::today()->subDays(3),
        'last_contact_at' => Carbon::today()->subDays(3),
        ...$attributes,
    ]);
}

it('lists leads with stage counts and totals', function () {
    lead();
    lead(['company' => 'Bumi Artha', 'stage' => 'deal', 'value' => 10_000_000]);

    $this->get(route('leads'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('leads')
            ->where('totals.count', 2)
            ->where('totals.value', 50_000_000)
            ->has('rows.data', 2)
            ->where('stages.0.key', 'lead')
            ->where('stages.0.count', 1)
        );
});

it('marks a lead stalled once it passes its stage tolerance', function () {
    // Deal tolerates five days; this one has sat for eight.
    lead(['stage' => 'deal', 'stage_changed_at' => Carbon::today()->subDays(8)]);
    lead(['company' => 'Bumi Artha']);

    expect(Lead::stalled()->count())->toBe(1);

    $this->get(route('leads', ['status' => 'mandek']))
        ->assertInertia(fn ($page) => $page
            ->has('rows.data', 1)
            ->where('rows.data.0.stalled', true)
            ->where('rows.data.0.threshold', 5)
            ->where('rows.data.0.daysInStage', 8)
        );
});

it('filters by stage, channel, search and entry date', function () {
    lead();
    lead(['company' => 'Bumi Artha', 'channel' => 'tiktok', 'stage' => 'proposal']);
    lead([
        'company' => 'Nusa Jaya',
        'entered_at' => Carbon::today()->subDays(200),
        'stage_changed_at' => Carbon::today()->subDays(200),
    ]);

    $this->get(route('leads', ['tahap' => 'proposal']))
        ->assertInertia(fn ($page) => $page->has('rows.data', 1));

    $this->get(route('leads', ['channel' => 'tiktok']))
        ->assertInertia(fn ($page) => $page->has('rows.data', 1));

    $this->get(route('leads', ['q' => 'nusa']))
        ->assertInertia(fn ($page) => $page->where('rows.data.0.company', 'PT Nusa Jaya'));

    $this->get(route('leads', ['dari' => Carbon::today()->subDays(7)->toDateString()]))
        ->assertInertia(fn ($page) => $page->has('rows.data', 2));
});

it('serves the board as columns with database totals', function () {
    lead();
    lead(['company' => 'Bumi Artha', 'stage' => 'deal', 'value' => 5_000_000]);

    $this->get(route('leads', ['view' => 'papan', 'tahap' => 'lead']))
        ->assertInertia(fn ($page) => $page
            ->where('rows', null)
            ->has('columns', 6)
            // The stage filter is ignored on the board: every column shows.
            ->where('columns.4.key', 'deal')
            ->where('columns.4.count', 1)
            ->where('columns.4.value', 5_000_000)
            ->has('columns.4.rows', 1)
        );
});

it('stores a lead with its history and first note', function () {
    $this->post(route('leads.store'), [
        'entity' => 'CV',
        'company' => 'Karya Makmur',
        'pic' => 'Budi Santoso',
        'channel' => 'whatsapp',
        'source' => 'Chat langsung',
        'service' => 'Pendampingan pemeriksaan pajak',
        'value' => 25_000_000,
        'stage' => 'kontak',
        'entered_at' => Carbon::today()->subDay()->toDateString(),
        'note' => 'Menanyakan biaya pendampingan.',
        'files' => [UploadedFile::fake()->image('chat.png')],
    ])->assertRedirect();

    $lead = Lead::firstWhere('company', 'Karya Makmur');

    expect($lead->displayName())->toBe('CV Karya Makmur')
        ->and($lead->stage)->toBe('kontak')
        // Kontak is the second stage, so both stages before it are on record.
        ->and($lead->stageEvents)->toHaveCount(2)
        ->and($lead->notes)->toHaveCount(1)
        ->and($lead->attachments)->toHaveCount(1);

    Storage::disk('public')->assertExists($lead->attachments->first()->path);
});

it('rejects a lead without the four facts it cannot do without', function () {
    $this->post(route('leads.store'), ['entity' => 'PT'])
        ->assertSessionHasErrors(['company', 'pic', 'channel', 'service', 'entered_at']);
});

it('refuses a gated stage move with no document', function () {
    $lead = lead();

    $this->post(route('leads.stage.store', $lead), ['stage' => 'proposal'])
        ->assertSessionHasErrors('files');

    expect($lead->fresh()->stage)->toBe('lead');
});

it('accepts a gated stage move that carries its document', function () {
    $lead = lead();

    $this->post(route('leads.stage.store', $lead), [
        'stage' => 'proposal',
        'files' => [UploadedFile::fake()->create('proposal.pdf', 120, 'application/pdf')],
    ])->assertRedirect();

    $lead->refresh();

    expect($lead->stage)->toBe('proposal')
        ->and($lead->stage_changed_at->toDateString())->toBe(Carbon::today()->toDateString())
        ->and($lead->stalled_at->toDateString())
        ->toBe(Carbon::today()->addDays(21)->toDateString())
        ->and($lead->stageEvents->last()->stage)->toBe('proposal')
        ->and($lead->notes->first()->attachments)->toHaveCount(1);
});

it('moves through an ungated stage without a document', function () {
    $lead = lead();

    $this->post(route('leads.stage.store', $lead), ['stage' => 'konsultasi'])
        ->assertRedirect();

    expect($lead->fresh()->stage)->toBe('konsultasi');
});

it('will not move a lead to the stage it is already in', function () {
    $lead = lead();

    $this->post(route('leads.stage.store', $lead), ['stage' => 'lead'])
        ->assertSessionHasErrors('stage');
});

it('takes a note as text, as files, or both — but not empty', function () {
    $lead = lead();

    $this->post(route('leads.notes.store', $lead), ['body' => ''])
        ->assertSessionHasErrors('body');

    $this->post(route('leads.notes.store', $lead), [
        'files' => [UploadedFile::fake()->image('kartu-nama.png')],
    ])->assertRedirect();

    expect($lead->notes()->count())->toBe(1)
        ->and($lead->attachments()->count())->toBe(1);
});

it('schedules a follow-up and records the contact when it is done', function () {
    $lead = lead();

    $this->post(route('leads.follow-ups.store', $lead), [
        'scheduled_for' => Carbon::today()->toDateString(),
        'via' => 'WhatsApp',
        'note' => 'Menanyakan kelanjutan.',
    ])->assertRedirect();

    $followUp = LeadFollowUp::firstOrFail();

    expect($lead->fresh()->last_contact_at->toDateString())
        ->toBe(Carbon::today()->subDays(3)->toDateString());

    $this->patch(route('leads.follow-ups.update', [$lead, $followUp]), ['done' => true])
        ->assertRedirect();

    expect($followUp->fresh()->done)->toBeTrue()
        ->and($lead->fresh()->last_contact_at->toDateString())
        ->toBe(Carbon::today()->toDateString());
});

it('refuses a follow-up scheduled in the past', function () {
    $lead = lead();

    $this->post(route('leads.follow-ups.store', $lead), [
        'scheduled_for' => Carbon::today()->subDay()->toDateString(),
        'via' => 'WhatsApp',
    ])->assertSessionHasErrors('scheduled_for');
});

it('shows a lead with its journey, notes and follow-ups', function () {
    $lead = lead();

    $this->post(route('leads.stage.store', $lead), ['stage' => 'kontak']);

    $this->get(route('leads.show', $lead))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('lead-detail')
            ->where('lead.company', 'PT Sinar Rejeki')
            ->where('lead.stage', 'kontak')
            ->has('timeline', 1)
            ->where('timeline.0.current', true)
        );
});

it('edits a lead and records the move when its stage changes', function () {
    $lead = lead();

    $this->get(route('leads.edit', $lead))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('lead-edit')->where('lead.company', 'Sinar Rejeki'));

    $this->post(route('leads.update', $lead), [
        'entity' => 'PT',
        'company' => 'Sinar Rejeki',
        'pic' => 'Dewi Wijaya',
        'channel' => 'instagram',
        'service' => 'PPN',
        'value' => 60_000_000,
        'stage' => 'konsultasi',
        'entered_at' => $lead->entered_at->toDateString(),
    ])->assertRedirect(route('leads.show', $lead));

    $lead->refresh();

    expect($lead->service)->toBe('PPN')
        ->and($lead->value)->toBe(60_000_000)
        ->and($lead->stage)->toBe('konsultasi')
        ->and($lead->stageEvents->last()->stage)->toBe('konsultasi');
});

it('counts leads for the dashboard from the leads themselves', function () {
    /*
     | The tile counts this month, and the helper enters a lead three days
     | ago, so on the first days of a month every lead here would land in the
     | previous one and the count would read zero. The clock is pinned mid
     | month so the test measures the counting, not the calendar.
     */
    Carbon::setTestNow('2026-08-20');

    lead();
    lead(['company' => 'Bumi Artha', 'stage' => 'client']);
    lead(['company' => 'Nusa Jaya', 'stage' => 'deal', 'stage_changed_at' => Carbon::today()->subDays(9)]);

    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('summary.leads.value', 3)
            ->where('summary.activeClients.value', 1)
            ->where('summary.stalled.value', 1)
            ->where('summary.stalled.worstStage', 'Deal')
            ->has('pipeline', 6)
            ->has('monthlyLeads', 12)
        );

    Carbon::setTestNow();
});

it('loads more cards into one board column on request', function () {
    foreach (range(1, 25) as $i) {
        lead(['company' => 'Client '.$i]);
    }

    $this->get(route('leads', ['view' => 'papan']))
        ->assertInertia(fn ($page) => $page
            ->where('columns.0.count', 25)
            ->has('columns.0.rows', 20)
        );

    $this->get(route('leads', ['view' => 'papan', 'kolom' => 'lead', 'per' => 40]))
        ->assertInertia(fn ($page) => $page
            ->where('columns.0.count', 25)
            ->has('columns.0.rows', 25)
        );
});

it('closes a lead without moving it, and stops its clock', function () {
    $lead = lead(['stage' => 'proposal', 'stage_changed_at' => Carbon::today()->subDays(30)]);

    expect($lead->isStalled())->toBeTrue();

    $this->post(route('leads.closure.store', $lead), [
        'reason' => 'hilang_kontak',
        'note' => 'Tiga kali dihubungi, tidak dibalas.',
    ])->assertRedirect();

    $lead->refresh();

    expect($lead->status)->toBe(Lead::CLOSED)
        // The stage it died at is the whole point of keeping the record.
        ->and($lead->stage)->toBe('proposal')
        ->and($lead->closed_at->toDateString())->toBe(Carbon::today()->toDateString())
        ->and($lead->isStalled())->toBeFalse()
        ->and($lead->daysInStage())->toBe(30);

    // And tomorrow it still says 30, because nobody is ignoring it any more.
    Carbon::setTestNow(Carbon::now()->addDays(5));
    expect($lead->fresh()->daysInStage())->toBe(30);
    Carbon::setTestNow();
});

it('will not close a lead for a reason it does not know', function () {
    $lead = lead();

    $this->post(route('leads.closure.store', $lead), ['reason' => 'bosan'])
        ->assertSessionHasErrors('reason');

    expect($lead->fresh()->status)->toBe(Lead::ACTIVE);
});

it('keeps closed leads off the board and out of the stalled count', function () {
    lead(['stage' => 'deal', 'stage_changed_at' => Carbon::today()->subDays(9)]);
    $dead = lead(['company' => 'Bumi Artha', 'stage' => 'deal', 'stage_changed_at' => Carbon::today()->subDays(9)]);

    expect(Lead::stalled()->count())->toBe(2);

    $this->post(route('leads.closure.store', $dead), ['reason' => 'ditolak']);

    expect(Lead::stalled()->count())->toBe(1);

    $this->get(route('leads'))
        ->assertInertia(fn ($page) => $page
            ->where('totals.count', 1)
            ->where('closedCount', 1)
            ->where('stages.4.count', 1)
        );

    $this->get(route('leads', ['view' => 'papan']))
        ->assertInertia(fn ($page) => $page->where('columns.4.count', 1));
});

it('shows what stopped, filtered by the stage it stopped at', function () {
    $one = lead(['stage' => 'proposal']);
    $two = lead(['company' => 'Bumi Artha', 'stage' => 'kontak']);
    lead(['company' => 'Nusa Jaya']);

    $this->post(route('leads.closure.store', $one), ['reason' => 'ditolak']);
    $this->post(route('leads.closure.store', $two), ['reason' => 'belum_butuh']);

    $this->get(route('leads', ['tampil' => 'tutup']))
        ->assertInertia(fn ($page) => $page
            ->where('totals.count', 2)
            ->where('rows.data.0.status', Lead::CLOSED)
        );

    $this->get(route('leads', ['tampil' => 'tutup', 'tahap' => 'proposal']))
        ->assertInertia(fn ($page) => $page
            ->has('rows.data', 1)
            ->where('rows.data.0.company', 'PT Sinar Rejeki')
            ->where('rows.data.0.closedReason', 'Ditolak')
        );

    // The board is for work in progress, so asking for it falls back to a list.
    $this->get(route('leads', ['tampil' => 'tutup', 'view' => 'papan']))
        ->assertInertia(fn ($page) => $page->where('filters.view', 'tabel')->has('rows'));
});

it('refuses to move or schedule anything on a closed lead', function () {
    $lead = lead();

    $this->post(route('leads.closure.store', $lead), ['reason' => 'ditolak']);

    $this->post(route('leads.stage.store', $lead), ['stage' => 'kontak'])
        ->assertStatus(409);

    $this->post(route('leads.follow-ups.store', $lead), [
        'scheduled_for' => Carbon::today()->toDateString(),
        'via' => 'WhatsApp',
    ])->assertStatus(409);

    expect($lead->fresh()->stage)->toBe('lead');
});

it('reopens a lead with its clock starting again from today', function () {
    $lead = lead(['stage' => 'konsultasi', 'stage_changed_at' => Carbon::today()->subDays(90)]);

    $this->post(route('leads.closure.store', $lead), ['reason' => 'belum_butuh']);
    $this->delete(route('leads.closure.destroy', $lead))->assertRedirect();

    $lead->refresh();

    expect($lead->status)->toBe(Lead::ACTIVE)
        ->and($lead->closed_reason)->toBeNull()
        ->and($lead->closed_at)->toBeNull()
        // Parked for three months is not the same as ignored for three months.
        ->and($lead->daysInStage())->toBe(0)
        ->and($lead->isStalled())->toBeFalse()
        ->and($lead->stage)->toBe('konsultasi')
        ->and($lead->stageEvents->last()->stage)->toBe('konsultasi')
        // The closure leaves a trace once its columns are cleared.
        ->and($lead->notes->first()->body)->toContain('belum butuh sekarang');
});

it('tells the dashboard where leads are being lost', function () {
    $one = lead(['stage' => 'proposal']);
    $two = lead(['company' => 'Bumi Artha', 'stage' => 'proposal']);
    $three = lead(['company' => 'Nusa Jaya', 'stage' => 'kontak']);

    foreach ([$one, $two] as $dead) {
        $this->post(route('leads.closure.store', $dead), ['reason' => 'ditolak']);
    }

    $this->post(route('leads.closure.store', $three), ['reason' => 'hilang_kontak']);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('closed.value', 3)
            ->where('closed.worstStage', 'Proposal')
            ->where('closed.worstStageCount', 2)
            ->where('closed.topReason', 'Ditolak')
            // Closed leads no longer count as pipeline.
            ->where('pipeline.3.count', 0)
        );
});

/** Headers for a visit the way Inertia makes one, so the page returns JSON. */
function inertiaHeaders(array $headers = []): array
{
    return [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => Inertia::getVersion(),
        ...$headers,
    ];
}

it('keeps a confirmation alive when a prefetch races the real visit', function () {
    $lead = lead();

    $this->post(route('leads.stage.store', $lead), ['stage' => 'kontak'])
        ->assertRedirect();

    /*
     | Hovering a link after saving fires a prefetch. Rendering a page consumes
     | the flash, so without care the guess eats the confirmation and the user
     | is never told the move happened.
     */
    $this->withHeaders(inertiaHeaders(['Purpose' => 'prefetch']))
        ->get(route('leads.show', $lead))
        ->assertOk();

    $this->withHeaders(inertiaHeaders())
        ->get(route('leads'))
        ->assertOk()
        ->assertJsonPath('flash.toast.message', 'PT Sinar Rejeki pindah ke Kontak')
        ->assertJsonPath('flash.toast.description', 'Sebelumnya di Lead.');
});

it('spends the confirmation on the visit that actually happens', function () {
    $lead = lead();

    $this->post(route('leads.stage.store', $lead), ['stage' => 'kontak']);

    $this->withHeaders(inertiaHeaders())
        ->get(route('leads'))
        ->assertJsonPath('flash.toast.type', 'success');

    // And only once.
    $this->withHeaders(inertiaHeaders())
        ->get(route('leads'))
        ->assertJsonMissingPath('flash.toast');
});

it('still counts the month on the month\'s last day', function () {
    // The trap: a range ending on the bare date drops everything stored that day.
    Carbon::setTestNow(Carbon::parse('2026-08-31 09:00:00'));

    $lead = lead(['entered_at' => Carbon::today(), 'stage_changed_at' => Carbon::today()]);
    $dead = lead(['company' => 'Bumi Artha', 'entered_at' => Carbon::today(), 'stage_changed_at' => Carbon::today()]);

    $this->post(route('leads.closure.store', $dead), ['reason' => 'ditolak']);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('summary.leads.value', 2)
            ->where('closed.value', 1)
            ->where('closed.worstStage', 'Lead')
        );

    expect($lead->fresh()->entered_at->toDateString())->toBe('2026-08-31');

    Carbon::setTestNow();
});
