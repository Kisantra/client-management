<?php

use App\Models\ContentIdea;
use App\Models\NewsItem;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

/*
| The sheet these tests imitate is not a clean export. Every quirk asserted
| here was measured in the real one first: Indonesian month names, a second
| date format, Google News redirect links well past 255 characters, the
| publisher hidden in the tail of the headline, and the same story arriving
| again the next morning with a different score.
*/

beforeEach(function () {
    /* Pinned, because every assertion here is about a seven-day window. */
    Carbon::setTestNow('2026-09-03 09:00:00');
});

/** @param array<int, array<int, string>> $rows */
function sheet(array $rows): string
{
    /* Including the stray spaces the real sheet has in its headings. */
    $csv = "Tanggal ,Judul ,Link ,Skor, Kategori ,Ringkasan\n";

    foreach ($rows as $row) {
        $csv .= implode(',', array_map(
            fn ($cell) => '"'.str_replace('"', '""', (string) $cell).'"',
            $row,
        ))."\n";
    }

    return $csv;
}

/**
 * The body the fake sheet answers with, read through a holder rather than
 * captured.
 *
 * `Http::fake()` merges its stubs instead of replacing them, and the first
 * matching stub wins — so a test that fakes the sheet twice would keep getting
 * the first answer forever. Reading the body at request time is what lets a
 * second sync see a second sheet.
 */
function sheetBody(?string $set = null): string
{
    static $body = '';

    if ($set !== null) {
        $body = $set;
    }

    return $body;
}

function fakeSheet(array $rows): void
{
    sheetBody(sheet($rows));

    Http::fake(['docs.google.com/*' => fn () => Http::response(sheetBody())]);
}

test('it reads a row the way the sheet actually writes one', function () {
    $link = 'https://news.google.com/rss/articles/'.str_repeat('CBMinwFBVV95cUxQ', 30);

    fakeSheet([
        ['02 Sep 2026, 14.30', 'Coretax Akan Lebih Stabil dan Cepat - Ortax', $link, '10', 'DJP/Operasional', 'DJP membenahi algoritma.'],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    $item = NewsItem::sole();

    expect($item->title)->toBe('Coretax Akan Lebih Stabil dan Cepat')
        ->and($item->source)->toBe('Ortax')
        ->and($item->category)->toBe('DJP/Operasional')
        ->and($item->score)->toBe(10)
        ->and($item->summary)->toBe('DJP membenahi algoritma.')
        ->and($item->published_at->toDateTimeString())->toBe('2026-09-02 14:30:00')
        /* The column had to become TEXT for this: 77% of the sheet's links
           are longer than a varchar(255) would hold. */
        ->and($item->url)->toBe($link)
        ->and(mb_strlen($link))->toBeGreaterThan(255);
});

test('it parses Indonesian month names', function () {
    /* The trap that silently costs 40% of the sheet: August is "Agu", and a
       parser expecting "Aug" drops every August row without complaining. */
    fakeSheet([
        ['28 Agu 2026, 08.15', 'Berita Agustus - DDTCNews', 'https://x', '9', 'Kebijakan', 'Ringkas.'],
        ['31 Agu 2026, 10.00', 'Berita Akhir Agustus - Ortax', 'https://y', '9', 'Regulasi', 'Ringkas.'],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsItem::count())->toBe(2)
        ->and(NewsItem::min('published_at'))->toBe('2026-08-28 08:15:00');
});

test('it accepts the second date format the sheet also uses', function () {
    fakeSheet([
        ['2026-09-01 11:46', 'Format Lain - DDTCNews', 'https://x', '9', 'Kebijakan', 'Ringkas.'],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsItem::sole()->published_at->toDateTimeString())->toBe('2026-09-01 11:46:00');
});

test('it admits only scores of nine and ten', function () {
    fakeSheet([
        ['02 Sep 2026, 09.00', 'Sepuluh - DDTCNews', 'https://a', '10', 'Kebijakan', 'x'],
        ['02 Sep 2026, 09.00', 'Sembilan - DDTCNews', 'https://b', '9', 'Kebijakan', 'x'],
        ['02 Sep 2026, 09.00', 'Delapan - DDTCNews', 'https://c', '8', 'Kebijakan', 'x'],
        ['02 Sep 2026, 09.00', 'Nol - DDTCNews', 'https://d', '0', 'Error', 'x'],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsItem::pluck('title')->sort()->values()->all())
        ->toBe(['Sembilan', 'Sepuluh']);
});

test('it takes the whole sheet, however old', function () {
    fakeSheet([
        ['02 Sep 2026, 09.00', 'Baru - DDTCNews', 'https://a', '9', 'Kebijakan', 'x'],
        ['02 Jul 2026, 09.00', 'Dua bulan lalu - DDTCNews', 'https://c', '10', 'Kebijakan', 'x'],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsItem::pluck('title')->sort()->values()->all())
        ->toBe(['Baru', 'Dua bulan lalu']);
});

test('a configured window trims to it, and clears what falls out', function () {
    config(['services.news_sheet.days' => 7]);

    fakeSheet([
        ['02 Sep 2026, 09.00', 'Minggu ini - DDTCNews', 'https://a', '9', 'Kebijakan', 'x'],
        ['27 Aug 2026, 09.00', 'Batas jendela - DDTCNews', 'https://b', '9', 'Kebijakan', 'x'],
        ['25 Aug 2026, 09.00', 'Terlalu lama - DDTCNews', 'https://c', '10', 'Kebijakan', 'x'],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsItem::pluck('title')->sort()->values()->all())
        ->toBe(['Batas jendela', 'Minggu ini']);
});

test('the same story arriving twice becomes one row carrying the newest reading', function () {
    /* In the real sheet one local story came back 46 mornings running, each
       time under a fresh redirect URL and often with a different score, so
       the link cannot be what identifies it. */
    fakeSheet([
        ['30 Aug 2026, 09.00', 'Gerai Samsat Hadir di Cibeber - Berita Cilegon', 'https://redirect-one', '9', 'Lainnya', 'Versi lama.'],
        ['02 Sep 2026, 09.00', 'Gerai Samsat Hadir di Cibeber - Berita Cilegon', 'https://redirect-two', '10', 'DJP/Operasional', 'Versi baru.'],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    $item = NewsItem::sole();

    expect($item->score)->toBe(10)
        ->and($item->category)->toBe('DJP/Operasional')
        ->and($item->summary)->toBe('Versi baru.');
});

test('it strips a second outlet tag but never a real part of the headline', function () {
    fakeSheet([
        ['02 Sep 2026, 09.00', 'Sidang Bahas Zakat dan Pajak - MUI - Majelis Ulama Indonesia', 'https://a', '9', 'Kebijakan', 'x'],
        ['02 Sep 2026, 09.10', 'Pemutihan Diperpanjang - radarutara.disway.id - Disway', 'https://b', '9', 'Kebijakan', 'x'],
        ['02 Sep 2026, 09.20', 'Pajak Karbon - Sebuah Tinjauan - DDTCNews', 'https://c', '9', 'Kebijakan', 'x'],
        ['02 Sep 2026, 09.30', 'Judul Tanpa Tanda Hubung', 'https://d', '9', 'Kebijakan', 'x'],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsItem::orderBy('published_at')->pluck('source', 'title')->all())->toBe([
        'Sidang Bahas Zakat dan Pajak' => 'Majelis Ulama Indonesia',
        'Pemutihan Diperpanjang' => 'Disway',
        /* Two words, so it belongs to the headline and stays. */
        'Pajak Karbon - Sebuah Tinjauan' => 'DDTCNews',
        'Judul Tanpa Tanda Hubung' => 'Tanpa sumber',
    ]);
});

test('a second run clears what has fallen out of the window but keeps what became an idea', function () {
    config(['services.news_sheet.days' => 7]);

    fakeSheet([
        ['28 Aug 2026, 09.00', 'Jatuh dari jendela - DDTCNews', 'https://a', '9', 'Kebijakan', 'x'],
        ['28 Aug 2026, 09.10', 'Sudah jadi ide - Ortax', 'https://b', '9', 'Kebijakan', 'x'],
    ]);
    $this->artisan('news:sync')->assertSuccessful();

    NewsItem::where('title', 'Sudah jadi ide')->update([
        'content_idea_id' => ContentIdea::create(['title' => 'Sudah jadi ide'])->id,
    ]);

    /* A week later both are outside the window and the sheet no longer lists
       them. The one an idea points back at has to survive, or the idea would
       forget where it came from. */
    Carbon::setTestNow('2026-09-10 09:00:00');
    fakeSheet([
        ['09 Sep 2026, 09.00', 'Berita baru - DDTCNews', 'https://c', '9', 'Kebijakan', 'x'],
    ]);
    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsItem::pluck('title')->sort()->values()->all())
        ->toBe(['Berita baru', 'Sudah jadi ide']);
});

test('the page shows everything and says what it is showing', function () {
    fakeSheet([
        ['02 Sep 2026, 09.00', 'Berita baru - DDTCNews', 'https://a', '9', 'Kebijakan', 'x'],
        ['05 Jul 2026, 09.00', 'Berita lama - Ortax', 'https://b', '10', 'Regulasi', 'x'],
    ]);
    $this->artisan('news:sync')->assertSuccessful();

    $this->actingAs(User::factory()->create())
        ->get(route('content.news'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('content-news')
            ->has('items', 2)
            ->where('items.0.title', 'Berita baru')
            ->where('items.0.source', 'DDTCNews')
            ->where('items.0.category', 'Kebijakan')
            /* Zero days is how the page knows to say "seluruh arsip". */
            ->where('window.days', 0)
            ->where('window.since', null)
            ->where('window.minScore', 9)
        );
});

test('a windowed page hides a story kept only for its idea', function () {
    config(['services.news_sheet.days' => 7]);

    fakeSheet([
        ['02 Sep 2026, 09.00', 'Di dalam jendela - DDTCNews', 'https://a', '9', 'Kebijakan', 'x'],
    ]);
    $this->artisan('news:sync')->assertSuccessful();

    /* Straight into the table, past the sync: a story kept for its idea must
       not reappear on a page that promises the last week. */
    NewsItem::create([
        'title' => 'Sisa lama',
        'source' => 'Ortax',
        'published_at' => '2026-08-01 09:00:00',
        'content_idea_id' => ContentIdea::create(['title' => 'Sisa lama'])->id,
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('content.news'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('items', 1)
            ->where('items.0.title', 'Di dalam jendela')
            ->where('window.days', 7)
        );
});

test('it refuses to guess when the sheet is no longer shared', function () {
    Http::fake(['docs.google.com/*' => Http::response('<html>Sign in</html>', 401)]);

    $this->artisan('news:sync')
        ->expectsOutputToContain('401')
        ->assertFailed();

    expect(NewsItem::count())->toBe(0);
});
