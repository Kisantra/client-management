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
        'channel' => 'instagram',
        'format' => 'carousel',
        'status' => 'review',
        'scheduled_for' => Carbon::today()->addDays(5),
        'status_changed_at' => Carbon::today()->subDay(),
        'owner' => 'Dimas',
        ...$attributes,
    ]);
}

it('shows the month with its pieces, status counts and what is late', function () {
    piece();
    piece(['title' => 'Insentif pajak 2026', 'channel' => 'web', 'format' => 'artikel', 'status' => 'published', 'scheduled_for' => Carbon::today()->subDays(3), 'published_at' => Carbon::today()->subDays(3)]);
    // Due four days ago and still in draft: late.
    piece(['title' => 'Denda telat lapor SPT', 'channel' => 'tiktok', 'format' => 'video', 'status' => 'draft', 'scheduled_for' => Carbon::today()->subDays(4)]);
    // Next month: not on this page.
    piece(['title' => 'Kalender pajak 2026', 'channel' => 'web', 'format' => 'artikel', 'scheduled_for' => Carbon::today()->addMonth()]);

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

it('filters by channel, status, person, lateness, search and a single day', function () {
    piece();
    piece(['title' => 'Insentif pajak 2026', 'channel' => 'web', 'format' => 'artikel', 'owner' => 'Sari', 'status' => 'draft', 'scheduled_for' => Carbon::today()->subDays(2)]);

    $this->get(route('content', ['channel' => 'web']))
        ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.channel', 'web'));

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
        'channel' => 'instagram',
        'format' => 'reels',
        'scheduled_for' => Carbon::today()->addDays(3)->toDateString(),
        'status' => 'draft',
        'owner' => 'Putri',
        'brief' => 'Hook di tiga detik pertama.',
    ])->assertRedirect();

    $content = Content::firstWhere('title', 'Kapan UMKM wajib jadi PKP?');

    expect($content->status)->toBe('draft')
        ->and($content->status_changed_at->toDateString())->toBe(Carbon::today()->toDateString())
        ->and($content->published_at)->toBeNull()
        ->and($content->statusEvents)->toHaveCount(1)
        ->and($content->statusEvents->first()->author)->toBe('Admin');
});

it('refuses a format that does not belong to the channel', function () {
    $this->post(route('content.store'), [
        'title' => 'Reels di LinkedIn',
        'channel' => 'linkedin',
        'format' => 'reels',
        'scheduled_for' => Carbon::today()->toDateString(),
        'status' => 'draft',
    ])->assertSessionHasErrors('format');

    $this->post(route('content.store'), ['channel' => 'whatsapp'])
        ->assertSessionHasErrors(['title', 'channel', 'format', 'scheduled_for', 'status']);
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

    // Its edit URL opens the calendar with the form already up.
    $this->get(route('content.edit', $content))
        ->assertRedirect(route('content', ['bulan' => '2026-08', 'ubah' => $content->id]));

    $this->get(route('content', ['ubah' => $content->id]))
        ->assertInertia(fn ($page) => $page
            ->where('editing.title', 'Batas Lapor SPT Badan')
            ->where('editing.format', 'carousel')
        );

    $this->post(route('content.update', $content), [
        'title' => 'Batas Lapor SPT Badan 2026',
        'channel' => 'instagram',
        'format' => 'carousel',
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
            ->where('editing', null)
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
