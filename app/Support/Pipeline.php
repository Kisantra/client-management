<?php

namespace App\Support;

/**
 * Reader for config/pipeline.php.
 *
 * Every stage fact the app needs — order, label, tolerance, and which stages
 * cannot be entered without a document — is answered from here, so a screen and
 * the rule that guards it can never hold different numbers.
 */
class Pipeline
{
    /** @return array<int, array{key: string, label: string, stalled_after_days: int}> */
    public static function stages(): array
    {
        return config('pipeline.stages');
    }

    /** @return array<int, string> */
    public static function keys(): array
    {
        return array_column(self::stages(), 'key');
    }

    /** @return array<string, string> */
    public static function labels(): array
    {
        return array_column(self::stages(), 'label', 'key');
    }

    public static function label(string $stage): string
    {
        return self::labels()[$stage] ?? $stage;
    }

    public static function threshold(string $stage): int
    {
        return (int) (array_column(self::stages(), 'stalled_after_days', 'key')[$stage] ?? 14);
    }

    /** Position in the pipeline, used to order a lead's history. */
    public static function index(string $stage): int
    {
        $at = array_search($stage, self::keys(), true);

        return $at === false ? 0 : $at;
    }

    /** The document a stage cannot be entered without, if it has one. */
    public static function requirement(string $stage): ?array
    {
        return config('pipeline.requires_document')[$stage] ?? null;
    }

    /** @return array<string, string> */
    public static function channels(): array
    {
        return config('pipeline.channels');
    }

    /** @return array<int, string> */
    public static function services(): array
    {
        return config('pipeline.services');
    }

    /**
     * Why a lead can stop, keyed by the value stored on the record.
     *
     * @return array<string, array{label: string, hint: string}>
     */
    public static function closeReasons(): array
    {
        return config('pipeline.close_reasons');
    }

    public static function closeReasonLabel(?string $reason): ?string
    {
        return $reason === null ? null : (self::closeReasons()[$reason]['label'] ?? $reason);
    }

    /** @return array<int, string> */
    public static function followUpVia(): array
    {
        return config('pipeline.follow_up_via');
    }

    /**
     * The stage list as the client needs it: label for display, tolerance so
     * screens can say "x dari y hari" without keeping their own copy.
     *
     * @return array<int, array{key: string, label: string, stalledAfterDays: int}>
     */
    public static function forClient(): array
    {
        return array_map(fn (array $stage) => [
            'key' => $stage['key'],
            'label' => $stage['label'],
            'stalledAfterDays' => (int) $stage['stalled_after_days'],
        ], self::stages());
    }
}
