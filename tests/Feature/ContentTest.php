<?php

use App\Models\Content;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    // A Thursday mid-month, so "this month" and weekdays land where expected.
    Carbon::setTestNow(Carbon::parse('2026-08-20'));
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

/** A carousel on Instagram, due in five days, waiting for review. */
function piece(array $attributes = []): Content
{
    return Content::create([
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'status' => 'review',
        'scheduled_for' => Carbon::today()->addDays(5),
        'status_changed_at' => Carbon::today()->subDay(),
        'owner' => 'Dimas',
        ...$attributes,
    ]);
}

it('shows the month with its pieces, status counts and what is late', function () {
    piece();
    piece(['title' => 'Insentif pajak 2026', 'channels' => ['web'], 'type' => 'artikel', 'status' => 'published', 'scheduled_for' => Carbon::today()->subDays(3), 'published_at' => Carbon::today()->subDays(3)]);
    // Due four days ago and still in draft: late.
    piece(['title' => 'Denda telat lapor SPT', 'channels' => ['tiktok'], 'type' => 'videos', 'status' => 'draft', 'scheduled_for' => Carbon::today()->subDays(4)]);
    // Next month: not on this page.
    piece(['title' => 'Kalender pajak 2026', 'channels' => ['web'], 'type' => 'artikel', 'scheduled_for' => Carbon::today()->addMonth()]);

    $this->get(route('content'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('content')
            ->where('month.key', '2026-08')
            ->where('month.label', 'Agustus 2026')
            ->where('month.prev', '2026-07')
            ->has('items', 3)
            // Ordered by date: the late one first.
            ->where('items.0.title', 'Denda telat lapor SPT')
            ->where('items.0.late', true)
            ->where('items.0.daysLate', 4)
            ->where('items.2.late', false)
            ->where('totals.count', 3)
            ->where('totals.late', 1)
            ->where('totals.published', 1)
            ->where('statuses.0.key', 'draft')
            ->where('statuses.0.count', 1)
            ->where('statuses.3.key', 'published')
            ->where('statuses.3.count', 1)
        );

    $this->get(route('content', ['bulan' => '2026-09']))
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.title', 'Kalender pajak 2026'));
});

it('finds a cross-posted piece under every channel it goes out on', function () {
    piece(['title' => 'Kenalan dengan tim', 'channels' => ['linkedin', 'facebook']]);

    foreach (['linkedin', 'facebook'] as $channel) {
        $this->get(route('content', ['channel' => $channel]))
            ->assertInertia(fn ($page) => $page
                ->has('items', 1)
                ->where('items.0.title', 'Kenalan dengan tim')
            );
    }

    // And not under one it was never posted to.
    $this->get(route('content', ['channel' => 'tiktok']))
        ->assertInertia(fn ($page) => $page->has('items', 0));
});

it('filters by channel, status, person, lateness, search and a single day', function () {
    piece();
    piece(['title' => 'Insentif pajak 2026', 'channels' => ['web'], 'type' => 'artikel', 'owner' => 'Sari', 'status' => 'draft', 'scheduled_for' => Carbon::today()->subDays(2)]);

    $this->get(route('content', ['channel' => 'web']))
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.channels', ['web']));

    $this->get(route('content', ['status' => 'review']))
        ->assertInertia(fn ($page) => $page
            ->has('items', 1)
            // The chips keep counting the statuses not chosen.
            ->where('statuses.0.count', 1)
            ->where('statuses.1.count', 1)
        );

    $this->get(route('content', ['pj' => 'Sari']))
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.owner', 'Sari'));

    $this->get(route('content', ['telat' => '1']))
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.title', 'Insentif pajak 2026'));

    $this->get(route('content', ['q' => 'spt']))
        ->assertInertia(fn ($page) => $page->has('items', 1));

    $this->get(route('content', ['hari' => Carbon::today()->addDays(5)->toDateString()]))
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('filters.hari', '2026-08-25'));
});

it('marks a piece stuck once it outstays its status tolerance', function () {
    // Review tolerates three days; this one has waited five.
    piece(['status_changed_at' => Carbon::today()->subDays(5)]);
    piece(['title' => 'Segar', 'status_changed_at' => Carbon::today()->subDay()]);

    $this->get(route('content'))
        ->assertInertia(fn ($page) => $page
            ->where('items.0.stuck', true)
            ->where('items.0.daysInStatus', 5)
            ->where('items.0.stuckAfter', 3)
            ->where('items.1.stuck', false)
        );
});

it('stores a piece with its first status on record', function () {
    $this->post(route('content.store'), [
        'title' => 'Kapan UMKM wajib jadi PKP?',
        'channels' => ['instagram', 'facebook'],
        'pillar' => 'edukasi',
        'type' => 'short_video',
        'scheduled_for' => Carbon::today()->addDays(3)->toDateString(),
        'status' => 'draft',
        'owner' => 'Putri',
        'brief' => 'Hook di tiga detik pertama.',
        'caption' => "Omzet lewat 4,8 M? Saatnya jadi PKP.\n\n#pajak",
        'reference_url' => 'https://www.pajak.go.id/id/peraturan',
    ])->assertRedirect();

    $content = Content::firstWhere('title', 'Kapan UMKM wajib jadi PKP?');

    expect($content->status)->toBe('draft')
        ->and($content->channels)->toBe(['instagram', 'facebook'])
        ->and($content->pillar)->toBe('edukasi')
        ->and($content->type)->toBe('short_video')
        ->and($content->caption)->toContain('#pajak')
        ->and($content->reference_url)->toBe('https://www.pajak.go.id/id/peraturan')
        ->and($content->status_changed_at->toDateString())->toBe(Carbon::today()->toDateString())
        ->and($content->published_at)->toBeNull()
        ->and($content->statusEvents)->toHaveCount(1)
        ->and($content->statusEvents->first()->author)->toBe('Admin');
});

it('refuses channels, pillars and types it does not publish', function () {
    // WhatsApp brings leads in; nothing is ever published there.
    $this->post(route('content.store'), [
        'title' => 'Broadcast WA',
        'channels' => ['instagram', 'whatsapp'],
        'type' => 'carousel',
        'scheduled_for' => Carbon::today()->toDateString(),
        'status' => 'draft',
    ])->assertSessionHasErrors('channels.1');

    $this->post(route('content.store'), [
        'title' => 'Bentuk yang tidak ada',
        'channels' => ['instagram'],
        'pillar' => 'bukan-pillar',
        'type' => 'hologram',
        'scheduled_for' => Carbon::today()->toDateString(),
        'status' => 'draft',
    ])->assertSessionHasErrors(['pillar', 'type']);

    // An empty set is not a piece that goes nowhere; it is an unfinished form.
    $this->post(route('content.store'), ['channels' => []])
        ->assertSessionHasErrors(['title', 'channels', 'type', 'scheduled_for', 'status']);
});

it('reads the board view and the field it is grouped by from the URL', function () {
    piece();

    $this->get(route('content', ['view' => 'papan', 'grup' => 'pillar']))
        ->assertInertia(fn ($page) => $page
            ->where('filters.view', 'papan')
            ->where('filters.grup', 'pillar')
        );

    // Anything else is the calendar, grouped the way it opens: by status.
    $this->get(route('content', ['view' => 'daftar', 'grup' => 'warna']))
        ->assertInertia(fn ($page) => $page
            ->where('filters.view', 'kalender')
            ->where('filters.grup', 'status')
        );
});

it('sets one field when a card is dropped in another column', function () {
    $content = piece(['pillar' => 'informasi', 'type' => 'carousel', 'owner' => 'Dimas']);

    $this->post(route('content.field.store', $content), [
        'field' => 'pillar',
        'value' => 'edukasi',
    ])->assertRedirect();

    expect($content->fresh()->pillar)->toBe('edukasi');

    // An empty column stands for "not decided", and dropping there clears it.
    $this->post(route('content.field.store', $content), [
        'field' => 'owner',
        'value' => '',
    ])->assertRedirect();

    expect($content->fresh()->owner)->toBeNull();

    $this->post(route('content.field.store', $content), [
        'field' => 'type',
        'value' => 'short_video',
    ])->assertRedirect();

    expect($content->fresh()->type)->toBe('short_video');

    /* Moving a card never writes history: only a status change is a step in
       a flow, and that has its own route. */
    expect($content->statusEvents()->count())->toBe(0);
});

it('refuses to set a field the board does not group by, or a value it does not know', function () {
    $content = piece();

    // Status is a step in a flow, not a value this route may write.
    $this->post(route('content.field.store', $content), [
        'field' => 'status',
        'value' => 'published',
    ])->assertSessionHasErrors('field');

    $this->post(route('content.field.store', $content), [
        'field' => 'pillar',
        'value' => 'bukan-pillar',
    ])->assertSessionHasErrors('value');

    // A piece always has a shape, so its column cannot be emptied.
    $this->post(route('content.field.store', $content), [
        'field' => 'type',
        'value' => '',
    ])->assertSessionHasErrors('value');

    expect($content->fresh()->status)->toBe('review')
        ->and($content->fresh()->pillar)->toBe('informasi')
        ->and($content->fresh()->type)->toBe('carousel');
});

it('scopes the board to its period and the calendar to its month', function () {
    piece(['title' => 'Bulan lalu', 'scheduled_for' => Carbon::parse('2026-07-14')]);
    piece(['title' => 'Bulan ini', 'scheduled_for' => Carbon::parse('2026-08-14')]);
    piece(['title' => 'Bulan depan', 'scheduled_for' => Carbon::parse('2026-09-14')]);

    // The calendar can only draw one month, so it has no period at all.
    $this->get(route('content', ['bulan' => '2026-08']))
        ->assertInertia(fn ($page) => $page
            ->where('period', null)
            ->has('items', 1)
            ->where('items.0.title', 'Bulan ini')
        );

    // The board takes any stretch, and says which one it is standing in.
    $this->get(route('content', ['view' => 'papan', 'periode' => 'kuartal']))
        ->assertInertia(fn ($page) => $page
            ->where('period.key', 'kuartal')
            ->where('period.label', 'Kuartal ini')
            ->has('items', 3)
        );

    $this->get(route('content', ['view' => 'papan', 'periode' => 'bulan-lalu']))
        ->assertInertia(fn ($page) => $page
            ->has('items', 1)
            ->where('items.0.title', 'Bulan lalu')
        );

    /* A custom range is inclusive of both its days, and names itself by them
       rather than by a preset it does not belong to. */
    $this->get(route('content', [
        'view' => 'papan',
        'periode' => 'khusus',
        'dari' => '2026-08-14',
        'sampai' => '2026-09-14',
    ]))->assertInertia(fn ($page) => $page
        ->where('period.label', '14 Agu – 14 Sep 2026')
        ->has('items', 2)
    );

    // Unbounded means unbounded: every month at once.
    $this->get(route('content', ['view' => 'papan', 'periode' => 'semua']))
        ->assertInertia(fn ($page) => $page->has('items', 3));
});

it('counts the status chips over the board period, not the month', function () {
    piece(['title' => 'Bulan lalu', 'status' => 'draft', 'scheduled_for' => Carbon::parse('2026-07-14')]);
    piece(['title' => 'Bulan ini', 'status' => 'draft', 'scheduled_for' => Carbon::parse('2026-08-14')]);

    $this->get(route('content', ['view' => 'papan', 'periode' => 'bulan-ini']))
        ->assertInertia(fn ($page) => $page->where('statuses.0.count', 1));

    $this->get(route('content', ['view' => 'papan', 'periode' => 'semua']))
        ->assertInertia(fn ($page) => $page->where('statuses.0.count', 2));
});

it('moves a piece along its flow and records every step', function () {
    $content = piece(['status' => 'draft']);

    $this->post(route('content.status.store', $content), ['status' => 'review', 'note' => 'Tolong cek angkanya.'])
        ->assertRedirect();

    $content->refresh();

    expect($content->status)->toBe('review')
        ->and($content->status_changed_at->toDateString())->toBe(Carbon::today()->toDateString())
        ->and($content->statusEvents)->toHaveCount(1)
        ->and($content->statusEvents->first()->note)->toBe('Tolong cek angkanya.');

    $this->post(route('content.status.store', $content), ['status' => 'review'])
        ->assertSessionHasErrors('status');
});

it('records when and where a piece went live, and clears it if pulled back', function () {
    $content = piece(['status' => 'approved']);

    $this->post(route('content.status.store', $content), [
        'status' => 'published',
        'url' => 'https://www.instagram.com/p/abc123/',
    ])->assertRedirect();

    $content->refresh();

    expect($content->isPublished())->toBeTrue()
        ->and($content->published_at->toDateString())->toBe(Carbon::today()->toDateString())
        ->and($content->url)->toBe('https://www.instagram.com/p/abc123/');

    $this->post(route('content.status.store', $content), ['status' => 'draft'])->assertRedirect();

    expect($content->fresh()->published_at)->toBeNull();
});

it('edits a piece and keeps the history honest when its status changes', function () {
    $content = piece();

    /* Its edit URL opens the piece's own panel, turned to the form. The
       panel's record is what the form starts from, so it carries every field
       the form has to fill. */
    $this->get(route('content.edit', $content))
        ->assertRedirect(route('content', [
            'bulan' => '2026-08',
            'konten' => $content->id,
            'ubah' => 1,
        ]));

    $this->get(route('content', ['konten' => $content->id, 'ubah' => 1]))
        ->assertInertia(fn ($page) => $page
            ->where('filters.ubah', '1')
            ->where('selected.content.title', 'Batas Lapor SPT Badan')
            ->where('selected.content.channels', ['instagram'])
            ->where('selected.content.pillar', 'informasi')
            ->where('selected.content.type', 'carousel')
            ->where('selected.content.caption', null)
            ->where('selected.content.referenceUrl', null)
        );

    $this->post(route('content.update', $content), [
        'title' => 'Batas Lapor SPT Badan 2026',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'scheduled_for' => Carbon::today()->addDays(6)->toDateString(),
        'status' => 'approved',
        'owner' => 'Dimas',
    ])->assertRedirect(route('content', ['bulan' => '2026-08', 'konten' => $content->id]));

    $content->refresh();

    expect($content->title)->toBe('Batas Lapor SPT Badan 2026')
        ->and($content->status)->toBe('approved')
        ->and($content->statusEvents->last()->status)->toBe('approved');
});

it('shows a piece with its history and the leads it brought in', function () {
    $content = piece(['status' => 'published', 'scheduled_for' => Carbon::today()->subDays(30), 'published_at' => Carbon::today()->subDays(30)]);

    $lead = fn (string $company, string $stage) => Lead::create([
        'entity' => 'PT',
        'company' => $company,
        'pic' => 'Dewi Wijaya',
        'channel' => 'instagram',
        'source' => $content->title,
        'content_id' => $content->id,
        'service' => 'PPh Badan',
        'stage' => $stage,
        'entered_at' => Carbon::today()->subDays(10),
        'stage_changed_at' => Carbon::today()->subDays(2),
        'last_contact_at' => Carbon::today()->subDays(2),
    ]);

    $lead('Sinar Rejeki', 'client');
    $lead('Bumi Artha', 'kontak');

    // Its own URL opens its month with the panel already out.
    $this->get(route('content.show', $content))
        ->assertRedirect(route('content', ['bulan' => '2026-07', 'konten' => $content->id]));

    $this->get(route('content', ['bulan' => '2026-07', 'konten' => $content->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('content')
            ->where('selected.content.leads', 2)
            ->where('selected.content.clients', 1)
            ->has('selected.leads', 2)
            ->has('selected.events', 0)
            // It went out last month, so this page counts it too.
            ->where('items.0.leads', 2)
            ->where('items.0.clients', 1)
        );

    $this->get(route('content', ['konten' => 999_999]))
        ->assertInertia(fn ($page) => $page->where('selected', null));
});

it('deletes a piece but leaves the leads that came from it', function () {
    $content = piece();

    $lead = Lead::create([
        'entity' => 'PT',
        'company' => 'Sinar Rejeki',
        'pic' => 'Dewi Wijaya',
        'channel' => 'instagram',
        'source' => $content->title,
        'content_id' => $content->id,
        'service' => 'PPh Badan',
        'stage' => 'lead',
        'entered_at' => Carbon::today(),
        'stage_changed_at' => Carbon::today(),
    ]);

    $this->delete(route('content.destroy', $content))
        ->assertRedirect(route('content', ['bulan' => '2026-08']));

    expect(Content::find($content->id))->toBeNull()
        ->and($lead->fresh()->content_id)->toBeNull()
        ->and($lead->fresh()->source)->toBe('Batas Lapor SPT Badan');
});

it('links a new lead to the piece it came from', function () {
    $content = piece(['status' => 'published', 'published_at' => Carbon::today()]);

    $this->get(route('leads.create'))
        ->assertInertia(fn ($page) => $page
            ->where('contents.instagram.0.id', $content->id)
            ->where('contents.instagram.0.title', 'Batas Lapor SPT Badan')
        );

    $this->post(route('leads.store'), [
        'entity' => 'PT',
        'company' => 'Sinar Rejeki',
        'pic' => 'Dewi Wijaya',
        'channel' => 'instagram',
        'source' => 'Batas Lapor SPT Badan',
        'content_id' => $content->id,
        'service' => 'PPh Badan',
        'stage' => 'lead',
        'entered_at' => Carbon::today()->toDateString(),
    ])->assertRedirect();

    expect(Lead::firstWhere('company', 'Sinar Rejeki')->content_id)->toBe($content->id);

    $this->post(route('leads.store'), [
        'entity' => 'PT',
        'company' => 'Tanpa Konten',
        'pic' => 'Dewi Wijaya',
        'channel' => 'instagram',
        'content_id' => 999_999,
        'service' => 'PPh Badan',
        'stage' => 'lead',
        'entered_at' => Carbon::today()->toDateString(),
    ])->assertSessionHasErrors('content_id');
});

it('opens the form on the day the calendar was clicked', function () {
    $this->get(route('content.create', ['tanggal' => '2026-08-27', 'channel' => 'web']))
        ->assertRedirect(route('content', ['bulan' => '2026-08', 'tambah' => 1, 'tanggal' => '2026-08-27', 'channel' => 'web']));

    $this->get(route('content', ['tambah' => 1, 'tanggal' => '2026-08-27', 'channel' => 'web']))
        ->assertInertia(fn ($page) => $page
            ->where('filters.tambah', '1')
            ->where('filters.tanggal', '2026-08-27')
            ->where('filters.channel', 'web')
            ->where('filters.ubah', '')
        );

    // Nonsense falls back to today, and to no channel.
    $this->get(route('content.create', ['tanggal' => 'bukan-tanggal', 'channel' => 'whatsapp']))
        ->assertRedirect(route('content', ['bulan' => '2026-08', 'tambah' => 1, 'tanggal' => '2026-08-20']));
});

it('counts published against planned for the dashboard and the sidebar', function () {
    piece(['status' => 'published', 'scheduled_for' => Carbon::today()->subDays(2), 'published_at' => Carbon::today()->subDays(2)]);
    piece(['title' => 'Dua', 'status' => 'approved']);
    piece(['title' => 'Tiga', 'status' => 'draft', 'scheduled_for' => Carbon::today()->addMonth()]);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('summary.published.value', 1)
            ->where('summary.published.planned', 2)
            ->where('counts.content', 2)
        );
});

it('saves the hour a piece goes out, and lets it stay undecided', function () {
    $this->post(route('content.store'), [
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'type' => 'single_photo',
        'scheduled_for' => Carbon::today()->addDays(3)->toDateString(),
        'scheduled_time' => '09:00',
        'status' => 'draft',
    ])->assertRedirect();

    expect(Content::firstWhere('title', 'Batas Lapor SPT Badan')->scheduledTime())
        ->toBe('09:00');

    // A date can be fixed before the hour is; that is a state, not an error.
    $this->post(route('content.store'), [
        'title' => 'Checklist dokumen pajak',
        'channels' => ['instagram'],
        'type' => 'single_photo',
        'scheduled_for' => Carbon::today()->addDays(4)->toDateString(),
        'scheduled_time' => '',
        'status' => 'draft',
    ])->assertRedirect();

    expect(Content::firstWhere('title', 'Checklist dokumen pajak')->scheduledTime())
        ->toBeNull();
});

it('refuses an hour it cannot read', function () {
    $this->post(route('content.store'), [
        'title' => 'Jam ngawur',
        'channels' => ['instagram'],
        'type' => 'single_photo',
        'scheduled_for' => Carbon::today()->toDateString(),
        'scheduled_time' => 'pagi',
        'status' => 'draft',
    ])->assertSessionHasErrors('scheduled_time');

    expect(Content::where('title', 'Jam ngawur')->exists())->toBeFalse();
});

it('runs a day in the order the pieces go out', function () {
    $day = Carbon::today()->addDays(2);

    piece(['title' => 'Sore', 'scheduled_for' => $day, 'scheduled_time' => '17:00']);
    piece(['title' => 'Belum dijadwalkan', 'scheduled_for' => $day, 'scheduled_time' => null]);
    piece(['title' => 'Pagi', 'scheduled_for' => $day, 'scheduled_time' => '07:00']);

    $this->get(route('content', ['bulan' => $day->format('Y-m'), 'hari' => $day->toDateString()]))
        ->assertInertia(fn ($page) => $page
            ->where('items.0.title', 'Pagi')
            ->where('items.0.scheduledTime', '07:00')
            ->where('items.1.title', 'Sore')
            // No hour decided yet, so it sits after the ones that have one.
            ->where('items.2.title', 'Belum dijadwalkan')
            ->where('items.2.scheduledTime', null)
        );
});

it('hands the edit form the hour in the shape the field takes', function () {
    $content = piece(['scheduled_time' => '19:00']);

    /* The panel is what the form starts from, so the hour has to reach it
       in the shape the `time` input takes: 19:00, not 19:00:00. */
    $this->get(route('content', [
        'bulan' => $content->scheduled_for->format('Y-m'),
        'konten' => $content->id,
        'ubah' => 1,
    ]))->assertInertia(fn ($page) => $page
        ->where('selected.content.scheduledTime', '19:00')
    );
});
