<?php

use App\Models\Content;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    // A Wednesday, so the week has days on both sides of today.
    Carbon::setTestNow('2026-09-09 09:00:00');
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

function due(string $owner, string $on, string $status = 'review'): Content
{
    return Content::create([
        'title' => 'Konten '.fake()->unique()->numberBetween(1, 99999),
        'channels' => ['instagram'],
        'pillar' => 'informasi',
        'type' => 'carousel',
        'status' => $status,
        'owner' => $owner,
        'scheduled_for' => $on,
        'status_changed_at' => $on,
    ]);
}

/*
 | Every figure in this panel used to be a literal in a front-end file: five
 | invented names, invented loads, and a capacity of eight nobody had agreed to.
 */
it('counts what the calendar actually has on each person this week', function () {
    due('Dimas', '2026-09-08');
    due('Dimas', '2026-09-10');
    due('Dimas', '2026-09-12');
    due('Sari', '2026-09-09');

    // Next week, so outside the window.
    due('Sari', '2026-09-16');
    // Last week, likewise.
    due('Dimas', '2026-09-05');

    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('load.total', 4)
            ->where('load.busiest', 3)
            ->where('load.window', '7–13 Sep')
            ->where('load.members.0.name', 'Dimas')
            ->where('load.members.0.due', 3)
            ->where('load.members.1.name', 'Sari')
            ->where('load.members.1.due', 1)
        );
});

/*
 | A name with nothing this week is the reading somebody came here for, so the
 | roster is the list rather than only the people who happen to have work.
 */
it('keeps a person with nothing to do on the list', function () {
    due('Dimas', '2026-09-09');
    // Putri owns work outside the week, which is what puts her on the roster.
    due('Putri', '2026-10-02');

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('load.members.0', ['name' => 'Dimas', 'initials' => 'D', 'due' => 1, 'late' => 0])
            ->where('load.members.1.name', 'Admin')
            ->where('load.members.1.due', 0)
            ->where('load.members.2.name', 'Putri')
            ->where('load.members.2.due', 0)
        );
});

/*
 | Six pieces due is a week; six pieces due of which three have slipped is a
 | different week, and the count alone cannot tell them apart.
 */
it('separates work that has already slipped from work still ahead', function () {
    due('Dimas', '2026-09-07');           // Monday, past and not out: late.
    due('Dimas', '2026-09-11');           // Friday, still ahead.
    due('Sari', '2026-09-07', 'published'); // Past but out: not late.

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('load.members.0.name', 'Dimas')
            ->where('load.members.0.due', 2)
            ->where('load.members.0.late', 1)
            ->where('load.members.1.name', 'Sari')
            ->where('load.members.1.late', 0)
        );
});

it('says nothing about capacity, because nobody has set one', function () {
    due('Dimas', '2026-09-09');

    $response = $this->get(route('dashboard'))->assertOk();

    /* The bars are measured against the busiest person and the panel states
       that. A target nobody agreed to would be an invented line to call people
       over. */
    $response->assertInertia(fn ($page) => $page
        ->has('load.busiest')
        ->missing('load.capacity')
    );

    expect($response->content())->not->toContain('kapasitas');
});

it('reads an empty week without dividing by nothing', function () {
    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('load.total', 0)
            ->where('load.busiest', 0)
        );
});
