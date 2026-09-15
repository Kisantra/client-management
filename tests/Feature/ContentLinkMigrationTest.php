<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 | The migration that replaced the single link column runs against real data:
 | every address the team has already recorded. It is tested from the old
 | shape, so what it does to those rows is known before it touches them.
 */
it('carries every existing address across, filed under the channel its host names', function () {
    $migration = require database_path('migrations/2026_09_11_000000_create_content_links_table.php');

    // Back to the old shape: one address per piece, in a column.
    $migration->down();

    expect(Schema::hasColumn('contents', 'url'))->toBeTrue()
        ->and(Schema::hasTable('content_links'))->toBeFalse();

    $row = fn (string $title, array $channels, ?string $url) => [
        'title' => $title,
        'channels' => json_encode($channels),
        'type' => 'carousel',
        'status' => 'published',
        'scheduled_for' => '2026-08-01',
        'status_changed_at' => '2026-08-01',
        'url' => $url,
        'created_at' => now(),
        'updated_at' => now(),
    ];

    DB::table('contents')->insert([
        // On two platforms, but the one address it kept is a TikTok one: the
        // host decides, not the order the channels were ticked in.
        $row('Dua platform', ['instagram', 'tiktok'], 'https://www.tiktok.com/@kisantra/video/1'),
        // An address no host rule recognises falls back to the piece's own channel.
        $row('Artikel', ['linkedin'], 'https://kisantra.com/artikel/spt'),
        // Nothing recorded, nothing to carry.
        $row('Belum tayang', ['instagram'], null),
        $row('Kosong', ['instagram'], ''),
    ]);

    $migration->up();

    $links = DB::table('content_links')
        ->join('contents', 'contents.id', '=', 'content_links.content_id')
        ->orderBy('contents.title')
        ->get(['contents.title', 'content_links.channel', 'content_links.url'])
        ->map(fn ($link) => [$link->title, $link->channel, $link->url])
        ->all();

    expect($links)->toBe([
        ['Artikel', 'linkedin', 'https://kisantra.com/artikel/spt'],
        ['Dua platform', 'tiktok', 'https://www.tiktok.com/@kisantra/video/1'],
    ])
        // The column is gone, so nothing can go on writing to the old shape.
        ->and(Schema::hasColumn('contents', 'url'))->toBeFalse();
});

it('can be undone without losing the address a piece had', function () {
    $migration = require database_path('migrations/2026_09_11_000000_create_content_links_table.php');

    $id = DB::table('contents')->insertGetId([
        'title' => 'Satu tautan',
        'channels' => json_encode(['instagram']),
        'type' => 'carousel',
        'status' => 'published',
        'scheduled_for' => '2026-08-01',
        'status_changed_at' => '2026-08-01',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('content_links')->insert([
        'content_id' => $id,
        'channel' => 'instagram',
        'url' => 'https://www.instagram.com/p/KEEP/',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $migration->down();

    expect(DB::table('contents')->where('id', $id)->value('url'))->toBe('https://www.instagram.com/p/KEEP/');

    // Leave the schema as every other test expects it.
    $migration->up();
});
