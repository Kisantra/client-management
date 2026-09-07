<?php

use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    // Mid-month, so "this month" and "last month" fall where the test expects.
    Carbon::setTestNow(Carbon::parse('2026-08-20'));
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

/** A client that came in 200 days ago, signed 10 days ago, spoken to 3 days ago. */
function client(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Graha Artha',
        'pic' => 'Citra Kusuma',
        'channel' => 'web',
        'source' => 'Insentif pajak 2026',
        'service' => 'Konsultasi Umum',
        'value' => 50_000_000,
        'stage' => 'client',
        'owner' => 'Bayu',
        'entered_at' => Carbon::today()->subDays(200),
        'stage_changed_at' => Carbon::today()->subDays(10),
        'last_contact_at' => Carbon::today()->subDays(3),
        ...$attributes,
    ]);
}

it('lists only active clients, with the figures that measure them', function () {
    client();
    client([
        'company' => 'Mekar Raya',
        'value' => 30_000_000,
        'entered_at' => Carbon::today()->subDays(65),
        'stage_changed_at' => Carbon::today()->subDays(45),
    ]);
    client(['company' => 'Masih Proposal', 'stage' => 'proposal']);
    client(['company' => 'Sudah Berhenti', 'status' => Lead::CLOSED, 'closed_at' => Carbon::today()]);

    $this->get(route('clients'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('clients')
            ->where('total', 2)
            ->where('summary.count', 2)
            ->where('summary.value', 80_000_000)
            ->where('summary.average', 40_000_000)
            ->where('summary.newThisMonth', 1)
            ->where('summary.newLastMonth', 1)
            ->where('summary.lastMonth', 'Jul')
            // Conversions of 190 and 20 days: the median sits between them.
            ->where('summary.medianDays', 105)
            ->where('summary.fastestDays', 20)
            ->where('summary.needsContact', 0)
            ->has('rows.data', 2)
            // Newest client first.
            ->where('rows.data.0.company', 'PT Graha Artha')
            ->where('rows.data.0.since', Carbon::today()->subDays(10)->toDateString())
            ->where('rows.data.0.daysToConvert', 190)
            ->where('rows.data.0.owner', 'Bayu')
            ->where('rows.data.0.needsContact', false)
        );
});

it('counts a signed deal as a client, but never as an active one', function () {
    client();
    client([
        'company' => 'Baru Deal',
        'stage' => 'deal',
        'value' => 20_000_000,
        'stage_changed_at' => Carbon::today()->subDays(4),
    ]);
    /* Everything short of a signature stays out. */
    client(['company' => 'Masih Proposal', 'stage' => 'proposal']);
    /* A deal that fell through is not money the firm has. */
    client([
        'company' => 'Deal Berhenti',
        'stage' => 'deal',
        'status' => Lead::CLOSED,
        'closed_at' => Carbon::today(),
    ]);

    $this->get(route('clients'))
        ->assertInertia(fn ($page) => $page
            ->where('total', 2)
            ->where('summary.count', 2)
            /* The split is the point: the page holds two, only one is running. */
            ->where('summary.activeCount', 1)
            ->where('summary.dealCount', 1)
            ->where('summary.value', 70_000_000)
            /* A deal has not converted, so it may not enter the conversion
               figure — counting its shorter journey would report a speed the
               firm never reached. */
            ->where('summary.convertedCount', 1)
            ->where('summary.medianDays', 190)
            ->where('summary.fastestDays', 190)
            ->has('rows.data', 2)
            ->where('rows.data.0.company', 'PT Baru Deal')
            ->where('rows.data.0.stage', 'deal')
            ->where('rows.data.0.stageLabel', 'Deal')
            ->where('rows.data.0.daysToConvert', null)
            ->where('rows.data.1.company', 'PT Graha Artha')
            ->where('rows.data.1.stage', 'client')
            ->where('rows.data.1.daysToConvert', 190)
        );
});

it('measures each row against the contact tolerance of its own stage', function () {
    /* Twenty days of silence: nothing at all for a running client, three
       weeks overdue for a deal nobody has started. One shared threshold would
       have let the deal sit unanswered and still look healthy. */
    client(['company' => 'Client Diam', 'last_contact_at' => Carbon::today()->subDays(20)]);
    client([
        'company' => 'Deal Diam',
        'stage' => 'deal',
        'last_contact_at' => Carbon::today()->subDays(20),
        'stage_changed_at' => Carbon::today()->subDays(4),
    ]);

    $this->get(route('clients'))
        ->assertInertia(fn ($page) => $page
            ->where('summary.needsContact', 1)
            ->where('contactThreshold.deal', 5)
            ->where('contactThreshold.client', 30)
            ->where('stageLabels.deal', 'Deal')
            ->where('stageLabels.client', 'Client aktif')
            ->where('rows.data.0.company', 'PT Deal Diam')
            ->where('rows.data.0.needsContact', true)
            ->where('rows.data.1.company', 'PT Client Diam')
            ->where('rows.data.1.needsContact', false)
        );
});

it('flags a client left unspoken-to past the stage tolerance, and puts them first', function () {
    client();
    client(['company' => 'Mekar Raya', 'last_contact_at' => Carbon::today()->subDays(31)]);
    client(['company' => 'Tepat Batas', 'last_contact_at' => Carbon::today()->subDays(30)]);

    $this->get(route('clients', ['urut' => 'kontak']))
        ->assertInertia(fn ($page) => $page
            ->where('summary.needsContact', 1)
            ->where('rows.data.0.company', 'PT Mekar Raya')
            ->where('rows.data.0.needsContact', true)
            ->where('rows.data.1.company', 'PT Tepat Batas')
            ->where('rows.data.1.needsContact', false)
        );
});

it('filters by channel, person, service and search, and keeps the rails counting', function () {
    client();
    client([
        'company' => 'Mekar Raya',
        'channel' => 'instagram',
        'source' => 'Checklist dokumen pajak',
        'owner' => 'Putri',
        'service' => 'PPN',
    ]);
    client(['company' => 'Tanpa Pemegang', 'owner' => null]);

    $this->get(route('clients', ['channel' => 'instagram']))
        ->assertInertia(fn ($page) => $page
            ->has('rows.data', 1)
            ->where('rows.data.0.company', 'PT Mekar Raya')
            ->where('summary.count', 1)
            // The channel rail keeps counting the channels not chosen.
            ->where('channels.0.key', 'instagram')
            ->where('channels.0.count', 1)
            ->where('channels.3.key', 'web')
            ->where('channels.3.count', 2)
            // The other rail narrows with it: only Instagram's holder is left.
            ->has('owners', 1)
            ->where('owners.0.label', 'Putri')
            // As does the content, so it ranks what produced these clients.
            ->has('sources', 1)
            ->where('sources.0.source', 'Checklist dokumen pajak')
        );

    $this->get(route('clients'))
        ->assertInertia(fn ($page) => $page
            // Busiest first, ties by name; the unassigned bucket last.
            ->where('owners.0.label', 'Bayu')
            ->where('owners.1.label', 'Putri')
            ->where('owners.2.key', 'tanpa')
            ->where('owners.2.count', 1)
            ->has('sources', 2)
        );

    $this->get(route('clients', ['pj' => 'Putri']))
        ->assertInertia(fn ($page) => $page->has('rows.data', 1)->where('rows.data.0.owner', 'Putri'));

    $this->get(route('clients', ['pj' => 'tanpa']))
        ->assertInertia(fn ($page) => $page->has('rows.data', 1)->where('rows.data.0.company', 'PT Tanpa Pemegang'));

    $this->get(route('clients', ['layanan' => 'PPN']))
        ->assertInertia(fn ($page) => $page->has('rows.data', 1)->where('services', ['Konsultasi Umum', 'PPN']));

    $this->get(route('clients', ['q' => 'mekar']))
        ->assertInertia(fn ($page) => $page->has('rows.data', 1));
});

it('tells an empty result from having no clients at all', function () {
    $this->get(route('clients'))
        ->assertInertia(fn ($page) => $page
            ->where('total', 0)
            ->where('summary.medianDays', null)
            ->where('rows.total', 0)
        );
});

it('opens the lead form on the client stage from the Client page', function () {
    $this->get(route('leads.create', ['tahap' => 'client']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('lead-create')->where('stage', 'client'));

    $this->get(route('leads.create', ['tahap' => 'bukan-tahap']))
        ->assertInertia(fn ($page) => $page->where('stage', 'lead'));
});
