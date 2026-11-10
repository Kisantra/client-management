<?php

use App\Models\Activity;
use App\Models\Lead;
use App\Models\Letter;
use App\Models\LetterSigner;
use App\Models\LetterTemplate;
use App\Models\User;
use App\Support\LetterNumber;
use App\Support\LetterRenderer;
use App\Support\Terbilang;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-09-23 09:00:00'));
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
    LetterTemplate::seedDefaults();
});

afterEach(fn () => Carbon::setTestNow());

function prospect(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'Perorangan',
        'company' => 'Marwi Sulistyarini',
        'pic' => 'Marwi Sulistyarini',
        'channel' => 'whatsapp',
        'source' => 'Chat langsung',
        'service' => 'Konsultasi Umum',
        'value' => 10_000_000,
        'stage' => 'proposal',
        'entered_at' => Carbon::today()->subDays(3),
        'stage_changed_at' => Carbon::today()->subDays(1),
        'last_contact_at' => Carbon::today()->subDays(1),
        ...$attributes,
    ]);
}

function offer(Lead $lead, array $attributes = []): Letter
{
    $template = LetterTemplate::firstWhere('code', 'penawaran-jasa');

    return Letter::create([
        'letter_template_id' => $template->id,
        'lead_id' => $lead->id,
        'created_by' => auth()->id(),
        'letter_date' => Carbon::today(),
        'subject' => $template->subject,
        'recipient' => $template->recipient,
        'values' => $template->defaultValues(),
        'signers' => Letter::signerSnapshot($template, LetterSigner::defaultsFor($template->signerSlots())),
        'status' => Letter::DRAFT,
        ...$attributes,
    ]);
}

it('writes rupiah in words', function () {
    expect(Terbilang::rupiah(10_000_000))->toBe('Sepuluh Juta Rupiah')
        ->and(Terbilang::rupiah(1_500_000))->toBe('Satu Juta Lima Ratus Ribu Rupiah')
        ->and(Terbilang::rupiah(111))->toBe('Seratus Sebelas Rupiah')
        ->and(Terbilang::rupiah(1_000))->toBe('Seribu Rupiah')
        ->and(Terbilang::rupiah(2_017))->toBe('Dua Ribu Tujuh Belas Rupiah')
        ->and(Terbilang::rupiah(1_250_000_000))->toBe('Satu Miliar Dua Ratus Lima Puluh Juta Rupiah')
        ->and(Terbilang::rupiah(0))->toBe('Nol Rupiah');
});

it('abbreviates the client into the number', function () {
    expect(LetterNumber::initials('Marwi Sulistyarini'))->toBe('MS')
        ->and(LetterNumber::initials('Sinar Rejeki Abadi Jaya'))->toBe('SRA')
        ->and(LetterNumber::initials('Kisantra'))->toBe('KI')
        ->and(LetterNumber::format('PEN', 11, Carbon::parse('2026-08-28'), 'MS'))->toBe('PEN-011/KSN-MS/VIII/2026');
});

it('starts a draft from a template with the template defaults', function () {
    $lead = prospect();
    $template = LetterTemplate::firstWhere('code', 'penawaran-jasa');

    $this->post(route('letters.store'), [
        'template_id' => $template->id,
        'lead_id' => $lead->id,
    ])->assertRedirect();

    $letter = Letter::first();

    expect($letter->status)->toBe(Letter::DRAFT)
        ->and($letter->number)->toBeNull()
        ->and($letter->subject)->toBe('Penawaran Jasa Layanan Perpajakan')
        ->and($letter->values['sapaan'])->toBe('Bapak/Ibu')
        ->and($letter->values['layanan'][0]['rows'][0]['amount'])->toBe(10_000_000)
        ->and($letter->signers[0]['name'])->toBe('Iqal Azhari')
        ->and($letter->signers[0]['title'])->toBe('Direktur');

    $this->get(route('letters.show', $letter))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('letter-edit')
            ->where('letter.status', 'draft')
            ->where('letter.client.name', 'Marwi Sulistyarini')
            ->where('nextNumber', 'PEN-001/KSN-MS/IX/2026')
            ->where('missing', [])
            ->where('total', 10_000_000)
            ->has('fields', 4)
        );
});

it('saves a new lead and opens a draft offer for it in one step', function () {
    $this->get(route('leads.create'))
        ->assertInertia(fn ($page) => $page->where('offer', 'Surat Penawaran Jasa'));

    $response = $this->post(route('leads.store'), [
        'entity' => 'CV',
        'company' => 'Karya Makmur',
        'pic' => 'Budi Santoso',
        'channel' => 'whatsapp',
        'source' => 'Chat langsung',
        'service' => 'PPh Badan',
        'value' => 25_000_000,
        'stage' => 'konsultasi',
        'entered_at' => Carbon::today()->toDateString(),
        'after' => 'penawaran',
    ]);

    $lead = Lead::firstWhere('company', 'Karya Makmur');
    $letter = Letter::firstWhere('lead_id', $lead->id);

    $response->assertRedirect(route('letters.show', $letter));

    expect($letter->template->code)->toBe('penawaran-jasa')
        ->and($letter->status)->toBe(Letter::DRAFT)
        // The lead waits at its stage; issuing the offer is what moves it.
        ->and($lead->stage)->toBe('konsultasi');
});

it('saves the lead as usual when no offer template is active', function () {
    LetterTemplate::where('stage_on_issue', 'proposal')->update(['is_active' => false]);

    $this->get(route('leads.create'))
        ->assertInertia(fn ($page) => $page->where('offer', null));

    $this->post(route('leads.store'), [
        'entity' => 'CV',
        'company' => 'Karya Makmur',
        'pic' => 'Budi Santoso',
        'channel' => 'whatsapp',
        'source' => 'Chat langsung',
        'service' => 'PPh Badan',
        'stage' => 'lead',
        'entered_at' => Carbon::today()->toDateString(),
        'after' => 'penawaran',
    ])->assertRedirect(route('leads.show', Lead::firstWhere('company', 'Karya Makmur')));

    expect(Letter::count())->toBe(0);
});

it('refuses a letter to a closed lead', function () {
    $lead = prospect(['status' => Lead::CLOSED, 'closed_at' => Carbon::today()]);

    $this->post(route('letters.store'), [
        'template_id' => LetterTemplate::first()->id,
        'lead_id' => $lead->id,
    ])->assertSessionHasErrors('lead_id');
});

it('renders the offer on the letterhead from the values', function () {
    $letter = offer(prospect(), [
        'values' => [
            'sapaan' => 'Ibu',
            'layanan' => [
                ['title' => 'Pendampingan SP2DK', 'rows' => [['name' => 'Pendampingan SP2DK', 'amount' => 10_000_000]]],
                ['title' => 'Pelaporan SPT', 'rows' => [
                    ['name' => 'SPT Masa PPN', 'amount' => '2.500.000'],
                    ['name' => 'SPT Tahunan', 'amount' => 1_000_000],
                ]],
            ],
            'keterangan_biaya' => '(Biaya sudah mencakup seluruh layanan di atas, tanpa biaya tambahan)',
            'catatan' => "Jasa diberikan berdasarkan kesepakatan.\nSeluruh dokumen dijamin kerahasiaannya.",
        ],
    ]);

    $html = LetterRenderer::document($letter);

    expect($html)
        ->toContain('Samarinda, 23 September 2026')
        ->toContain('Yth. <span class="ltr-addr-name">Pimpinan MARWI SULISTYARINI</span>')
        ->toContain('<strong>PT Kinara Sadayatra Nusantara</strong>')
        ->toContain('<strong>Ibu Marwi Sulistyarini</strong>')
        ->toContain('A.) Pendampingan SP2DK')
        ->toContain('B.) Pelaporan SPT')
        ->toContain('Rp 2.500.000')
        ->toContain('<strong>Rp 13.500.000,-</strong> (Tiga Belas Juta Lima Ratus Ribu Rupiah)')
        ->toContain('<em>(Biaya sudah mencakup seluruh layanan di atas, tanpa biaya tambahan)</em>')
        ->toContain('<ul><li>Jasa diberikan berdasarkan kesepakatan.</li><li>Seluruh dokumen dijamin kerahasiaannya.</li></ul>')
        ->toContain('marketing@kisantra.com / 0811-8000-9787')
        ->toContain('Iqal Azhari')
        ->not->toContain('ltr-missing');

    expect(LetterRenderer::total($letter))->toBe(13_500_000);
});

it('escapes what the writer types and marks a placeholder that does not exist', function () {
    $template = LetterTemplate::firstWhere('code', 'penawaran-jasa');
    $template->update(['body' => "Halo {{tidak_ada}}\n\n{{catatan}}"]);

    $letter = offer(prospect(['company' => 'Bumi <b>Artha</b>']), [
        'values' => ['sapaan' => 'Bapak', 'layanan' => [], 'keterangan_biaya' => null, 'catatan' => '<script>alert(1)</script>'],
    ]);

    $html = LetterRenderer::body($letter);

    expect($html)
        ->toContain('<span class="ltr-missing">{tidak_ada}</span>')
        ->toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
        ->not->toContain('<script>');

    expect(LetterRenderer::document($letter))->toContain('BUMI &lt;B&gt;ARTHA&lt;/B&gt;');
});

it('saves the draft as it is typed and reports what is still missing', function () {
    $letter = offer(prospect());

    $this->patch(route('letters.update', $letter), [
        'subject' => 'Penawaran Pendampingan SP2DK',
        'recipient' => 'Ibu {{pic}}',
        'letter_date' => '2026-08-28',
        'signers' => [LetterSigner::first()->id],
        'values' => [
            'sapaan' => 'Ibu',
            'layanan' => [['title' => 'Pendampingan SP2DK', 'rows' => [['name' => '', 'amount' => '']]]],
            'keterangan_biaya' => '',
            'catatan' => '',
        ],
    ])->assertRedirect();

    $letter->refresh();

    expect($letter->subject)->toBe('Penawaran Pendampingan SP2DK')
        ->and($letter->letter_date->toDateString())->toBe('2026-08-28')
        ->and($letter->values['keterangan_biaya'])->toBeNull()
        ->and($letter->values['layanan'][0]['rows'][0]['amount'])->toBe(0);

    // The fee table is required and has no priced row, so the letter cannot go out yet.
    $this->get(route('letters.show', $letter))
        ->assertInertia(fn ($page) => $page
            ->where('missing', ['Rincian jasa dan biaya'])
            ->where('nextNumber', 'PEN-001/KSN-MS/VIII/2026')
        );

    $this->post(route('letters.issue.store', $letter))->assertRedirect();

    expect($letter->fresh()->status)->toBe(Letter::DRAFT);
});

it('rejects a value the template does not offer', function () {
    $letter = offer(prospect());

    $this->patch(route('letters.update', $letter), [
        'subject' => 'x',
        'recipient' => 'x',
        'letter_date' => '2026-08-28',
        'signers' => [],
        'values' => ['sapaan' => 'Saudara'],
    ])->assertSessionHasErrors('values.sapaan');
});

it('numbers letters in sequence per prefix and year when issued', function () {
    $first = offer(prospect());
    $second = offer(prospect(['company' => 'Sinar Rejeki']), ['letter_date' => Carbon::parse('2026-12-01')]);
    $nextYear = offer(prospect(['company' => 'Bumi Artha']), ['letter_date' => Carbon::parse('2027-01-05')]);

    $this->post(route('letters.issue.store', $first))->assertRedirect();
    $this->post(route('letters.issue.store', $second))->assertRedirect();
    $this->post(route('letters.issue.store', $nextYear))->assertRedirect();

    expect($first->fresh()->number)->toBe('PEN-001/KSN-MS/IX/2026')
        ->and($second->fresh()->number)->toBe('PEN-002/KSN-SR/XII/2026')
        ->and($nextYear->fresh()->number)->toBe('PEN-001/KSN-BA/I/2027')
        ->and($first->fresh()->status)->toBe(Letter::ISSUED)
        ->and($first->fresh()->rendered_html)->toContain('A.) Pendampingan SP2DK')
        ->and($first->fresh()->issued_at)->not->toBeNull();

    // Issue is an event worth keeping: the number and the status both change.
    $entry = Activity::query()->where('subject_type', 'surat')->where('action', Activity::UPDATED)->first();

    expect($entry)->not->toBeNull()
        ->and(collect($entry->diff)->pluck('label')->all())->toContain('Nomor', 'Status');
});

it('freezes the words at issue and reopens them when pulled back', function () {
    $letter = offer(prospect());
    $this->post(route('letters.issue.store', $letter));

    $letter->refresh();
    $frozen = $letter->rendered_html;

    // An issued letter ignores edits.
    $this->patch(route('letters.update', $letter), ['subject' => 'Diubah'])->assertRedirect();
    expect($letter->fresh()->subject)->toBe('Penawaran Jasa Layanan Perpajakan');

    // The template changing afterwards does not change what went out.
    $letter->template->update(['body' => 'Redaksi baru.']);
    expect(LetterRenderer::document($letter->fresh()))->toContain($frozen);

    // Pulled back: the words follow the template again, the number stays.
    $this->delete(route('letters.issue.destroy', $letter))->assertRedirect();

    $letter->refresh();

    expect($letter->status)->toBe(Letter::DRAFT)
        ->and($letter->rendered_html)->toBeNull()
        ->and($letter->number)->toBe('PEN-001/KSN-MS/IX/2026')
        ->and(LetterRenderer::document($letter))->toContain('Redaksi baru.');

    // Issued again under the same number; the counter is not spent twice.
    $this->post(route('letters.issue.store', $letter));
    $another = offer(prospect(['company' => 'Nusa Jaya']));
    $this->post(route('letters.issue.store', $another));

    expect($letter->fresh()->number)->toBe('PEN-001/KSN-MS/IX/2026')
        ->and($another->fresh()->number)->toBe('PEN-002/KSN-NJ/IX/2026');
});

it('cancels an issued letter but deletes an unnumbered draft', function () {
    $issued = offer(prospect());
    $this->post(route('letters.issue.store', $issued));

    $this->post(route('letters.cancel', $issued))->assertRedirect();
    expect($issued->fresh()->status)->toBe(Letter::CANCELED)
        ->and($issued->fresh()->number)->toBe('PEN-001/KSN-MS/IX/2026');

    // A numbered letter never disappears.
    $this->delete(route('letters.destroy', $issued))->assertRedirect();
    expect(Letter::find($issued->id))->not->toBeNull();

    $draft = offer(prospect(['company' => 'Nusa Jaya']));

    // And an unnumbered draft has nothing to cancel.
    $this->post(route('letters.cancel', $draft))->assertRedirect();
    expect($draft->fresh()->status)->toBe(Letter::DRAFT);

    $this->delete(route('letters.destroy', $draft))->assertRedirect(route('letters'));
    expect(Letter::find($draft->id))->toBeNull();
});

it('lists letters with status counts and a search', function () {
    $lead = prospect();
    offer($lead);
    $issued = offer(prospect(['company' => 'Sinar Rejeki']));
    $this->post(route('letters.issue.store', $issued));

    $this->get(route('letters'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('letters')
            ->where('total', 2)
            ->has('rows.data', 2)
            ->where('statuses.0.key', 'draft')
            ->where('statuses.0.count', 1)
            ->where('statuses.1.key', 'terbit')
            ->where('statuses.1.count', 1)
            ->where('hasTemplates', true)
        );

    $this->get(route('letters', ['status' => 'terbit']))
        ->assertInertia(fn ($page) => $page
            ->has('rows.data', 1)
            ->where('rows.data.0.number', 'PEN-001/KSN-SR/IX/2026')
            ->where('rows.data.0.client', 'Sinar Rejeki')
        );

    $this->get(route('letters', ['q' => 'marwi']))
        ->assertInertia(fn ($page) => $page->has('rows.data', 1));

    $this->get(route('leads.show', $lead))
        ->assertInertia(fn ($page) => $page->has('letters', 1));
});

it('offers the templates and the open leads to a new letter', function () {
    $lead = prospect();
    prospect(['company' => 'Sudah Tutup', 'status' => Lead::CLOSED, 'closed_at' => Carbon::today()]);

    $this->get(route('letters.create', ['lead' => $lead->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('letter-create')
            ->has('templates', count(LetterTemplate::defaults()))
            ->where('templates.0.prefix', 'PEN')
            ->has('leads', 1)
            ->where('leadId', $lead->id)
        );
});

it('streams the letter as a PDF named after it', function () {
    $letter = offer(prospect());
    $this->post(route('letters.issue.store', $letter));

    $response = $this->get(route('letters.pdf', $letter));

    $response->assertOk()
        ->assertHeader('Content-Type', 'application/pdf')
        ->assertHeader(
            'Content-Disposition',
            'attachment; filename="Penawaran Jasa Layanan Perpajakan - Marwi Sulistyarini - PEN-001-KSN-MS-IX-2026.pdf"',
        );

    expect($response->streamedContent())->toStartWith('%PDF');

    $this->get(route('letters.pdf', [$letter, 'lihat' => 1]))
        ->assertHeader('Content-Disposition', 'inline; filename="Penawaran Jasa Layanan Perpajakan - Marwi Sulistyarini - PEN-001-KSN-MS-IX-2026.pdf"');
});

it('edits the words of a template without changing the shape of its fields', function () {
    $template = LetterTemplate::firstWhere('code', 'penawaran-jasa');

    $this->get(route('letters.templates'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('letter-templates')
            ->has('templates', count(LetterTemplate::defaults()))
            ->where('missingDefaults', 0)
        );

    $this->get(route('letters.templates.edit', $template))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('letter-template-edit')
            ->where('template.prefix', 'PEN')
            ->has('template.fields', 4)
            ->has('placeholders.builtin')
            ->has('preview.html')
        );

    $this->patch(route('letters.templates.update', $template), [
        'name' => 'Surat Penawaran',
        'description' => null,
        'number_prefix' => 'pnw',
        'subject' => 'Penawaran Jasa',
        'recipient' => 'Pimpinan {{klien}}',
        'body' => "Dengan hormat,\n\n{{layanan}}",
        'is_active' => true,
        'fields' => [
            ['key' => 'sapaan', 'label' => 'Sapaan', 'required' => true, 'default' => 'Ibu', 'help' => null, 'placeholder' => null],
            // The type sent here is ignored: a fee table stays a fee table.
            ['key' => 'layanan', 'label' => 'Jasa', 'type' => 'text', 'required' => true, 'default' => [], 'help' => 'x', 'placeholder' => null],
            ['key' => 'keterangan_biaya', 'label' => 'Keterangan', 'required' => false, 'default' => '', 'help' => null, 'placeholder' => null],
            ['key' => 'catatan', 'label' => 'Catatan', 'required' => false, 'default' => "Satu\nDua", 'help' => null, 'placeholder' => null],
            ['key' => 'asing', 'label' => 'Tidak dikenal', 'required' => false, 'default' => null, 'help' => null, 'placeholder' => null],
        ],
    ])->assertRedirect();

    $template->refresh();
    $fields = $template->fieldDefinitions();

    expect($template->name)->toBe('Surat Penawaran')
        ->and($template->number_prefix)->toBe('PNW')
        ->and($fields)->toHaveCount(4)
        ->and($fields['layanan']['type'])->toBe('items')
        ->and($fields['layanan']['note_key'])->toBe('keterangan_biaya')
        ->and($fields['sapaan']['default'])->toBe('Ibu')
        ->and($fields['sapaan']['options'])->toHaveKey('Bapak')
        ->and($fields['keterangan_biaya']['default'])->toBeNull();

    $this->post(route('letters.templates.restore', $template))->assertRedirect();

    expect($template->fresh()->number_prefix)->toBe('PEN')
        ->and($template->fresh()->name)->toBe('Surat Penawaran Jasa');
});

it('installs the built-in templates on an empty install', function () {
    LetterTemplate::query()->delete();

    $this->get(route('letters'))
        ->assertInertia(fn ($page) => $page->where('hasTemplates', false));

    $this->post(route('letters.templates.seed'))->assertRedirect();

    expect(LetterTemplate::count())->toBe(count(LetterTemplate::defaults()));
});

it('returns to the letter form with the new client chosen when the lead was added from there', function () {
    $this->get(route('leads.create', ['lanjut' => 'surat']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('lead-create')->where('after', 'surat'));

    $this->post(route('leads.store'), [
        'entity' => 'CV',
        'company' => 'Karya Makmur',
        'pic' => 'Budi Santoso',
        'channel' => 'whatsapp',
        'service' => 'PPh Badan',
        'stage' => 'kontak',
        'entered_at' => Carbon::today()->toDateString(),
        'after' => 'surat',
    ])->assertRedirect(route('letters.create', ['lead' => Lead::firstWhere('company', 'Karya Makmur')->id]));

    // Without the marker the lead page is still where saving lands.
    $this->post(route('leads.store'), [
        'entity' => 'PT',
        'company' => 'Nusa Jaya',
        'pic' => 'Dewi',
        'channel' => 'web',
        'service' => 'PPN',
        'stage' => 'lead',
        'entered_at' => Carbon::today()->toDateString(),
    ])->assertRedirect(route('leads.show', Lead::firstWhere('company', 'Nusa Jaya')));
});

it('moves the lead to Proposal with the PDF attached when an offer is issued', function () {
    Storage::fake('local');
    $lead = prospect(['stage' => 'kontak', 'stage_changed_at' => Carbon::today()->subDays(4)]);
    $letter = offer($lead);

    $this->post(route('letters.issue.store', $letter))->assertRedirect();

    $lead->refresh();

    expect($lead->stage)->toBe('proposal')
        ->and($lead->stage_changed_at->toDateString())->toBe(Carbon::today()->toDateString())
        ->and($lead->last_contact_at->toDateString())->toBe(Carbon::today()->toDateString())
        ->and($lead->stageEvents()->where('stage', 'proposal')->count())->toBe(1)
        ->and($lead->notes)->toHaveCount(1)
        ->and($lead->notes->first()->body)->toContain('Pindah ke Proposal')
        ->and($lead->notes->first()->body)->toContain('PEN-001/KSN-MS/IX/2026');

    $attachment = $lead->attachments()->first();

    expect($attachment)->not->toBeNull()
        ->and($attachment->stage)->toBe('proposal')
        ->and($attachment->mime)->toBe('application/pdf')
        ->and($attachment->name)->toEndWith('.pdf');

    Storage::disk('local')->assertExists($attachment->path);

    // Issued again after a correction: the lead is already there, nothing is filed twice.
    $this->delete(route('letters.issue.destroy', $letter));
    $this->post(route('letters.issue.store', $letter));

    expect($lead->fresh()->stageEvents()->where('stage', 'proposal')->count())->toBe(1)
        ->and($lead->fresh()->attachments()->count())->toBe(1);
});

it('never moves a lead backwards, a closed lead, or one whose template says nothing', function () {
    Storage::fake('local');

    $signed = prospect(['company' => 'Sudah Deal', 'stage' => 'deal']);
    $this->post(route('letters.issue.store', offer($signed)));
    expect($signed->fresh()->stage)->toBe('deal')
        ->and($signed->fresh()->attachments()->count())->toBe(0);

    $closed = prospect(['company' => 'Sudah Tutup', 'stage' => 'kontak', 'status' => Lead::CLOSED, 'closed_at' => Carbon::today()]);
    $this->post(route('letters.issue.store', offer($closed)));
    expect($closed->fresh()->stage)->toBe('kontak');

    LetterTemplate::firstWhere('code', 'penawaran-jasa')->update(['stage_on_issue' => null]);
    $plain = prospect(['company' => 'Tanpa Tahap', 'stage' => 'kontak']);
    $this->post(route('letters.issue.store', offer($plain)));
    expect($plain->fresh()->stage)->toBe('kontak');
});

it('lets the template editor choose the stage a letter moves a lead to', function () {
    $template = LetterTemplate::firstWhere('code', 'penawaran-jasa');

    $this->get(route('letters.templates.edit', $template))
        ->assertInertia(fn ($page) => $page->where('template.stageOnIssue', 'proposal'));

    $payload = [
        'name' => $template->name, 'description' => null, 'number_prefix' => 'PEN',
        'subject' => $template->subject, 'recipient' => $template->recipient,
        'body' => $template->body, 'is_active' => true, 'fields' => [],
    ];

    $this->patch(route('letters.templates.update', $template), [...$payload, 'stage_on_issue' => 'deal'])->assertRedirect();
    expect($template->fresh()->stage_on_issue)->toBe('deal');

    $this->patch(route('letters.templates.update', $template), [...$payload, 'stage_on_issue' => ''])->assertRedirect();
    expect($template->fresh()->stage_on_issue)->toBeNull();

    $this->patch(route('letters.templates.update', $template), [...$payload, 'stage_on_issue' => 'bukan'])
        ->assertSessionHasErrors('stage_on_issue');
});
