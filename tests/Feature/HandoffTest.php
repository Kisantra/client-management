<?php

use App\Models\Handoff;
use App\Models\Lead;
use App\Models\LeadAttachment;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

const PM = 'https://pm.test';
const PM_TOKEN = 'rahasia-bersama';

beforeEach(function () {
    $this->actingAs(User::factory()->create(['name' => 'Dimas']));
    Storage::fake('local');

    config([
        'services.project_management.url' => PM,
        'services.project_management.token' => PM_TOKEN,
    ]);
});

function signable(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Sinar Rejeki Abadi',
        'pic' => 'Budi Hartono',
        'pic_role' => 'Direktur Keuangan',
        'phone' => '0812-3456-7810',
        'email' => 'finance@sinarrejeki.co.id',
        'npwp' => '0123 4567 8901 2000',
        'address' => 'Jl. Panglima Polim Raya 18',
        'city' => 'Jakarta Selatan',
        'channel' => 'instagram',
        'source' => 'Batas Lapor SPT Badan',
        'service' => 'PPh Badan',
        'value' => 48_000_000,
        'owner' => 'Dimas',
        'stage' => 'proposal',
        'entered_at' => Carbon::today()->subDays(20),
        'stage_changed_at' => Carbon::today()->subDays(4),
        ...$attributes,
    ]);
}

function pmAccepts(array $reply = []): void
{
    Http::fake([
        PM.'/api/v1/intake/clients' => Http::response([
            'intake_id' => 86,
            'status' => 'received',
            'completed' => false,
            'pm_client_id' => null,
            'client_url' => PM.'/klien-masuk/86',
            ...$reply,
        ]),
        PM.'/api/v1/intake/clients/*/withdraw' => Http::response(['ok' => true]),
    ]);
}

function moveTo(Lead $lead, string $stage): void
{
    test()->post(route('leads.stage.store', $lead), [
        'stage' => $stage,
        'files' => in_array($stage, ['proposal', 'deal'], true)
            ? [UploadedFile::fake()->create($stage.'.pdf', 120, 'application/pdf')]
            : [],
    ])->assertSessionHasNoErrors();
}

it('hands a lead over to Project Management when it reaches Deal', function () {
    pmAccepts();
    $lead = signable();

    moveTo($lead, 'deal');

    Http::assertSent(fn (Request $request) => $request->url() === PM.'/api/v1/intake/clients'
        && $request->hasHeader('Authorization', 'Bearer '.PM_TOKEN)
        && $request['cm_lead_id'] === $lead->id
        && $request['name'] === 'PT Sinar Rejeki Abadi'
        && $request['client_type'] === 'Badan'
        && $request['address'] === 'Jl. Panglima Polim Raya 18, Jakarta Selatan'
        && $request['contact']['name'] === 'Budi Hartono'
        && $request['service'] === 'PPh Badan'
        && $request['value'] === 48_000_000
        && $request['deal_at'] === Carbon::today()->toDateString()
        // The marketing trail stays in this app.
        && ! isset($request['channel'])
        && ! isset($request['source']));

    $handoff = $lead->fresh()->handoff;

    // Queued for the tax team to check: no client exists over there yet.
    expect($handoff->status)->toBe(Handoff::SENT)
        ->and($handoff->pm_client_id)->toBeNull()
        ->and($handoff->pm_client_url)->toBe(PM.'/klien-masuk/86')
        ->and($handoff->sent_at)->not->toBeNull();
});

it('takes the client as already processed when Project Management says so', function () {
    pmAccepts(['completed' => true, 'pm_client_id' => 418, 'client_url' => PM.'/clients/418']);
    $lead = signable();

    moveTo($lead, 'deal');

    expect($lead->fresh()->handoff->status)->toBe(Handoff::COMPLETED)
        ->and($lead->fresh()->handoff->pm_client_id)->toBe(418);
});

it('sends a person by name, not as "Perorangan"', function () {
    pmAccepts();
    $lead = signable(['entity' => 'Perorangan', 'company' => 'Budi Hartono']);

    moveTo($lead, 'deal');

    Http::assertSent(fn (Request $request) => $request['name'] === 'Budi Hartono'
        && $request['client_type'] === 'Pribadi');
});

it('does not resend when a signed lead moves from Deal to Client aktif', function () {
    pmAccepts();
    $lead = signable();

    moveTo($lead, 'deal');
    moveTo($lead, 'client');

    Http::assertSentCount(1);
});

it('sends nothing when the integration is not configured', function () {
    config(['services.project_management.url' => null]);
    Http::fake();
    $lead = signable();

    moveTo($lead, 'deal');

    Http::assertNothingSent();
    expect($lead->fresh()->handoff)->toBeNull();
});

it('hands over a lead created straight at Deal', function () {
    pmAccepts();

    signable(['stage' => 'deal', 'company' => 'Bumi Artha']);

    Http::assertSent(fn (Request $request) => $request['name'] === 'PT Bumi Artha');
});

it('calls the deal off when a handed-over lead is closed, and back on when reopened', function () {
    pmAccepts();
    $lead = signable();
    moveTo($lead, 'deal');

    $this->post(route('leads.closure.store', $lead), ['reason' => 'ditolak', 'note' => 'Pilih kompetitor.']);

    Http::assertSent(fn (Request $request) => $request->url() === PM.'/api/v1/intake/clients/'.$lead->id.'/withdraw'
        && $request['reason'] === 'ditutup'
        && $request['detail'] === 'Ditolak'
        && $request['note'] === 'Pilih kompetitor.');

    expect($lead->fresh()->handoff->status)->toBe(Handoff::WITHDRAWN);

    $this->delete(route('leads.closure.destroy', $lead));

    expect($lead->fresh()->handoff->status)->toBe(Handoff::SENT)
        ->and($lead->fresh()->handoff->withdrawn_at)->toBeNull();
    Http::assertSentCount(3);
});

it('calls the deal off when the lead moves back before Deal', function () {
    pmAccepts();
    $lead = signable();
    moveTo($lead, 'deal');

    moveTo($lead, 'proposal');

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/withdraw')
        && $request['reason'] === 'mundur'
        && $request['detail'] === 'Mundur ke Proposal');
});

it('says nothing about a lead closed before it was ever signed', function () {
    pmAccepts();
    $lead = signable();

    $this->post(route('leads.closure.store', $lead), ['reason' => 'belum_butuh']);

    Http::assertNothingSent();
});

it('keeps the Deal when Project Management is down, and records why', function () {
    Http::fake([PM.'/*' => Http::response(['message' => 'down'], 503)]);
    $lead = signable();

    moveTo($lead, 'deal');

    $handoff = $lead->fresh()->handoff;

    expect($lead->fresh()->stage)->toBe('deal')
        ->and($handoff->status)->toBe(Handoff::FAILED)
        ->and($handoff->error)->toContain('galat 503')
        ->and($handoff->attempts)->toBe(1)
        ->and($handoff->exhausted())->toBeFalse();
});

it('does not keep retrying a refusal', function () {
    Http::fake([PM.'/*' => Http::response(['message' => 'npwp tidak valid'], 422)]);
    $lead = signable();

    moveTo($lead, 'deal');

    $handoff = $lead->fresh()->handoff;

    expect($handoff->exhausted())->toBeTrue()
        ->and($handoff->error)->toBe('Project Management menolak datanya: npwp tidak valid');
});

it('sends again from the lead page, and sends deals signed before the link existed', function () {
    config(['services.project_management.url' => null]);
    $lead = signable(['stage' => 'deal']);
    config(['services.project_management.url' => PM]);
    pmAccepts();

    expect($lead->handoff)->toBeNull();

    $this->post(route('leads.handoff.store', $lead))->assertRedirect();

    expect($lead->fresh()->handoff->status)->toBe(Handoff::SENT);
});

it('refuses to send a lead that was never signed', function () {
    $this->post(route('leads.handoff.store', signable()))->assertStatus(409);
});

it('shows the handoff on the lead page', function () {
    pmAccepts();
    $lead = signable();
    moveTo($lead, 'deal');

    $this->get(route('leads.show', $lead))
        ->assertInertia(fn ($page) => $page
            ->where('handoff.status', Handoff::SENT)
            ->where('handoff.clientUrl', PM.'/klien-masuk/86')
            ->where('pipeline.handoff', true)
        );
});

function handedOver(): Lead
{
    pmAccepts();
    $lead = signable();

    test()->post(route('leads.stage.store', $lead), [
        'stage' => 'deal',
        'files' => [UploadedFile::fake()->create('Perjanjian-Jasa.pdf', 120, 'application/pdf')],
    ]);

    return $lead;
}

describe('the API Project Management reads', function () {
    it('turns away a request without the token', function () {
        $lead = handedOver();

        $this->getJson(route('pm.documents', $lead))->assertUnauthorized();
        $this->getJson(route('pm.documents', $lead), ['Authorization' => 'Bearer salah'])->assertUnauthorized();
    });

    it('turns everyone away when no token is configured', function () {
        $lead = handedOver();
        config(['services.project_management.token' => null]);

        $this->getJson(route('pm.documents', $lead), ['Authorization' => 'Bearer '])->assertUnauthorized();
    });

    it('lists every file of the lead, contract first, with a link that opens it inline', function () {
        $lead = handedOver();

        // Uploaded with a note afterwards, but still the client's document.
        $this->post(route('leads.notes.store', $lead), [
            'body' => 'Foto NPWP',
            'files' => [UploadedFile::fake()->image('npwp.jpg')],
        ]);

        $response = $this->getJson(route('pm.documents', $lead), ['Authorization' => 'Bearer '.PM_TOKEN])
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.kind', 'kontrak')
            ->assertJsonPath('data.0.label', 'Kontrak / surat perjanjian')
            ->assertJsonPath('data.0.name', 'Perjanjian-Jasa.pdf')
            ->assertJsonPath('data.1.kind', 'lampiran')
            ->assertJsonPath('data.1.label', 'Lampiran lead')
            ->assertJsonPath('data.1.name', 'npwp.jpg');

        $this->get($response->json('data.1.preview_url'))->assertOk();

        $this->get($response->json('data.0.preview_url'))
            ->assertOk()
            ->assertHeader('Content-Disposition', 'inline; filename=Perjanjian-Jasa.pdf');
    });

    it('lets the preview link expire', function () {
        $lead = handedOver();
        $attachment = $lead->attachments()->first();

        $this->get(route('pm.attachments.show', $attachment))->assertForbidden();

        $url = URL::temporarySignedRoute('pm.attachments.show', now()->addMinutes(5), ['attachment' => $attachment->id]);
        $this->travel(6)->minutes();

        $this->get($url)->assertForbidden();
    });

    it('does not open the documents of a lead that was never handed over', function () {
        $lead = signable();

        $this->getJson(route('pm.documents', $lead), ['Authorization' => 'Bearer '.PM_TOKEN])->assertNotFound();
    });

    it('moves the lead to Client aktif when the tax team has made the client and its project', function () {
        $lead = handedOver();

        $this->postJson(route('pm.handoff', $lead), [
            'status' => 'completed',
            'pm_client_id' => 418,
            'completed_by' => 'Rina',
            'completed_at' => '2026-11-12T09:15:00+07:00',
            'client_url' => PM.'/admin/clients/418',
            'matched' => true,
            'project_name' => 'PPh Badan 2026',
            'project_url' => PM.'/projects/77',
        ], ['Authorization' => 'Bearer '.PM_TOKEN])
            ->assertOk()
            ->assertJson(['ok' => true, 'stage' => 'client']);

        $lead->refresh();

        expect($lead->stage)->toBe('client')
            ->and($lead->stageEvents->last()->stage)->toBe('client')
            ->and($lead->notes->first()->author)->toBe('Project Management')
            ->and($lead->notes->first()->body)->toContain('Proyek "PPh Badan 2026" sudah dibuat')
            ->and($lead->notes->first()->body)->toContain('oleh Rina')
            ->and($lead->handoff->status)->toBe(Handoff::COMPLETED)
            ->and($lead->handoff->completed_by)->toBe('Rina')
            // 09:15 at +07:00 is 02:15 UTC, not 09:15 UTC.
            ->and($lead->handoff->completed_at->utc()->format('Y-m-d H:i'))->toBe('2026-11-12 02:15')
            ->and($lead->handoff->matched)->toBeTrue()
            ->and($lead->handoff->pm_project_name)->toBe('PPh Badan 2026')
            ->and($lead->handoff->pm_project_url)->toBe(PM.'/projects/77')
            ->and($lead->handoff->pm_client_url)->toBe(PM.'/admin/clients/418');

        // Deal to Client aktif is signed to signed: nothing new to send.
        Http::assertSentCount(1);
    });

    it('leaves a lead the marketer already moved where it is', function () {
        $lead = handedOver();
        moveTo($lead, 'client');

        $this->postJson(route('pm.handoff', $lead), ['status' => 'completed', 'completed_by' => 'Rina'], ['Authorization' => 'Bearer '.PM_TOKEN])
            ->assertJson(['stage' => 'client']);

        expect($lead->fresh()->stageEvents->where('stage', 'client'))->toHaveCount(1);
    });

    it('does not revive a deal that came off', function () {
        $lead = handedOver();
        $this->post(route('leads.closure.store', $lead), ['reason' => 'ditolak']);

        $this->postJson(route('pm.handoff', $lead), ['status' => 'completed'], ['Authorization' => 'Bearer '.PM_TOKEN])
            ->assertJson(['stage' => 'deal']);

        expect($lead->fresh()->isClosed())->toBeTrue()
            ->and($lead->fresh()->handoff->status)->toBe(Handoff::WITHDRAWN);
    });
});

it('keeps lead files off the public disk and behind sign-in', function () {
    Storage::fake('public');
    pmAccepts();
    $lead = signable();
    moveTo($lead, 'deal');

    $attachment = LeadAttachment::firstOrFail();

    Storage::disk('local')->assertExists($attachment->path);
    expect(Storage::disk('public')->allFiles())->toBe([]);

    $this->get($attachment->url())->assertOk();

    auth()->logout();
    $this->get($attachment->url())->assertRedirect(route('login'));
});

it('moves files uploaded before the change off the public disk', function () {
    Storage::fake('public');
    Http::fake();
    $lead = signable();

    $path = 'leads/'.$lead->id.'/kontrak-lama.pdf';
    Storage::disk('public')->put($path, '%PDF-1.4');
    LeadAttachment::create(['lead_id' => $lead->id, 'name' => 'kontrak-lama.pdf', 'path' => $path, 'mime' => 'application/pdf', 'size' => 8]);

    $migration = require database_path('migrations/2026_11_10_000001_move_lead_attachments_to_private_disk.php');
    $migration->up();
    // A second run finds nothing left to move and breaks nothing.
    $migration->up();

    Storage::disk('local')->assertExists($path);
    Storage::disk('public')->assertMissing($path);
});
