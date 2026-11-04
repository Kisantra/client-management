<?php

use App\Models\Lead;
use App\Models\Letter;
use App\Models\LetterNumberCounter;
use App\Models\LetterSigner;
use App\Models\LetterTemplate;
use App\Models\RequestedDocumentType;
use App\Models\User;
use App\Support\LetterRenderer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/*
 | The tax team's letters, moved in from the project-management app: a
 | document checklist that is ticked off after issue, several signers whose
 | signatures print the moment they are chosen, a project typed per letter,
 | and berita acara with no addressee and a column for the client.
 */

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-11-04 09:00:00'));
    Storage::fake('local');
    Storage::fake('public');
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
    LetterTemplate::seedDefaults();
    RequestedDocumentType::seedDefaults();
});

afterEach(fn () => Carbon::setTestNow());

function taxClient(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Dendra Borneo Mandiri',
        'pic' => 'Budi Santoso',
        'channel' => 'whatsapp',
        'source' => 'Referensi',
        'service' => 'PPh Badan',
        'value' => 25_000_000,
        'stage' => 'client',
        'entered_at' => Carbon::today()->subMonths(3),
        'stage_changed_at' => Carbon::today()->subMonth(),
        'last_contact_at' => Carbon::today()->subDay(),
        ...$attributes,
    ]);
}

function draftFrom(string $code, ?Lead $lead = null): Letter
{
    test()->post(route('letters.store'), [
        'template_id' => LetterTemplate::firstWhere('code', $code)->id,
        'lead_id' => ($lead ?? taxClient())->id,
    ])->assertRedirect();

    return Letter::query()->latest('id')->firstOrFail();
}

function manager(array $attributes = []): LetterSigner
{
    return LetterSigner::create([
        'name' => 'Rina Kartika',
        'title' => 'Manajer',
        'is_active' => true,
        'sort_order' => 2,
        ...$attributes,
    ]);
}

/** The draft as the editor sends it back, with one part changed. */
function draftPayload(Letter $letter, array $patch = []): array
{
    return [
        'subject' => $letter->subject,
        'recipient' => $letter->recipient,
        'project' => $letter->project,
        'letter_date' => $letter->letter_date->toDateString(),
        'signers' => array_column($letter->signers ?? [], 'signer_id'),
        'values' => $letter->values,
        ...$patch,
    ];
}

it('ships the tax templates beside the offer, grouped by category', function () {
    expect(LetterTemplate::count())->toBe(14)
        ->and(LetterTemplate::where('number_prefix', 'S')->count())->toBe(8)
        ->and(LetterTemplate::where('number_prefix', 'BA')->count())->toBe(5)
        ->and(LetterTemplate::firstWhere('code', 'ba-pendapat-profesional')->signerSlots())
        ->toBe([['label' => 'Manajer'], ['label' => 'Direktur']]);
});

it('starts a document request with its signers chosen by title', function () {
    manager();

    $letter = draftFrom('surat-tanggapan-sp2dk');

    expect($letter->signers)->toHaveCount(2)
        ->and($letter->signers[0]['name'])->toBe('Rina Kartika')
        ->and($letter->signers[1]['name'])->toBe('Iqal Azhari');
});

it('asks for a signer when nobody on the list carries the slot title', function () {
    $letter = draftFrom('surat-permintaan-dokumen');

    $this->get(route('letters.show', $letter))
        ->assertInertia(fn ($page) => $page
            ->component('letter-edit')
            ->where('missing', fn ($missing) => collect($missing)->contains('Penanda tangan Manajer'))
            ->has('documentTypes')
            ->where('nextNumber', 'S-001/KSN-DBM/XI/2026')
        );
});

it('keeps a document checklist that is written in the draft and ticked off after issue', function () {
    $manager = manager();
    $letter = draftFrom('surat-permintaan-dokumen');
    $bank = RequestedDocumentType::firstWhere('name', 'Rekening koran seluruh rekening bank');

    $this->post(route('letters.documents.store', $letter), ['field' => 'daftar_dokumen', 'type_id' => $bank->id])->assertRedirect();
    $this->post(route('letters.documents.store', $letter), ['field' => 'daftar_dokumen', 'name' => 'Kontrak proyek jalan tol'])->assertRedirect();

    // The same document twice is refused, by master entry or by name.
    $this->post(route('letters.documents.store', $letter), ['field' => 'daftar_dokumen', 'type_id' => $bank->id])
        ->assertSessionHasErrors('name');

    // A field that is not a checklist on this template is refused too.
    $this->post(route('letters.documents.store', $letter), ['field' => 'keperluan', 'name' => 'Apa saja'])
        ->assertSessionHasErrors('field');

    $first = $letter->requestedDocuments()->first();
    $this->patch(route('letters.documents.update', [$letter, $first]), ['note' => 'Januari–Desember 2025'])->assertRedirect();

    expect($letter->requestedDocuments()->pluck('name')->all())
        ->toBe(['Rekening koran seluruh rekening bank', 'Kontrak proyek jalan tol'])
        ->and($first->fresh()->note)->toBe('Januari–Desember 2025');

    $this->patch(route('letters.update', $letter), draftPayload($letter, [
        'signers' => [$manager->id],
        'values' => [
            ...$letter->values,
            'keperluan' => 'tindak lanjut SP2DK Tahun Pajak 2024',
            'tenggat' => '2026-11-20',
        ],
    ]))->assertRedirect();

    $this->post(route('letters.issue.store', $letter))->assertRedirect();
    $letter->refresh();

    expect($letter->status)->toBe(Letter::ISSUED)
        ->and($letter->number)->toBe('S-001/KSN-DBM/XI/2026');

    // The list is part of what was sent, so it is locked now.
    $this->post(route('letters.documents.store', $letter), ['field' => 'daftar_dokumen', 'name' => 'Terlambat'])
        ->assertSessionHasErrors('name');
    $this->delete(route('letters.documents.destroy', [$letter, $first]))->assertSessionHasErrors('name');

    // Receipt is tracking, not writing: it goes on after issue.
    $this->post(route('letters.documents.receive', [$letter, $first]))->assertRedirect();

    expect($first->fresh()->received_at)->not->toBeNull()
        ->and($first->fresh()->received_by)->toBe(auth()->id());

    $this->post(route('letters.documents.receive', [$letter, $first]));
    expect($first->fresh()->received_at)->toBeNull();
});

it('prints the checklist on a LAMPIRAN page rather than in the body', function () {
    manager();
    $letter = draftFrom('surat-permintaan-dokumen');
    $letter->requestedDocuments()->create(['field_key' => 'daftar_dokumen', 'name' => 'Buku besar / general ledger', 'note' => 'Tahun 2025', 'order' => 1]);

    $html = LetterRenderer::document($letter->fresh());

    expect($html)
        ->toContain('LAMPIRAN I')
        ->toContain('Daftar Dokumen yang diminta')
        ->toContain('<td class="ltr-col-doc">Buku besar / general ledger</td>')
        ->toContain('Tahun 2025')
        ->toContain('<td class="ltr-meta-k">Lampiran</td>')
        ->toContain('Yth. <span class="ltr-addr-name">Bapak/Ibu Pimpinan PT Dendra Borneo Mandiri</span>');

    expect(LetterRenderer::body($letter->fresh()))->not->toContain('Buku besar');
});

it('requires a checklist that has nothing on it', function () {
    manager();
    $letter = draftFrom('surat-permintaan-dokumen');

    expect(LetterRenderer::missing($letter->fresh()))->toContain('Dokumen yang diminta');
});

it('prints every signer with their signature as soon as they are chosen', function () {
    $this->post(route('letters.signers.store'), [
        'name' => 'Rina Kartika',
        'title' => 'Tax Manager',
        'signature' => UploadedFile::fake()->image('ttd.png', 300, 120),
    ])->assertRedirect();

    $signer = LetterSigner::firstWhere('name', 'Rina Kartika');

    // Kept off the public disk: nobody fetches a signature by URL.
    Storage::disk('local')->assertExists($signer->signature_path);
    expect(Storage::disk('public')->allFiles())->toBe([]);

    $letter = draftFrom('surat-tanggapan-sp2dk');
    $this->patch(route('letters.update', $letter), draftPayload($letter, [
        'signers' => [$signer->id, LetterSigner::firstWhere('name', 'Iqal Azhari')->id],
    ]))->assertRedirect();

    $html = LetterRenderer::document($letter->fresh());

    expect($html)
        ->toContain('Rina Kartika')
        ->toContain('Tax Manager')
        ->toContain('Iqal Azhari')
        ->toContain('src="data:image/png;base64,');

    // The PDF reads the file itself.
    expect(LetterRenderer::document($letter->fresh(), forPdf: true))
        ->toContain(Storage::disk('local')->path($signer->signature_path));

    $this->get(route('letters.signers.image', $signer))->assertOk();
});

it('freezes the signers at issue while a draft follows the signer record', function () {
    $manager = manager();
    $draft = draftFrom('surat-tanggapan-sphp');
    $issued = draftFrom('surat-tanggapan-sphp', taxClient(['company' => 'Nusa Jaya Abadi']));

    $issued->update(['values' => [...$issued->values, 'nomor_sphp' => 'PHP-1', 'tanggal_sphp' => '2026-11-01', 'kpp' => 'KPP Pratama Samarinda Ulu', 'pokok_tidak_setuju' => 'Koreksi peredaran usaha.']]);
    $this->post(route('letters.issue.store', $issued))->assertRedirect();

    $this->post(route('letters.signers.update', $manager), ['name' => 'Rina Kartika, S.E.', 'title' => 'Senior Manager'])->assertRedirect();

    expect(LetterRenderer::document($draft->fresh()))->toContain('Senior Manager')
        ->and(LetterRenderer::document($issued->fresh()))->toContain('>Manajer<')
        ->and(LetterRenderer::document($issued->fresh()))->not->toContain('Senior Manager');
});

it('keeps one default signer and never offers a switched-off one', function () {
    $manager = manager();

    $this->post(route('letters.signers.update', $manager), ['name' => 'Rina Kartika', 'title' => 'Manajer', 'is_default' => true])->assertRedirect();

    expect(LetterSigner::where('is_default', true)->pluck('id')->all())->toBe([$manager->id]);

    $this->post(route('letters.signers.update', $manager), ['name' => 'Rina Kartika', 'title' => 'Manajer', 'is_default' => true, 'is_active' => false]);

    expect($manager->fresh()->is_default)->toBeFalse()
        ->and(LetterSigner::defaultsFor([['label' => 'Manajer']]))->toBe([null]);
});

it('fills the project typed on the letter and asks for it where the wording uses it', function () {
    manager();
    $letter = draftFrom('ba-serah-terima-laporan');

    expect(LetterRenderer::missing($letter->fresh()))->toContain('Proyek');

    $this->patch(route('letters.update', $letter), draftPayload($letter, [
        'project' => 'Penyusunan SPT Tahunan PPh Badan',
        'values' => [...$letter->values, 'pihak_klien' => 'Budi Santoso, Direktur'],
    ]))->assertRedirect();

    $letter->refresh();

    expect($letter->project)->toBe('Penyusunan SPT Tahunan PPh Badan')
        ->and(LetterRenderer::missing($letter))->not->toContain('Proyek')
        ->and(LetterRenderer::body($letter))->toContain('hasil pekerjaan Penyusunan SPT Tahunan PPh Badan untuk');

    // A berita acara is addressed to nobody and carries the client's own column.
    $html = LetterRenderer::document($letter);

    expect($html)->not->toContain('ltr-addr')
        ->toContain('Menyetujui,')
        ->toContain('Budi Santoso, Direktur');

    $this->get(route('letters.show', $letter))
        ->assertInertia(fn ($page) => $page
            ->where('letter.project', 'Penyusunan SPT Tahunan PPh Badan')
            ->where('projects.0', 'PPh Badan')
            ->where('projects', fn ($projects) => collect($projects)->contains('Restitusi Pajak'))
        );
});

it('writes a rupiah field as rupiah', function () {
    $letter = draftFrom('pemberitahuan-kode-billing');

    $this->patch(route('letters.update', $letter), draftPayload($letter, [
        'values' => [...$letter->values, 'jumlah' => '12.500.000'],
    ]))->assertRedirect();

    expect($letter->fresh()->values['jumlah'])->toBe(12_500_000)
        ->and(LetterRenderer::body($letter->fresh()))->toContain('Jumlah: Rp 12.500.000');
});

it('lets the office continue a paper register but never wind a counter below a printed number', function () {
    $this->get(route('letters.settings'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('letter-settings')
            ->has('signers', 1)
            ->has('counters', 3)
            ->where('missingDocumentTypes', 0)
        );

    $this->patch(route('letters.counters.update'), ['prefix' => 'S', 'year' => 2026, 'last' => 41])->assertRedirect();

    $letter = draftFrom('pemberitahuan-kode-billing');
    $letter->update(['values' => [
        ...$letter->values,
        'jenis_pajak' => 'PPh Pasal 21', 'masa_pajak' => 'Oktober 2026', 'kode_billing' => '123456789012345',
        'jumlah' => 1_000_000, 'batas_setor' => '2026-11-15', 'batas_lapor' => '2026-11-20',
    ]]);
    LetterSigner::first()->update(['title' => 'Manajer']);
    $letter->update(['signers' => Letter::signerSnapshot($letter->template, [LetterSigner::first()->id])]);

    $this->post(route('letters.issue.store', $letter))->assertRedirect();
    expect($letter->fresh()->number)->toBe('S-042/KSN-DBM/XI/2026');

    $this->patch(route('letters.counters.update'), ['prefix' => 'S', 'year' => 2026, 'last' => 10])
        ->assertSessionHasErrors('last');

    expect(LetterNumberCounter::where('prefix', 'S')->value('last_sequence'))->toBe(42);
});

it('keeps a numbered letter inside the month its number names', function () {
    $letter = draftFrom('penawaran-jasa');
    $this->post(route('letters.issue.store', $letter));
    $this->delete(route('letters.issue.destroy', $letter));
    $letter->refresh();

    $this->patch(route('letters.update', $letter), draftPayload($letter, ['letter_date' => '2026-12-01']))
        ->assertSessionHasErrors('letter_date');

    $this->patch(route('letters.update', $letter), draftPayload($letter, ['letter_date' => '2026-11-20']))
        ->assertSessionHasNoErrors();

    expect($letter->fresh()->letter_date->toDateString())->toBe('2026-11-20');
});

it('lets the template editor rename signer slots and print the checklist inline', function () {
    $template = LetterTemplate::firstWhere('code', 'surat-permintaan-dokumen');

    $this->patch(route('letters.templates.update', $template), [
        'name' => $template->name,
        'description' => $template->description,
        'category' => 'pengingat',
        'number_prefix' => 'S',
        'subject' => $template->subject,
        'recipient' => '',
        'body' => $template->body,
        'is_active' => true,
        'signers' => ['Tax Manager', 'Direktur'],
        'checklist_as_attachment' => false,
        'fields' => [],
    ])->assertRedirect();

    $template->refresh();

    expect($template->signerSlots())->toBe([['label' => 'Tax Manager'], ['label' => 'Direktur']])
        ->and($template->checklist_as_attachment)->toBeFalse()
        ->and($template->category)->toBe('pengingat')
        ->and($template->recipient)->toBeNull()
        // The fields' shape is not the editor's to change: an empty list keeps them.
        ->and($template->fieldDefinitions())->toHaveKey('daftar_dokumen');
});

it('installs the starter document list once', function () {
    RequestedDocumentType::query()->delete();

    $this->post(route('letters.types.seed'))->assertRedirect();
    $count = RequestedDocumentType::count();

    $this->post(route('letters.types.seed'));

    expect($count)->toBe(32)
        ->and(RequestedDocumentType::count())->toBe($count);

    $this->post(route('letters.types.store'), ['name' => 'Laporan audit independen', 'category' => 'keuangan'])->assertRedirect();
    $this->post(route('letters.types.store'), ['name' => 'Laporan audit independen', 'category' => 'keuangan'])
        ->assertSessionHasErrors('name');
});
