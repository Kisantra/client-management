<?php

use App\Models\Content;
use App\Models\User;
use App\Notifications\ContentCommentAdded;
use App\Notifications\ContentStatusChanged;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-08-20 10:00'));
    $this->actor = User::factory()->create(['name' => 'Admin']);
    $this->teammate = User::factory()->create(['name' => 'Sari']);
    $this->actingAs($this->actor);
});

afterEach(fn () => Carbon::setTestNow());

function notifPiece(array $attributes = []): Content
{
    return Content::create([
        'title' => 'Batas Lapor SPT Badan',
        'channels' => ['instagram'],
        'type' => 'carousel',
        'status' => 'draft',
        'scheduled_for' => Carbon::today()->addDays(5),
        'status_changed_at' => Carbon::today()->subDay(),
        ...$attributes,
    ]);
}

it('tells the rest of the team when a review note lands, but not the writer', function () {
    $content = notifPiece();

    $this->post(route('content.comments.store', $content), ['body' => 'Angka di slide 3 salah.'])
        ->assertRedirect();

    expect($this->teammate->notifications()->count())->toBe(1)
        ->and($this->actor->notifications()->count())->toBe(0);

    $data = $this->teammate->notifications()->first()->data;

    expect($data['title'])->toBe('Admin menambahkan catatan review')
        ->and($data['body'])->toContain('Batas Lapor SPT Badan')
        ->and($data['url'])->toBe('/content?konten='.$content->id)
        ->and($this->teammate->notifications()->first()->type)->toBe(ContentCommentAdded::class);
});

it('tells the team when a piece moves along the flow', function () {
    $content = notifPiece();

    $this->post(route('content.status.store', $content), ['status' => 'review'])
        ->assertRedirect();

    $notification = $this->teammate->notifications()->first();

    expect($notification->type)->toBe(ContentStatusChanged::class)
        ->and($notification->data['title'])->toBe('Admin memindahkan konten ke Review')
        ->and($notification->data['body'])->toContain('Draft → Review');

    // The same move through the edit form says the same thing.
    $this->post(route('content.update', $content->fresh()), [
        'title' => $content->title,
        'channels' => ['instagram'],
        'type' => 'carousel',
        'scheduled_for' => $content->scheduled_for->toDateString(),
        'status' => 'approved',
    ])->assertRedirect();

    expect($this->teammate->notifications()->count())->toBe(2);
});

it('shares the bell with every page and marks reads', function () {
    $content = notifPiece();

    $this->post(route('content.comments.store', $content), ['body' => 'Cek CTA-nya.']);
    $this->post(route('content.status.store', $content), ['status' => 'review']);

    $this->actingAs($this->teammate);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('notifications.unread', 2)
            ->has('notifications.items', 2)
            ->where('notifications.items.0.readAt', null)
        );

    $first = $this->teammate->notifications()->first();

    $this->post(route('notifications.read', $first->id))->assertRedirect();

    expect($first->fresh()->read_at)->not->toBeNull()
        ->and($this->teammate->unreadNotifications()->count())->toBe(1);

    $this->post(route('notifications.read-all'))->assertRedirect();

    expect($this->teammate->unreadNotifications()->count())->toBe(0);
});

it('will not mark somebody else\'s notification', function () {
    $content = notifPiece();

    $this->post(route('content.comments.store', $content), ['body' => 'Punya Sari.']);

    $foreign = $this->teammate->notifications()->first();

    $this->post(route('notifications.read', $foreign->id))->assertNotFound();

    expect($foreign->fresh()->read_at)->toBeNull();
});

it('writes the database copy in the same request, even with no queue worker', function () {
    // The real queue: jobs wait in a table until a worker exists.
    config(['queue.default' => 'database']);

    $content = notifPiece();

    $this->post(route('content.comments.store', $content), ['body' => 'Tanpa worker pun lonceng harus benar.'])
        ->assertRedirect();

    // The bell's copy is already there; only the realtime push is waiting.
    expect($this->teammate->notifications()->count())->toBe(1)
        ->and(DB::table('jobs')->count())->toBeGreaterThan(0);
});
