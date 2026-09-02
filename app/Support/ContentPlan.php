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
