<?php

use App\Models\Activity;
use App\Models\Content;
use App\Models\ContentIdea;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-09-08 09:30:00'));
});

afterEach(fn () => Carbon::setTestNow());

function trackedLead(array $attributes = []): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Bumi Mandiri',
        'pic' => 'Dewi Wijaya',
        'channel' => 'instagram',
        'service' => 'PPh Badan',
        'stage' => 'proposal',
        'value' => 45_000_000,
        'entered_at' => Carbon::today()->subDays(20),
        'stage_changed_at' => Carbon::today()->subDays(4),
        'last_contact_at' => Carbon::today()->subDays(2),
        'stalled_at' => Carbon::today()->subDays(4),
        ...$attributes,
    ]);
}

test('guests are sent to the login page', function () {
    $this->get(route('activity'))->assertRedirect(route('login'));
});

/*
 | The log exists to answer "who changed this, and from what". A create and a
 | delete only have to name the record; an update has to carry the fields it
 | moved, or the entry is a receipt for something you still cannot see.
 */
it('records who created, changed and deleted a record, and what moved', function () {
    $this->actingAs(User::factory()->create(['name' => 'Andre']));

    $lead = trackedLead();
    $lead->update(['stage' => 'deal', 'owner' => 'Sari']);
    $lead->delete();

    $log = Activity::orderBy('id')->get();

    expect($log)->toHaveCount(3)
        ->and($log[0]->action)->toBe(Activity::CREATED)
        ->and($log[0]->actor)->toBe('Andre')
        ->and($log[0]->subject_type)->toBe('lead')
        ->and($log[0]->subject_label)->toBe('PT Bumi Mandiri')
        ->and($log[0]->diff)->toBeNull();

    expect($log[1]->action)->toBe(Activity::UPDATED)
        ->and(collect($log[1]->diff)->pluck('to', 'label')->all())->toBe([
            'Tahap' => 'deal',
            'Penanggung jawab' => 'Sari',
        ])
        ->and(collect($log[1]->diff)->firstWhere('label', 'Tahap')['from'])->toBe('proposal');

    // The record is gone; the entry still says what went.
    expect($log[2]->action)->toBe(Activity::DELETED)
        ->and($log[2]->subject_label)->toBe('PT Bumi Mandiri')
        ->and($log[2]->toRow()['url'])->toBeNull();
});

/*
 | Seeders and the social importers write thousands of rows with nobody signed
 | in. One person's edit buried under three hundred machine writes is how a log
 | stops being opened, so unattributed writes are not recorded at all.
 */
/*
 | The first cut named this column `changes`, and Eloquent's Model already
 | declares a protected $changes. Read from outside the class the attribute came
 | back fine, so every assertion here passed while the page rendered no diffs at
 | all: inside the model, $this->changes was reaching the framework's property.
 | This asserts through the method the page actually calls.
 */
it('carries the field changes all the way into the row the page renders', function () {
    $this->actingAs(User::factory()->create(['name' => 'Andre']));

    $lead = trackedLead();
    $lead->update(['stage' => 'deal', 'value' => 78_000_000]);

    $row = Activity::where('action', Activity::UPDATED)->sole()->toRow();

    expect($row['changes'])->toHaveCount(2)
        ->and(collect($row['changes'])->firstWhere('label', 'Tahap'))
        ->toMatchArray(['from' => 'proposal', 'to' => 'deal'])
        // Money reads as money, not as a raw integer.
        ->and(collect($row['changes'])->firstWhere('label', 'Estimasi nilai'))
        ->toMatchArray(['from' => '45.000.000', 'to' => '78.000.000']);
});

it('records nothing when no one is signed in', function () {
    trackedLead();

    expect(Activity::count())->toBe(0);
});

it('stays quiet when a save changed nothing worth naming', function () {
    $this->actingAs(User::factory()->create(['name' => 'Andre']));

    $lead = trackedLead();
    Activity::query()->delete();

    // Touching only a derived column the pipeline keeps in step by itself.
    $lead->update(['stalled_at' => Carbon::today()]);
    // And a save that writes the same values back.
    $lead->update(['company' => 'Bumi Mandiri']);

    expect(Activity::count())->toBe(0);
});

/*
 | Two forms write scheduled_time in two shapes — "12:00" and "12:00:00" — and
 | Eloquent calls that a change. It is the same minute, so the log should have
 | nothing to say about it.
 */
it('does not report a clock time rewritten in another shape', function () {
    $this->actingAs(User::factory()->create(['name' => 'Andre']));

    $piece = Content::create([
        'title' => 'Batas lapor SPT',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'status' => 'review',
        'scheduled_for' => Carbon::today(),
        'status_changed_at' => Carbon::today(),
        'scheduled_time' => '12:00:00',
    ]);
    Activity::query()->delete();

    $piece->update(['scheduled_time' => '12:00']);
    expect(Activity::count())->toBe(0);

    // A real move still reads, and reads in the app's own way of writing an hour.
    $piece->update(['scheduled_time' => '17:30']);

    expect(collect(Activity::sole()->toRow()['changes'])->firstWhere('label', 'Jam tayang'))
        ->toMatchArray(['from' => '12.00', 'to' => '17.30']);
});

it('never writes a password or a token into the log', function () {
    $this->actingAs(User::factory()->create(['name' => 'Andre']));

    $member = User::factory()->create(['name' => 'Sari']);
    Activity::query()->delete();

    $member->update(['name' => 'Sari Kusuma', 'password' => 'rahasia-baru']);

    $entry = Activity::sole();

    expect(collect($entry->diff)->pluck('field')->all())->toBe(['name'])
        ->and(json_encode($entry->diff))->not->toContain('rahasia-baru');
});

it('groups the page by day, newest first, and labels today and yesterday', function () {
    $this->actingAs(User::factory()->create(['name' => 'Andre']));

    Carbon::setTestNow(Carbon::parse('2026-09-06 10:00:00'));
    ContentIdea::create(['title' => 'Serial 60 detik Coretax']);

    Carbon::setTestNow(Carbon::parse('2026-09-07 14:00:00'));
    ContentIdea::create(['title' => 'Checklist tutup buku']);

    Carbon::setTestNow(Carbon::parse('2026-09-08 09:30:00'));
    ContentIdea::create(['title' => 'Beda PPh final']);

    $this->get(route('activity'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('activity')
            ->has('days', 3)
            ->where('days.0.label', 'Hari ini')
            ->where('days.0.entries.0.label', 'Beda PPh final')
            ->where('days.1.label', 'Kemarin')
            ->where('days.2.label', 'Minggu, 6 September 2026')
            ->where('summary.total', 3)
            ->where('summary.created', 3)
            ->where('summary.people', 1)
        );
});

it('filters by person, by kind and by action', function () {
    $andre = User::factory()->create(['name' => 'Andre']);
    $sari = User::factory()->create(['name' => 'Sari']);

    $this->actingAs($andre);
    $lead = trackedLead();

    $this->actingAs($sari);
    Content::create([
        'title' => 'Batas lapor SPT',
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'status' => 'review',
        'scheduled_for' => Carbon::today(),
        'status_changed_at' => Carbon::today(),
    ]);
    $lead->update(['owner' => 'Sari']);

    $this->actingAs($andre);

    $this->get(route('activity', ['siapa' => 'Sari']))
        ->assertInertia(fn ($page) => $page->where('days.0.count', 2));

    $this->get(route('activity', ['jenis' => 'konten']))
        ->assertInertia(fn ($page) => $page
            ->where('days.0.count', 1)
            ->where('days.0.entries.0.label', 'Batas lapor SPT')
        );

    $this->get(route('activity', ['aksi' => 'updated']))
        ->assertInertia(fn ($page) => $page
            ->where('days.0.count', 1)
            ->where('days.0.entries.0.action', 'updated')
        );

    /* The totals over the head of the page count the whole stretch, not the
       filtered slice: a figure that moves with its own filter cannot tell you
       what you filtered out of. */
    $this->get(route('activity', ['jenis' => 'konten']))
        ->assertInertia(fn ($page) => $page->where('summary.total', 3));
});

it('keeps the window it was asked for', function () {
    $this->actingAs(User::factory()->create(['name' => 'Andre']));

    Carbon::setTestNow(Carbon::parse('2026-07-01 09:00:00'));
    ContentIdea::create(['title' => 'Ide bulan Juli']);

    Carbon::setTestNow(Carbon::parse('2026-09-08 09:30:00'));
    ContentIdea::create(['title' => 'Ide hari ini']);

    $this->get(route('activity', ['periode' => '7-hari']))
        ->assertInertia(fn ($page) => $page->has('days', 1)->where('summary.total', 1));

    $this->get(route('activity', ['periode' => 'semua']))
        ->assertInertia(fn ($page) => $page->has('days', 2)->where('summary.total', 2));
});
