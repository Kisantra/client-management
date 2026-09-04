<?php

use App\Models\Content;
use App\Models\ContentComment;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-08-20 10:00'));
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

/** A piece sitting in review, which is where the notes happen. */
function reviewedPiece(array $attributes = []): Content
{
    return Content::create([
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'type' => 'carousel',
        'status' => 'review',
        'scheduled_for' => Carbon::today()->addDays(5),
        'status_changed_at' => Carbon::today()->subDay(),
        ...$attributes,
    ]);
}

it('writes a note, signs it, and shows it on the panel newest first', function () {
    $content = reviewedPiece();

    $this->post(route('content.comments.store', $content), ['body' => 'Angka di slide 3 belum sesuai PMK terbaru.'])
        ->assertRedirect();

    Carbon::setTestNow(Carbon::parse('2026-08-20 11:00'));

    $this->post(route('content.comments.store', $content), ['body' => 'CTA-nya ganti ke konsultasi gratis.'])
        ->assertRedirect();

    expect($content->comments()->count())->toBe(2)
        ->and($content->comments->first()->author)->toBe('Admin');

    $this->get(route('content', ['bulan' => '2026-08', 'konten' => $content->id]))
        ->assertInertia(fn ($page) => $page
            ->has('selected.comments', 2)
            ->where('selected.comments.0.body', 'CTA-nya ganti ke konsultasi gratis.')
            ->where('selected.comments.0.author', 'Admin')
            ->where('selected.comments.0.resolved', false)
        );

    $this->post(route('content.comments.store', $content), ['body' => ''])
        ->assertSessionHasErrors('body');
});

it('checks a note off with a signature, and can reopen it', function () {
    $content = reviewedPiece();
    $comment = $content->comments()->create(['author' => 'Sari', 'body' => 'Perbaiki typo di judul.']);

    $this->patch(route('content.comments.update', [$content, $comment]), ['resolved' => true])
        ->assertRedirect();

    $comment->refresh();

    expect($comment->isResolved())->toBeTrue()
        ->and($comment->resolved_by)->toBe('Admin');

    $this->patch(route('content.comments.update', [$content, $comment]), ['resolved' => false])
        ->assertRedirect();

    $comment->refresh();

    expect($comment->isResolved())->toBeFalse()
        ->and($comment->resolved_by)->toBeNull();
});

it('deletes a note, and the thread goes with its piece', function () {
    $content = reviewedPiece();
    $comment = $content->comments()->create(['author' => 'Sari', 'body' => 'Perbaiki typo.']);

    $this->delete(route('content.comments.destroy', [$content, $comment]))
        ->assertRedirect();

    expect(ContentComment::find($comment->id))->toBeNull();

    $kept = $content->comments()->create(['author' => 'Sari', 'body' => 'Satu lagi.']);

    $content->delete();

    expect(ContentComment::find($kept->id))->toBeNull();
});

it('refuses to touch a note through the wrong piece', function () {
    $content = reviewedPiece();
    $other = reviewedPiece(['title' => 'Konten lain']);
    $comment = $content->comments()->create(['author' => 'Sari', 'body' => 'Punya konten pertama.']);

    $this->patch(route('content.comments.update', [$other, $comment]), ['resolved' => true])
        ->assertNotFound();

    $this->delete(route('content.comments.destroy', [$other, $comment]))
        ->assertNotFound();

    expect($comment->fresh()->isResolved())->toBeFalse();
});
