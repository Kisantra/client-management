<?php

use App\Models\User;

/*
 | The root is a doorway, not a page. Nobody outside the team has any reason
 | to be there, so it never renders anything of its own.
 */

test('the root sends a visitor to the sign-in screen', function () {
    $this->get(route('home'))->assertRedirect(route('login'));
});

test('the root sends a signed-in user to the work', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('home'))
        ->assertRedirect(route('dashboard'));
});
