<?php

namespace App\Support;

use App\Models\Content;
use App\Models\InstagramPost;
use App\Models\TiktokPost;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * The posts that actually went out, offered as links a piece can be tied to.
 *
 * The Tautan field used to be an empty box asking for a URL nobody has in
 * their head — you would go to Instagram, find the post, copy the address, and
 * come back. Every one of those addresses is already in this app, scraped into
 * Performa the moment it was published. This hands them over.
 *
 * It is a picker, not a lock: a URL can still be typed. Not everything the
 * team publishes lives on the two accounts Performa follows, and a field that
 * only accepts what the app already knows about is a field that cannot record
 * the thing it was reaching for.
 */
class ReleasedPosts
{
    /** How many to offer. Past this, the search box is the way through. */
    private const LIMIT = 250;

    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    /**
     * @return array<int, array{
     *     url: string, channel: string, format: string, caption: string,
     *     date: string, postedAt: string, thumb: ?string, taken: bool
     * }>
     */
    public static function all(): array
    {
        /* Which addresses a piece already points at, so the picker can say so
           rather than let two pieces quietly claim one post. */
        $taken = Content::query()
            ->whereNotNull('url')
            ->where('url', '!=', '')
            ->pluck('url')
            ->flip();

        $instagram = InstagramPost::query()
            ->whereNotNull('url')
            ->where('url', '!=', '')
            ->latest('posted_at')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (InstagramPost $post) => self::row(
                url: $post->url,
                channel: 'instagram',
                format: $post->format(),
                caption: (string) $post->caption,
                postedAt: $post->posted_at,
                thumb: $post->thumb(),
                taken: $taken,
            ));

        $tiktok = TiktokPost::query()
            ->whereNotNull('url')
            ->where('url', '!=', '')
            ->latest('posted_at')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (TiktokPost $post) => self::row(
                url: $post->url,
                channel: 'tiktok',
                format: $post->format(),
                caption: (string) $post->caption,
                postedAt: $post->posted_at,
                thumb: $post->thumb(),
                taken: $taken,
            ));

        return $instagram
            ->merge($tiktok)
            ->sortByDesc('postedAt')
            ->take(self::LIMIT)
            ->values()
            ->all();
    }

    /**
     * The live post behind a piece's Tautan, with what it earned.
     *
     * Null when the address is not one Performa follows — a link to the firm's
     * own site, or an account nobody scrapes. The panel simply shows the link
     * on its own then, which is what it did before any of this existed.
     */
    public static function find(?string $url): ?array
    {
        if (! $url) {
            return null;
        }

        $instagram = InstagramPost::query()->where('url', $url)->first();

        if ($instagram) {
            return self::live($instagram, 'instagram', [
                ['label' => 'suka', 'value' => $instagram->likes],
                ['label' => 'komentar', 'value' => $instagram->comments],
                ...($instagram->plays() !== null
                    ? [['label' => 'pemutaran', 'value' => $instagram->plays()]]
                    : []),
            ]);
        }

        $tiktok = TiktokPost::query()->where('url', $url)->first();

        if ($tiktok) {
            return self::live($tiktok, 'tiktok', [
                ['label' => 'suka', 'value' => $tiktok->likes],
                ['label' => 'komentar', 'value' => $tiktok->comments],
                ['label' => 'pemutaran', 'value' => $tiktok->plays],
            ]);
        }

        return null;
    }

    /**
     * @param  array<int, array{label: string, value: int}>  $counts
     * @return array<string, mixed>
     */
    private static function live(InstagramPost|TiktokPost $post, string $channel, array $counts): array
    {
        return [
            'channel' => $channel,
            'format' => $post->format(),
            'thumb' => $post->thumb(),
            'caption' => Str::limit(trim(preg_replace('/\s+/u', ' ', (string) $post->caption) ?? ''), 140),
            'date' => self::written($post->posted_at),
            'counts' => $counts,
            /*
             | Scraped figures are true as of a moment, and the panel says
             | which moment: a count with no date behind it invites being read
             | as live.
             |
             | Written out here rather than shipped as an ISO string for the
             | page to format. The app sets no locale, so every date it prints
             | is composed on this side — and the client helper that would have
             | done it splits on the hyphen and expects a bare Y-m-d.
             */
            'syncedAt' => $post->fetched_at ? self::written($post->fetched_at) : null,
            /* Straight to the same post inside Performa, where the full record
               is — rather than making somebody find it again by eye. */
            'href' => route('performance.content', [
                'platform' => $channel,
                'konten' => $post->key(),
            ], false),
        ];
    }

    /** A date as the app writes one: 2 September 2026. */
    private static function written(CarbonInterface $at): string
    {
        return $at->day.' '.self::MONTHS[$at->month - 1].' '.$at->year;
    }

    /**
     * @param  Collection<string, int>  $taken
     * @return array<string, mixed>
     */
    private static function row(
        string $url,
        string $channel,
        string $format,
        string $caption,
        mixed $postedAt,
        ?string $thumb,
        $taken,
    ): array {
        return [
            'url' => $url,
            'channel' => $channel,
            'format' => $format,
            /* Enough of the caption to recognise the post by, on one line.
               Newlines first: a caption's own line breaks would otherwise turn
               each option into a paragraph. */
            'caption' => Str::limit(trim(preg_replace('/\s+/u', ' ', $caption) ?? ''), 90),
            'date' => $postedAt->day.' '.self::MONTHS[$postedAt->month - 1],
            'postedAt' => $postedAt->toIso8601String(),
            'thumb' => $thumb,
            'taken' => $taken->has($url),
        ];
    }
}
