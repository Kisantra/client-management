<?php

use App\Models\Handoff;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\Letter;
use App\Models\LetterTemplate;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    // Mid-month, so "this month" and "last month" fall where the test expects.
    Carbon::setTestNow(Carbon::parse('2026-08-20'));
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

/** Headers for a visit Inertia makes itself, so the response carries the flash. */
function inertiaVisit(): array
{
    return ['X-Inertia' => 'true', 'X-Inertia-Version' => Inertia\Inertia::getVersion()];
}

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
            ->has('rows.data', 2)
            // Newest client first.
            ->where('rows.data.0.company', 'PT Graha Artha')
            ->where('rows.data.0.since', Carbon::today()->subDays(10)->toDateString())
            ->where('rows.data.0.daysToConvert', 190)
            ->where('rows.data.0.owner', 'Bayu')
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

it('reads each contract to its end, and leaves on-spot clients without one', function () {
    client(['company' => 'Tahunan', 'contract_months' => 12, 'contract_start' => '2026-01-01']);
    client(['company' => 'Hampir Habis', 'contract_months' => 3, 'contract_start' => '2026-06-01']);
    client(['company' => 'Sudah Habis', 'contract_months' => 6, 'contract_start' => '2026-01-15']);
    client(['company' => 'Sekali Jalan']);

    expect(Lead::firstWhere('company', 'Tahunan')->contract_ends_at->toDateString())->toBe('2026-12-31');

    $this->get(route('clients', ['urut' => 'kontrak']))
        ->assertInertia(fn ($page) => $page
            ->where('endingSoonDays', 30)
            ->where('summary.contracted', 3)
            ->where('summary.onSpot', 1)
            // Ends 31 August, eleven days out.
            ->where('summary.endingSoon', 1)
            ->where('summary.expired', 1)
            ->missing('summary.needsContact')
            // Soonest to run out first, the on-spot client last.
            ->where('rows.data.0.company', 'PT Sudah Habis')
            ->where('rows.data.0.contract.end', '2026-07-14')
            ->where('rows.data.0.contract.daysLeft', -37)
            ->where('rows.data.1.company', 'PT Hampir Habis')
            ->where('rows.data.1.contract.daysLeft', 11)
            ->where('rows.data.2.company', 'PT Tahunan')
            ->where('rows.data.2.contract.months', 12)
            ->where('rows.data.3.company', 'PT Sekali Jalan')
            ->where('rows.data.3.contract', null)
            ->missing('rows.data.0.needsContact')
        );
});

it('saves a contract term from the lead form, and drops it for an on-spot client', function () {
    $fields = [
        'entity' => 'PT',
        'company' => 'Karya Makmur',
        'pic' => 'Budi Santoso',
        'channel' => 'whatsapp',
        'source' => 'Chat langsung',
        'service' => 'Konsultasi Umum',
        'stage' => 'client',
        'entered_at' => '2026-08-01',
    ];

    $this->post(route('leads.store'), [...$fields, 'contract_months' => 12])
        ->assertSessionHasErrors('contract_start');

    $this->post(route('leads.store'), [...$fields, 'contract_months' => 12, 'contract_start' => '2026-08-01'])
        ->assertRedirect();

    $lead = Lead::firstWhere('company', 'Karya Makmur');

    expect($lead->contract_months)->toBe(12)
        ->and($lead->contract_ends_at->toDateString())->toBe('2027-07-31');

    // On spot: a start date left behind without a term is not kept.
    $this->post(route('leads.update', $lead), [...$fields, 'contract_months' => '', 'contract_start' => '2026-08-01'])
        ->assertRedirect();

    expect($lead->fresh())
        ->contract_months->toBeNull()
        ->contract_start->toBeNull()
        ->contract_ends_at->toBeNull();
});

it('deletes the picked clients with their files, and nothing else', function () {
    Storage::fake('local');

    $one = client();
    $two = client(['company' => 'Mekar Raya']);
    $kept = client(['company' => 'Tidak Dipilih']);
    $lead = client(['company' => 'Masih Proposal', 'stage' => 'proposal']);

    Storage::disk('local')->put('leads/'.$one->id.'/kontrak.pdf', 'pdf');
    $one->notes()->create(['author' => 'Admin', 'body' => 'Kontrak sudah diteken.']);

    $this->delete(route('clients.destroy'), ['ids' => [$one->id, $two->id, $lead->id]])
        ->assertRedirect();

    $this->withHeaders(inertiaVisit())
        ->get(route('clients'))
        ->assertJsonPath('flash.toast.message', '2 client dihapus');

    expect(Lead::pluck('company')->sort()->values()->all())->toBe(['Masih Proposal', 'Tidak Dipilih'])
        ->and(LeadNote::count())->toBe(0);

    Storage::disk('local')->assertMissing('leads/'.$one->id.'/kontrak.pdf');
});

it('passes over a client whose letter is numbered or that Project Management holds', function () {
    LetterTemplate::seedDefaults();

    $numbered = client(['company' => 'Bersurat']);
    $handedOver = client(['company' => 'Diserahkan']);
    $withdrawn = client(['company' => 'Sudah Batal']);
    $free = client(['company' => 'Bebas']);

    $template = LetterTemplate::firstWhere('code', 'penawaran-jasa');
    Letter::create([
        'letter_template_id' => $template->id,
        'lead_id' => $numbered->id,
        'letter_date' => Carbon::today(),
        'subject' => $template->subject,
        'recipient' => $template->recipient,
        'values' => $template->defaultValues(),
        'signers' => [],
        'status' => Letter::ISSUED,
        'number' => 'PEN-001/KSN-BE/VIII/2026',
    ]);

    Handoff::create(['lead_id' => $handedOver->id, 'status' => Handoff::SENT, 'sent_at' => now()]);
    Handoff::create(['lead_id' => $withdrawn->id, 'status' => Handoff::WITHDRAWN, 'sent_at' => now(), 'withdrawn_at' => now()]);

    $this->get(route('clients', ['urut' => 'nama']))
        ->assertInertia(fn ($page) => $page
            ->where('rows.data.0.company', 'PT Bebas')
            ->where('rows.data.0.locked', null)
            ->where('rows.data.1.company', 'PT Bersurat')
            ->where('rows.data.1.locked', 'Punya surat bernomor, yang harus tetap tercatat.')
            ->where('rows.data.2.company', 'PT Diserahkan')
            ->where('rows.data.2.locked', 'Sudah diserahkan ke Project Management.')
            ->where('rows.data.3.company', 'PT Sudah Batal')
            ->where('rows.data.3.locked', null)
        );

    $this->delete(route('clients.destroy'), ['ids' => Lead::pluck('id')->all()]);

    $this->withHeaders(inertiaVisit())
        ->get(route('clients'))
        ->assertJsonPath('flash.toast.type', 'warning')
        ->assertJsonPath('flash.toast.message', '2 client dihapus')
        ->assertJsonPath(
            'flash.toast.description',
            '2 dilewati. PT Bersurat: Punya surat bernomor, yang harus tetap tercatat. PT Diserahkan: Sudah diserahkan ke Project Management.',
        );

    expect(Lead::pluck('company')->sort()->values()->all())->toBe(['Bersurat', 'Diserahkan'])
        ->and(Letter::count())->toBe(1);
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
