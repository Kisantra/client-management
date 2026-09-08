<?php

use App\Models\Content;
use App\Models\User;
use Illuminate\Support\Carbon;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});

/*
 | Every row of "Konten minggu ini" is a link to the piece it names, and the
 | dashboard builds that link from the id alone. Two things have to hold for
 | the row to land anywhere useful, and neither is visible from the component:
 | the queue has to carry the id, and the id's own URL has to open the piece's
 | month rather than today's. A piece owed since July is exactly the case that
 | breaks if either half slips, so that is the one under test.
 */
it('gives every queued piece an id that opens its own month with the panel out', function () {
    Carbon::setTestNow(Carbon::parse('2026-09-08'));
    $this->actingAs(User::factory()->create());

    $overdue = Content::create([
        'title' => 'Denda telat lapor SPT',
        'channels' => ['tiktok'],
        'pillar' => 'informasi',
        'type' => 'videos',
        'status' => 'review',
        'owner' => 'Andre',
        // Two months behind and still not out: late, so it is queued whatever
        // week it was meant for.
        'scheduled_for' => '2026-07-02',
        'scheduled_time' => '17:00',
        'status_changed_at' => '2026-06-28',
    ]);

    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('queue.items.0.id', $overdue->id)
            ->where('queue.items.0.title', 'Denda telat lapor SPT')
            // Breached work sorts first, which is why row zero is this one.
            ->where('queue.items.0.rank', 0)
            ->where('queue.items.0.late', true)
        );

    $this->get(route('content.show', $overdue))
        ->assertRedirect(route('content', ['bulan' => '2026-07', 'konten' => $overdue->id]));

    $this->get(route('content', ['bulan' => '2026-07', 'konten' => $overdue->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('content')
            ->where('month.key', '2026-07')
            ->where('selected.content.id', $overdue->id)
            ->where('selected.content.title', 'Denda telat lapor SPT')
        );

    Carbon::setTestNow();
});
