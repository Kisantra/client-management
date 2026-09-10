<?php

use App\Models\Lead;
use App\Models\LeadFollowUp;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    Carbon::setTestNow('2026-09-09 09:00:00');
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

function owner(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Bumi Mandiri',
        'pic' => 'Dewi',
        'channel' => 'instagram',
        'service' => 'PPh Badan',
        'stage' => 'proposal',
        'owner' => 'Sari',
        'value' => 10_000_000,
        'entered_at' => '2026-08-01',
        'stage_changed_at' => '2026-08-20',
        'last_contact_at' => '2026-08-20',
        'stalled_at' => '2026-09-20',
        ...$attributes,
    ]);
}

function promise(Lead $lead, string $on, array $attributes = []): LeadFollowUp
{
    return LeadFollowUp::create([
        'lead_id' => $lead->id,
        'scheduled_for' => $on,
        'via' => 'WhatsApp',
        'note' => 'Menanyakan tanggapan atas penawaran.',
        'done' => false,
        ...$attributes,
    ]);
}

/*
 | The dashboard's premise is what is due this morning, and it answered that
 | for content alone. A follow-up booked for next Tuesday is not a thing to do
 | today, and listing it would bury the ones that are.
 */
it('shows only the follow-ups actually owed, soonest first', function () {
    $lead = owner();

    promise($lead, '2026-09-02');            // a week late
    promise($lead, '2026-09-09');            // due today
    promise($lead, '2026-09-15');            // still ahead
    promise($lead, '2026-09-03', ['done' => true]); // already handled

    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('followUps.items', 2)
            ->where('followUps.overdue', 1)
            ->where('followUps.today', 1)
            ->where('followUps.items.0.on', '2026-09-02')
            ->where('followUps.items.0.daysLate', 7)
            ->where('followUps.items.1.on', '2026-09-09')
            ->where('followUps.items.1.daysLate', 0)
        );
});

/*
 | The row survives for the record; the reminder does not survive the decision.
 */
it('stops reminding about a lead that has been closed', function () {
    $open = owner(['company' => 'Masih Jalan']);
    $shut = owner(['company' => 'Sudah Ditutup', 'status' => Lead::CLOSED]);

    promise($open, '2026-09-02');
    promise($shut, '2026-09-02');

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->has('followUps.items', 1)
            ->where('followUps.items.0.company', 'PT Masih Jalan')
            ->where('followUps.overdue', 1)
        );
});

it('carries who the conversation is with and who owes it', function () {
    $lead = owner(['company' => 'Bumi Mandiri', 'owner' => 'Sari', 'stage' => 'deal']);
    promise($lead, '2026-09-09', ['via' => 'Telepon', 'note' => 'Konfirmasi tanggal mulai.']);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('followUps.items.0.company', 'PT Bumi Mandiri')
            ->where('followUps.items.0.leadId', $lead->id)
            ->where('followUps.items.0.owner', 'Sari')
            ->where('followUps.items.0.stage', 'deal')
            ->where('followUps.items.0.stageLabel', 'Deal')
            ->where('followUps.items.0.via', 'Telepon')
            ->where('followUps.items.0.note', 'Konfirmasi tanggal mulai.')
        );
});

it('says how many more are waiting beyond the ones it shows', function () {
    $lead = owner();

    foreach (range(1, 10) as $day) {
        promise($lead, '2026-09-0'.min($day, 9), ['note' => 'Catatan '.$day]);
    }

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            // Seven on the panel, the rest counted in the footer.
            ->has('followUps.items', 7)
            ->where('followUps.rest', 3)
        );
});

it('reads an empty queue without inventing one', function () {
    owner();

    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('followUps.items', 0)
            ->where('followUps.overdue', 0)
            ->where('followUps.today', 0)
            ->where('followUps.rest', 0)
        );
});

/*
 | The widget it replaced printed four invented channel figures, and the report
 | had begun working the true version of the same table out — two pages, two
 | answers, one question.
 */
it('no longer ships the invented channel table', function () {
    /* Read from the props rather than from the HTML: the page is mounted in
       the browser, so no panel heading is ever in the document this returns. */
    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->missing('channels')
            ->has('followUps')
        );
});
