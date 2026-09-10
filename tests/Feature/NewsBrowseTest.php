<?php

use App\Models\ContentIdea;
use App\Models\NewsItem;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    Carbon::setTestNow('2026-09-03 09:00:00');
    $this->actingAs(User::factory()->create(['name' => 'Admin']));
});

afterEach(fn () => Carbon::setTestNow());

function story(array $attributes = []): NewsItem
{
    return NewsItem::create([
        'title' => 'Tarif bunga perpajakan diperbarui',
        'source' => 'DDTCNews',
        'category' => 'Kebijakan',
        'summary' => 'Berlaku untuk periode September.',
        'url' => 'https://example.test/'.fake()->unique()->numberBetween(1, 99999),
        'published_at' => '2026-09-02 09:00:00',
        ...$attributes,
    ]);
}

/*
 | The archive is two thousand stories deep. The page used to send every one of
 | them in a single payload, which is the whole reason none of this existed.
 */
it('sends one page of stories rather than the whole archive', function () {
    foreach (range(1, 60) as $n) {
        story([
            'title' => 'Berita '.$n,
            'published_at' => Carbon::parse('2026-09-02 09:00:00')->subMinutes($n),
        ]);
    }

    $this->get(route('content.news'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('content-news')
            // Fifty on the page, and the count says how many there are in all.
            ->where('page.shown', 50)
            ->where('page.hasMore', true)
            ->where('total', 60)
            ->where('page.prev', null)
        );

    $this->get(route('content.news', ['page' => 2]))
        ->assertInertia(fn ($page) => $page
            ->where('page.shown', 10)
            ->where('page.hasMore', false)
        );
});

it('searches what a story said, what it was about and who ran it', function () {
    story(['title' => 'Tarif bunga September', 'source' => 'DDTCNews']);
    story(['title' => 'Insentif UMKM', 'summary' => 'Menyebut tarif bunga juga.', 'source' => 'Ortax']);
    story(['title' => 'Kabar lain', 'summary' => 'Tidak relevan.', 'source' => 'Pajakku']);

    // The title of one, the summary of another.
    $this->get(route('content.news', ['q' => 'tarif bunga']))
        ->assertInertia(fn ($page) => $page->where('total', 2));

    /* Source is searchable on purpose: three hundred and eighty of them ran a
       story each, and a picker cannot hold that tail. */
    $this->get(route('content.news', ['q' => 'Pajakku']))
        ->assertInertia(fn ($page) => $page
            ->where('total', 1)
            ->where('days.0.items.0.title', 'Kabar lain')
        );
});

it('filters by category and by source', function () {
    story(['title' => 'A', 'category' => 'Kebijakan', 'source' => 'DDTCNews']);
    story(['title' => 'B', 'category' => 'Regulasi', 'source' => 'DDTCNews']);
    story(['title' => 'C', 'category' => 'Regulasi', 'source' => 'Ortax']);

    $this->get(route('content.news', ['kategori' => 'Regulasi']))
        ->assertInertia(fn ($page) => $page->where('total', 2));

    $this->get(route('content.news', ['sumber' => 'DDTCNews']))
        ->assertInertia(fn ($page) => $page->where('total', 2));

    $this->get(route('content.news', ['kategori' => 'Regulasi', 'sumber' => 'Ortax']))
        ->assertInertia(fn ($page) => $page
            ->where('total', 1)
            ->where('days.0.items.0.title', 'C')
        );
});

/*
 | A facet counted through its own filter can only ever repeat the number
 | already on screen. Counted past it, each chip says what choosing it would
 | find — which is the only thing that makes a row of chips worth reading.
 */
it('counts each category past its own filter, and every other filter through', function () {
    story(['title' => 'A', 'category' => 'Kebijakan', 'source' => 'DDTCNews']);
    story(['title' => 'B', 'category' => 'Regulasi', 'source' => 'DDTCNews']);
    story(['title' => 'C', 'category' => 'Regulasi', 'source' => 'Ortax']);

    $this->get(route('content.news', ['kategori' => 'Kebijakan']))
        ->assertInertia(fn ($page) => $page
            // Still both categories, with their real sizes.
            ->has('categories', 2)
            ->where('categories.0', ['key' => 'Regulasi', 'count' => 2])
            ->where('categories.1', ['key' => 'Kebijakan', 'count' => 1])
        );

    // The source filter does narrow them: it is not the facet's own filter.
    $this->get(route('content.news', ['sumber' => 'Ortax']))
        ->assertInertia(fn ($page) => $page
            ->has('categories', 1)
            ->where('categories.0', ['key' => 'Regulasi', 'count' => 1])
        );
});

it('keeps a chosen source in its own picker even when it is too small to be offered', function () {
    // Fifteen sources with volume, so the small one cannot make the top list.
    foreach (range(1, 15) as $n) {
        story(['source' => 'Besar '.$n, 'title' => 'x'.$n]);
        story(['source' => 'Besar '.$n, 'title' => 'y'.$n]);
    }

    story(['source' => 'Sumber Kecil', 'title' => 'Satu-satunya']);

    $this->get(route('content.news', ['sumber' => 'Sumber Kecil']))
        ->assertInertia(fn ($page) => $page
            ->where('total', 1)
            /* Without this the source would disappear from the picker the
               moment it was chosen, leaving no way back out of it. */
            ->where('sources.14', ['key' => 'Sumber Kecil', 'count' => 1])
        );
});

it('can show only what nobody has turned into an idea yet', function () {
    story(['title' => 'Belum dipakai']);
    story([
        'title' => 'Sudah dipakai',
        'content_idea_id' => ContentIdea::create(['title' => 'Sudah dipakai'])->id,
    ]);

    $this->get(route('content.news'))
        ->assertInertia(fn ($page) => $page->where('total', 2)->where('unused', 1));

    $this->get(route('content.news', ['ide' => 'belum']))
        ->assertInertia(fn ($page) => $page
            ->where('total', 1)
            ->where('days.0.items.0.title', 'Belum dipakai')
        );
});

it('groups a page into the days its stories ran, newest first', function () {
    story(['title' => 'Kemarin', 'published_at' => '2026-09-02 09:00:00']);
    story(['title' => 'Hari ini pagi', 'published_at' => '2026-09-03 07:00:00']);
    story(['title' => 'Hari ini siang', 'published_at' => '2026-09-03 11:00:00']);

    $this->get(route('content.news'))
        ->assertInertia(fn ($page) => $page
            ->has('days', 2)
            ->where('days.0.key', '2026-09-03')
            ->where('days.0.count', 2)
            ->where('days.0.items.0.title', 'Hari ini siang')
            ->where('days.1.key', '2026-09-02')
        );
});
