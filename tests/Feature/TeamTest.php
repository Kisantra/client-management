<?php

use App\Models\Content;
use App\Models\Lead;
use App\Models\LeadNote;
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

function teamLead(?string $owner): Lead
{
    return Lead::create([
        'entity' => 'PT',
        'company' => 'Bumi '.fake()->unique()->numberBetween(1, 99999),
        'pic' => 'Dewi',
        'channel' => 'instagram',
        'service' => 'PPh Badan',
        'stage' => 'lead',
        'value' => 10_000_000,
        'owner' => $owner,
        'entered_at' => '2026-08-10',
        'stage_changed_at' => '2026-08-10',
        'last_contact_at' => '2026-08-10',
        'stalled_at' => '2026-08-30',
    ]);
}

/*
 | Work is tied to people by the exact name, so a rename that touched only the
 | account would orphan everything they hold.
 */
it('renames an account everywhere the old name was written', function () {
    $sari = User::factory()->create(['name' => 'Sari', 'email' => 'sari@gmail.com']);
    $piece = teamPiece('Sari', 'draft', '2026-08-25');
    $lead = teamLead('Sari');
    LeadNote::create(['lead_id' => $lead->id, 'author' => 'Sari', 'body' => 'Sudah ditelepon.']);
    teamPiece('Dimas', 'draft', '2026-08-25');

    $this->patch(route('team.update', $sari), [
        'name' => 'Sari Wulandari',
        'email' => 'sari.w@gmail.com',
        'role' => 'Copywriter',
        'password' => 'sandi-baru-sari',
    ])->assertRedirect()->assertSessionHasNoErrors();

    $sari->refresh();

    expect($sari->name)->toBe('Sari Wulandari')
        ->and($sari->email)->toBe('sari.w@gmail.com')
        ->and($sari->role)->toBe('Copywriter')
        ->and(Hash::check('sandi-baru-sari', $sari->password))->toBeTrue()
        ->and($piece->fresh()->owner)->toBe('Sari Wulandari')
        ->and($lead->fresh()->owner)->toBe('Sari Wulandari')
        ->and(LeadNote::first()->author)->toBe('Sari Wulandari')
        ->and(Content::where('owner', 'Dimas')->count())->toBe(1);
});

it('keeps the password when the edit leaves it blank, and refuses a taken name', function () {
    $sari = User::factory()->create(['name' => 'Sari', 'password' => 'sandi-lama-sari']);
    User::factory()->create(['name' => 'Dimas']);

    $this->patch(route('team.update', $sari), ['name' => 'Sari', 'email' => $sari->email, 'password' => ''])
        ->assertSessionHasNoErrors();

    expect(Hash::check('sandi-lama-sari', $sari->fresh()->password))->toBeTrue();

    $this->patch(route('team.update', $sari), ['name' => 'Dimas', 'email' => $sari->email])
        ->assertSessionHasErrors('name');
});

it('removes an account and hands its work to a teammate', function () {
    $sari = User::factory()->create(['name' => 'Sari']);
    $piece = teamPiece('Sari', 'review', '2026-08-25');
    $lead = teamLead('Sari');
    teamPiece('Dimas', 'draft', '2026-08-26');

    $this->delete(route('team.destroy', $sari), ['handover' => 'give', 'to' => 'Dimas'])
        ->assertRedirect()->assertSessionHasNoErrors();

    expect(User::find($sari->id))->toBeNull()
        ->and($piece->fresh()->owner)->toBe('Dimas')
        ->and($lead->fresh()->owner)->toBe('Dimas');
});

it('can clear the work, or leave the name on it as a PJ without an account', function () {
    $sari = User::factory()->create(['name' => 'Sari']);
    $dimas = User::factory()->create(['name' => 'Dimas']);
    $sariPiece = teamPiece('Sari', 'review', '2026-08-25');
    $dimasPiece = teamPiece('Dimas', 'review', '2026-08-25');

    $this->delete(route('team.destroy', $sari), ['handover' => 'clear'])->assertSessionHasNoErrors();
    $this->delete(route('team.destroy', $dimas), ['handover' => 'keep'])->assertSessionHasNoErrors();

    expect($sariPiece->fresh()->owner)->toBeNull()
        ->and($dimasPiece->fresh()->owner)->toBe('Dimas')
        ->and(User::count())->toBe(1);

    // Dimas stays on the roster, now as a name without an account.
    $this->get(route('team'))->assertInertia(fn ($page) => $page
        ->where('members.0.name', 'Dimas')
        ->where('members.0.userId', null)
    );
});

it('will not delete the signed-in account, or hand work to a stranger', function () {
    $sari = User::factory()->create(['name' => 'Sari']);

    $this->delete(route('team.destroy', $this->actor), ['handover' => 'keep'])
        ->assertSessionHasErrors('member');

    $this->delete(route('team.destroy', $sari), ['handover' => 'give', 'to' => 'Siapa'])
        ->assertSessionHasErrors('to');

    $this->delete(route('team.destroy', $sari), ['handover' => 'give', 'to' => 'Sari'])
        ->assertSessionHasErrors('to');

    expect(User::count())->toBe(2);
});

it('renames and removes a PJ who has no account', function () {
    $piece = teamPiece('Andre', 'draft', '2026-08-25');
    $lead = teamLead('Andre');
    teamPiece('Bayu', 'draft', '2026-08-25');

    $this->patch(route('team.pj.update'), ['name' => 'Andre', 'to' => 'Andre Pratama'])
        ->assertSessionHasNoErrors();

    expect($piece->fresh()->owner)->toBe('Andre Pratama')
        ->and($lead->fresh()->owner)->toBe('Andre Pratama');

    // An account's name belongs to its own row.
    $this->patch(route('team.pj.update'), ['name' => 'Andre Pratama', 'to' => 'Admin'])
        ->assertSessionHasErrors('to');

    $this->delete(route('team.pj.destroy'), ['name' => 'Andre Pratama', 'handover' => 'give', 'to' => 'Bayu'])
        ->assertSessionHasNoErrors();

    expect($piece->fresh()->owner)->toBe('Bayu')
        ->and($lead->fresh()->owner)->toBe('Bayu');

    // Accounts go through their own route.
    $this->delete(route('team.pj.destroy'), ['name' => 'Admin', 'handover' => 'clear'])
        ->assertSessionHasErrors('name');
});

it('lists a PJ who only holds leads, with what each member holds', function () {
    teamLead('Putri');
    teamLead('Putri');
    teamPiece('Putri', 'published', '2026-08-01', '2026-08-01');

    $this->get(route('team'))->assertInertia(fn ($page) => $page
        ->where('members.1.name', 'Putri')
        ->where('members.1.contentCount', 1)
        ->where('members.1.leadCount', 2)
    );
});

/*
 | A name that exists only as PJ can be given its account from the edit form:
 | the email and password it signs in with, under the name as edited, already
 | holding the work that name carries.
 */
it('gives a PJ without an account its email and password from the edit', function () {
    $piece = teamPiece('Andre', 'draft', '2026-08-25');

    $this->patch(route('team.pj.update'), [
        'name' => 'Andre',
        'to' => 'Andre Pratama',
        'email' => 'andre@gmail.com',
        'password' => 'sandi-andre-1',
        'role' => 'Editor video',
    ])->assertSessionHasNoErrors();

    $andre = User::where('email', 'andre@gmail.com')->firstOrFail();

    expect($andre->name)->toBe('Andre Pratama')
        ->and($andre->role)->toBe('Editor video')
        ->and($andre->email_verified_at)->not->toBeNull()
        ->and(Hash::check('sandi-andre-1', $andre->password))->toBeTrue()
        ->and($piece->fresh()->owner)->toBe('Andre Pratama');

    // Now an account, the roster row carries its email.
    $this->get(route('team'))->assertInertia(fn ($page) => $page
        ->where('members.0.name', 'Andre Pratama')
        ->where('members.0.email', 'andre@gmail.com')
    );
});

it('asks for the email and the password together, and not an email in use', function () {
    teamPiece('Andre', 'draft', '2026-08-25');

    $this->patch(route('team.pj.update'), ['name' => 'Andre', 'to' => 'Andre', 'email' => 'andre@gmail.com'])
        ->assertSessionHasErrors('password');

    $this->patch(route('team.pj.update'), ['name' => 'Andre', 'to' => 'Andre', 'password' => 'sandi-andre-1'])
        ->assertSessionHasErrors('email');

    $this->patch(route('team.pj.update'), [
        'name' => 'Andre',
        'to' => 'Andre',
        'email' => $this->actor->email,
        'password' => 'sandi-andre-1',
    ])->assertSessionHasErrors('email');

    expect(User::count())->toBe(1);
});
