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
    /** @return array<int, string> */
    public static function channels(): array
    {
        return config('content.channels');
    }

    /**
     * The formats one channel can carry, label by key.
     *
     * @return array<string, string>
     */
    public static function formats(string $channel): array
    {
        return config('content.formats')[$channel] ?? [];
    }

    public static function formatLabel(string $channel, string $format): string
    {
        return self::formats($channel)[$format] ?? $format;
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
     * its own copy of the channels, formats or statuses.
     *
     * @return array<string, mixed>
     */
    public static function forClient(): array
    {
        return [
            'channels' => self::channels(),
            'formats' => config('content.formats'),
            'statuses' => self::statuses(),
            'stuckAfterDays' => config('content.stuck_after_days'),
        ];
    }
}
