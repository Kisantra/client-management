<?php

use App\Models\BriefIdea;
use App\Models\ContentIdea;
use App\Models\NewsBrief;
use App\Models\User;
use Illuminate\Support\Facades\Http;

/*
| Three generations of the brief template are in the sheet at once, because
| the pipeline rewrote its own output twice while running. Every shape
| asserted here was taken from the real tab.
*/

/** The body the fake brief tab answers with; the last call wins. */
function briefBody(?string $set = null): string
{
    static $body = '';

    if ($set !== null) {
        $body = $set;
    }

    return $body;
}

/** @param array<int, array{0: string, 1: string}> $rows */
function fakeBriefs(array $rows): void
{
    $csv = "Tanggal ,Brief\n";

    foreach ($rows as [$at, $markdown]) {
        $csv .= '"'.$at.'","'.str_replace('"', '""', $markdown)."\"\n";
    }

    briefBody($csv);

    /*
     | One stub for both tabs: Http::fake merges its stubs and the first match
     | wins, so a second fake could never replace this one. The brief tab is
     | told apart by its gid, and the news tab answers with an empty log so
     | these tests only ever exercise the brief half.
     */
    Http::fake([
        'docs.google.com/*' => function ($request) {
            $brief = str_contains(
                $request->url(),
                'gid='.config('services.news_sheet.brief_gid'),
            );

            return Http::response($brief ? briefBody() : "Tanggal ,Judul ,Link ,Skor, Kategori ,Ringkasan\n");
        },
    ]);
}

test('it reads the newest template: topics, ideas, and a publisher link', function () {
    fakeBriefs([['2026-09-03 08:10', <<<'MD'
        📰 **BRIEF PAJAK & KEUANGAN**
        _Kamis, 3 September 2026_

        💡 **Ide Konten Hari Ini**

        ### 🔥 Topik Panas Hari Ini
        - **PPh Pasal 22 e-commerce 0,5% pada 2027** — Seller online mulai menghitung dampaknya.
        - **Keringanan UMKM omzet di bawah Rp500 juta** — Perlu tahu mekanisme SPB.

        ### 💡 Ide Konten
        🔹 Jualan Online Kena PPh 0,5% Mulai 2027?
        Pemerintah dan DPR menyepakati PPh Pasal 22 e-commerce sebesar 0,5%.
        [🔗 Baca artikel sumber](https://investor.id/macroeconomy/452634/pedagang-online)
        MD]]);

    $this->artisan('news:sync')->assertSuccessful();

    $brief = NewsBrief::with('ideas')->sole();

    expect($brief->published_at->toDateTimeString())->toBe('2026-09-03 08:10:00')
        ->and($brief->topics)->toHaveCount(2)
        ->and($brief->topics[0]['title'])->toBe('PPh Pasal 22 e-commerce 0,5% pada 2027')
        ->and($brief->topics[0]['body'])->toBe('Seller online mulai menghitung dampaknya.')
        /* The label the newer template prints above the whole brief is not a
           section, and must not become an empty heading. */
        ->and($brief->extras)->toBe([])
        ->and($brief->ideas)->toHaveCount(1);

    $idea = $brief->ideas->first();

    expect($idea->title)->toBe('Jualan Online Kena PPh 0,5% Mulai 2027?')
        ->and($idea->body)->toBe('Pemerintah dan DPR menyepakati PPh Pasal 22 e-commerce sebesar 0,5%.')
        /* The brief's links go to the publisher, where the news log's go
           through a Google News redirect. */
        ->and($idea->url)->toBe('https://investor.id/macroeconomy/452634/pedagang-online');
});

test('a heading whose emoji begins with byte 0xE2 survives', function () {
    /*
     | The regression this exists for: trim()'s charlist is a set of BYTES,
     | so naming the zero-width space in it stripped the leading 0xE2 of "⚡",
     | left the heading as broken UTF-8, and dropped the whole section without
     | a word. Thirty-one briefs lost their Quick Win to it.
     */
    fakeBriefs([['2026-07-06 09:00', <<<'MD'
        **🔥 Topik Panas Hari Ini**
        • **Coretax** — Sistem baru DJP.

        **⚡ Quick Win**
        • Reels hari ini: rekaman layar harga baru.

        **🎯 Sudut Unik**
        • **Pajak JHT dipotong 5%** — DPR minta evaluasi.
        MD]]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(array_column(NewsBrief::sole()->extras, 'heading'))
        ->toBe(['Quick Win', 'Sudut Unik']);
});

test('it reads the oldest template, where the headlines are the whole brief', function () {
    fakeBriefs([['2026-07-12 07:03', <<<'MD'
        📰 **BRIEF PAJAK & KEUANGAN**
        _Minggu, 12 Juli 2026_
        📌 **Top Headlines**
        **1.** MUI Usulkan Zakat Jadi Pengurang Pajak Langsung - IKPI
        https://ikpi.or.id/mui-usulkan-zakat-jadi-pengurang-pajak-langsung/
        MD]]);

    $this->artisan('news:sync')->assertSuccessful();

    $brief = NewsBrief::sole();

    /* A morning that produced only headlines is a failed run, and a failed
       run the team can see beats a gap it cannot. */
    expect($brief->topics)->toBe([])
        ->and($brief->extras[0]['heading'])->toBe('Top Headlines')
        ->and($brief->extras[0]['items'][0]['url'])
        ->toBe('https://ikpi.or.id/mui-usulkan-zakat-jadi-pengurang-pajak-langsung/');
});

test('a brief nothing can be read from is left out', function () {
    fakeBriefs([
        ['2026-09-01 08:00', "📰 **BRIEF PAJAK & KEUANGAN**\n_Selasa, 1 September 2026_"],
        ['2026-09-02 08:00', "### 🔥 Topik Panas Hari Ini\n- **Ada isinya** — teks."],
    ]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsBrief::count())->toBe(1)
        ->and(NewsBrief::sole()->published_at->toDateString())->toBe('2026-09-02');
});

test('a second sync changes nothing and forgets nothing', function () {
    fakeBriefs([['2026-09-03 08:10', <<<'MD'
        ### 🔥 Topik Panas Hari Ini
        - **Satu topik** — teks.

        ### 💡 Ide Konten
        🔹 Ide pertama
        Penjelasannya.
        MD]]);

    $this->artisan('news:sync')->assertSuccessful();

    $idea = BriefIdea::sole();
    $idea->update(['content_idea_id' => ContentIdea::create(['title' => 'Ide pertama'])->id]);

    $this->artisan('news:sync')->assertSuccessful();

    expect(NewsBrief::count())->toBe(1)
        ->and(BriefIdea::count())->toBe(1)
        /* Re-reading the sheet must not un-take an idea somebody took. */
        ->and(BriefIdea::sole()->content_idea_id)->not->toBeNull();
});

test('one press puts an idea on the backlog and the row remembers it', function () {
    fakeBriefs([['2026-09-03 08:10', <<<'MD'
        ### 🔥 Topik Panas Hari Ini
        - **Satu topik** — teks.

        ### 💡 Ide Konten
        🔹 Jualan Online Kena PPh 0,5%
        Penjelasan idenya.
        [🔗 Baca artikel sumber](https://investor.id/a)
        MD]]);
    $this->artisan('news:sync')->assertSuccessful();

    $idea = BriefIdea::sole();
    $user = User::factory()->create(['name' => 'Rani']);

    $this->actingAs($user)
        ->post(route('content.brief.idea', $idea))
        ->assertRedirect();

    $backlog = ContentIdea::sole();

    expect($backlog->title)->toBe('Jualan Online Kena PPh 0,5%')
        ->and($backlog->note)->toBe('Penjelasan idenya.')
        ->and($backlog->source_url)->toBe('https://investor.id/a')
        ->and($backlog->author)->toBe('Rani')
        ->and($idea->fresh()->content_idea_id)->toBe($backlog->id);

    /* A second press is not a second idea. */
    $this->actingAs($user)->post(route('content.brief.idea', $idea))->assertRedirect();

    expect(ContentIdea::count())->toBe(1);
});

test('the page opens on the newest brief and can be sent to an older one', function () {
    fakeBriefs([
        ['2026-09-01 08:00', "### 🔥 Topik Panas Hari Ini\n- **Topik lama** — teks."],
        ['2026-09-03 08:10', "### 🔥 Topik Panas Hari Ini\n- **Topik baru** — teks."],
    ]);
    $this->artisan('news:sync')->assertSuccessful();

    $user = User::factory()->create();
    $older = NewsBrief::orderBy('published_at')->first();

    $this->actingAs($user)
        ->get(route('content.brief'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('content-brief')
            ->where('brief.topics.0.title', 'Topik baru')
            /* The archive carries every brief, each with the day's leading
               topic — a column of dates would be unscannable. */
            ->has('archive', 2)
            ->where('archive.0.lead', 'Topik baru')
            ->where('archive.1.lead', 'Topik lama')
        );

    $this->actingAs($user)
        ->get(route('content.brief', $older))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('brief.topics.0.title', 'Topik lama'));
});

test('the page says what to do when nothing has been synced', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('content.brief'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('brief', null)
            ->has('archive', 0)
        );
});
