<?php

use App\Models\Content;
use App\Models\ContentIdea;
use App\Models\NewsItem;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-08-20'));
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

function idea(array $attributes = []): ContentIdea
{
    return ContentIdea::create([
        'title' => 'Serial 60 detik paham Coretax',
        'channel' => 'tiktok',
        'note' => 'Satu fitur per episode.',
        'author' => 'Sari',
        ...$attributes,
    ]);
}

it('lists ideas with the waiting ones first, then the scheduled with their piece', function () {
    $content = Content::create([
        'title' => 'Behind the scene tim audit',
        'channels' => ['instagram'],
        'type' => 'single_photo',
        'status' => 'approved',
        'scheduled_for' => Carbon::today()->addDays(3),
        'status_changed_at' => Carbon::today(),
    ]);

    idea(['title' => 'Behind the scene tim audit', 'content_id' => $content->id]);
    idea();

    $this->get(route('content.ideas'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('content-ideas')
            ->has('ideas', 2)
            ->where('ideas.0.title', 'Serial 60 detik paham Coretax')
            ->where('ideas.0.content', null)
            ->where('ideas.1.content.title', 'Behind the scene tim audit')
            ->where('ideas.1.content.status', 'approved')
        );
});

it('writes an idea down with only a title, and refuses less', function () {
    $this->post(route('content.ideas.store'), [
        'title' => 'Q&A langsung: SP2DK itu apa',
    ])->assertRedirect();

    expect(ContentIdea::firstWhere('title', 'Q&A langsung: SP2DK itu apa')->author)->toBe('Admin');

    $this->post(route('content.ideas.store'), ['note' => 'tanpa judul'])
        ->assertSessionHasErrors('title');

    $this->post(route('content.ideas.store'), ['title' => 'X', 'channel' => 'whatsapp'])
        ->assertSessionHasErrors('channel');
});

it('deletes an idea', function () {
    $one = idea();

    $this->delete(route('content.ideas.destroy', $one))->assertRedirect();

    expect(ContentIdea::find($one->id))->toBeNull();
});

it('links the idea to the piece it becomes when the form names it', function () {
    $one = idea();

    $this->post(route('content.store'), [
        'title' => $one->title,
        'channels' => ['tiktok'],
        'type' => 'short_video',
        'scheduled_for' => Carbon::today()->addDays(5)->toDateString(),
        'status' => 'draft',
        'idea_id' => $one->id,
    ])->assertRedirect();

    $content = Content::firstWhere('title', $one->title);

    expect($one->fresh()->content_id)->toBe($content->id);

    // A nonsense idea id is refused before anything is written.
    $this->post(route('content.store'), [
        'title' => 'Lain',
        'channels' => ['tiktok'],
        'type' => 'short_video',
        'scheduled_for' => Carbon::today()->toDateString(),
        'status' => 'draft',
        'idea_id' => 999_999,
    ])->assertSessionHasErrors('idea_id');
});

it('turns a news story into an idea once, and only once', function () {
    $news = NewsItem::create([
        'title' => 'Aturan baru insentif pajak UMKM',
        'source' => 'Regulasi',
        'url' => 'https://contoh.example/berita/insentif',
        'summary' => 'Batas omzet berubah.',
        'published_at' => Carbon::today()->subDay(),
    ]);

    $this->get(route('content.news'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('content-news')
            ->has('items', 1)
            ->where('items.0.ideaId', null)
        );

    $this->post(route('content.news.idea', $news))->assertRedirect();

    $news->refresh();
    $idea = ContentIdea::firstWhere('title', 'Aturan baru insentif pajak UMKM');

    expect($news->content_idea_id)->toBe($idea->id)
        ->and($idea->source_url)->toBe('https://contoh.example/berita/insentif')
        ->and($idea->note)->toBe('Batas omzet berubah.');

    // Pressing again adds nothing.
    $this->post(route('content.news.idea', $news))->assertRedirect();

    expect(ContentIdea::count())->toBe(1);

    // Deleting the idea frees the story to be saved again.
    $idea->delete();

    expect($news->fresh()->content_idea_id)->toBeNull();
});
