<?php

use App\Models\Content;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    // A Thursday, so the running week spans the 17th through the 23rd.
    Carbon::setTestNow(Carbon::parse('2026-08-20 10:00'));
    $this->actor = User::factory()->create(['name' => 'Admin']);
    $this->actingAs($this->actor);
});

afterEach(fn () => Carbon::setTestNow());

function teamPiece(?string $owner, string $status, string $scheduledFor, ?string $publishedAt = null): Content
{
    return Content::create([
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'type' => 'carousel',
        'status' => $status,
        'owner' => $owner,
        'scheduled_for' => $scheduledFor,
        'published_at' => $publishedAt,
        'status_changed_at' => Carbon::today(),
    ]);
}

it('merges accounts and calendar PJ names into one roster, busiest first', function () {
    User::factory()->create(['name' => 'Sari', 'role' => 'Copywriter']);

    teamPiece('Dimas', 'draft', '2026-08-25');
    teamPiece('Dimas', 'review', '2026-08-26');
    teamPiece('Sari', 'approved', '2026-08-27');
    teamPiece(null, 'draft', '2026-08-28');

    $this->get(route('team'))
        ->assertInertia(fn ($page) => $page
            ->component('team')
            ->has('members', 3)
            // Dimas carries the most, but exists only as a PJ name.
            ->where('members.0.name', 'Dimas')
            ->where('members.0.userId', null)
            ->where('members.0.draft', 1)
            ->where('members.0.review', 1)
            ->where('members.0.active', 2)
            ->where('members.1.name', 'Sari')
            ->where('members.1.role', 'Copywriter')
            ->where('members.1.isYou', false)
            ->where('members.2.name', 'Admin')
            ->where('members.2.isYou', true)
            ->where('totals.unassigned', 1)
            ->where('totals.active', 4)
            // The sidebar badge agrees with the roster.
            ->where('counts.team', 3)
        );
});

it('counts the week, the late, and the month shipped per member', function () {
    teamPiece('Sari', 'draft', '2026-08-19');      // past its date: late
    teamPiece('Sari', 'review', '2026-08-23');     // Sunday, still this week
    teamPiece('Sari', 'published', '2026-08-16', '2026-08-18'); // shipped this month
    teamPiece('Sari', 'published', '2026-07-20', '2026-07-21'); // last month: out

    $this->get(route('team'))
        ->assertInertia(fn ($page) => $page
            ->where('members.0.name', 'Sari')
            ->where('members.0.late', 1)
            ->where('members.0.week', 2)
            ->where('members.0.publishedMonth', 1)
            ->where('week.start', '2026-08-17')
            ->where('week.end', '2026-08-23')
        );
});

it('adds a member who can sign in straight away', function () {
    $this->post(route('team.store'), [
        'name' => 'Putri',
        'email' => 'putri@gmail.com',
        'password' => 'rahasia-putri',
        'role' => 'Desainer',
    ])->assertRedirect(route('team'));

    $user = User::where('email', 'putri@gmail.com')->firstOrFail();

    expect($user->name)->toBe('Putri')
        ->and($user->role)->toBe('Desainer')
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(Hash::check('rahasia-putri', $user->password))->toBeTrue();
});

it('refuses a name or email the team already uses', function () {
    User::factory()->create(['name' => 'Sari', 'email' => 'sari@gmail.com']);

    $this->post(route('team.store'), [
        'name' => 'Sari',
        'email' => 'sari-baru@gmail.com',
        'password' => 'delapan-huruf',
    ])->assertSessionHasErrors('name');

    $this->post(route('team.store'), [
        'name' => 'Sari Baru',
        'email' => 'sari@gmail.com',
        'password' => 'delapan-huruf',
    ])->assertSessionHasErrors('email');

    $this->post(route('team.store'), [
        'name' => 'Sari Baru',
        'email' => 'sari-baru@gmail.com',
        'password' => 'pendek',
    ])->assertSessionHasErrors('password');
});

it('sets and clears a role', function () {
    $member = User::factory()->create(['name' => 'Sari']);

    $this->patch(route('team.update', $member), ['role' => 'Copywriter'])
        ->assertRedirect();

    expect($member->fresh()->role)->toBe('Copywriter');

    $this->patch(route('team.update', $member), ['role' => ''])
        ->assertRedirect();

    expect($member->fresh()->role)->toBeNull();
});
