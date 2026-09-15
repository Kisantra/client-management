<?php

namespace App\Support;

/**
 * Reader for config/content.php.
 *
 * Which channels publish, what each can carry, and the statuses a piece moves
 * through on its way to being live are all answered from here, so the form,
 * the calendar and the rule behind them can never hold different lists.
 */
class ContentPlan
{
    /** @return array<string, string> */
    public static function channels(): array
    {
        return config('content.channels');
    }

    /** @return array<int, string> */
    public static function channelKeys(): array
    {
        return array_keys(self::channels());
    }

    public static function channelLabel(string $channel): string
    {
        return self::channels()[$channel] ?? $channel;
    }

    /**
     * Which channel an address belongs to, read from its host.
     *
     * A piece goes out on several channels and keeps a link for each, so every
     * link has to know which one it is. The host answers that for everything
     * the team actually publishes to; `$among` is the piece's own channels, and
     * the first of those is the fallback for a link that is none of the below —
     * the firm's own site, a newsletter, anything.
     *
     * @param  array<int, string>  $among
     */
    public static function channelForUrl(string $url, array $among = []): string
    {
        $host = strtolower((string) parse_url(trim($url), PHP_URL_HOST));

        foreach (self::HOSTS as $needle => $channel) {
            if ($host !== '' && str_contains($host, $needle)) {
                return $channel;
            }
        }

        return $among[0] ?? 'web';
    }

    /** Host fragment to channel. Ordered so `youtu.be` is not read as `.be`. */
    private const HOSTS = [
        'instagram.com' => 'instagram',
        'tiktok.com' => 'tiktok',
        'youtube.com' => 'youtube',
        'youtu.be' => 'youtube',
        'facebook.com' => 'facebook',
        'fb.watch' => 'facebook',
        'twitter.com' => 'twitter',
        'x.com' => 'twitter',
        'linkedin.com' => 'linkedin',
    ];

    /** @return array<string, string> */
    public static function pillars(): array
    {
        return config('content.pillars');
    }

    public static function pillarLabel(?string $pillar): ?string
    {
        return $pillar === null ? null : (self::pillars()[$pillar] ?? $pillar);
    }

    /** The shapes a piece can take, label by key. @return array<string, string> */
    public static function types(): array
    {
        return config('content.types');
    }

    public static function typeLabel(string $type): string
    {
        return self::types()[$type] ?? $type;
    }

    /** @return array<int, array{key: string, label: string, hint: string}> */
    public static function statuses(): array
    {
        return config('content.statuses');
    }

    /** @return array<int, string> */
    public static function keys(): array
    {
        return array_column(self::statuses(), 'key');
    }

    public static function label(string $status): string
    {
        return array_column(self::statuses(), 'label', 'key')[$status] ?? $status;
    }

    /** Position in the flow, used to order a piece's history. */
    public static function index(string $status): int
    {
        $at = array_search($status, self::keys(), true);

        return $at === false ? 0 : $at;
    }

    /** Days a piece may sit in a status before it counts as stuck; null at the end. */
    public static function stuckAfter(string $status): ?int
    {
        $days = config('content.stuck_after_days')[$status] ?? null;

        return $days === null ? null : (int) $days;
    }

    /**
     * Everything the browser needs, shared on every page so no screen keeps
     * its own copy of the channels, pillars, types or QA stages.
     *
     * @return array<string, mixed>
     */
    public static function forClient(): array
    {
        return [
            'channels' => self::channels(),
            'pillars' => self::pillars(),
            'types' => self::types(),
            'statuses' => self::statuses(),
            'stuckAfterDays' => config('content.stuck_after_days'),
        ];
    }
}
