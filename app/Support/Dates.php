<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Dates written the way the team writes them, on the server side.
 *
 * Most dates reach the browser as plain `Y-m-d` and are formatted there. A
 * range is the exception: it is a phrase, not a date, and the rules for
 * shortening it — dropping the repeated month, dropping the repeated year —
 * belong in one place rather than in each screen that shows one.
 */
class Dates
{
    private const MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];

    /** "4 – 28 Agu 2026", "4 Jul – 28 Agu 2026", "28 Des 2025 – 4 Jan 2026". */
    public static function range(?Carbon $from, ?Carbon $to): string
    {
        if (! $from || ! $to) {
            return Period::LABELS['semua'];
        }

        if ($from->isSameDay($to)) {
            return self::day($from);
        }

        $sameYear = $from->year === $to->year;
        $sameMonth = $sameYear && $from->month === $to->month;

        $start = $sameMonth
            ? (string) $from->day
            : ($sameYear
                ? $from->day.' '.self::MONTHS[$from->month - 1]
                : self::day($from));

        return $start.' – '.self::day($to);
    }

    /** "28 Agu 2026". */
    public static function day(Carbon $date): string
    {
        return $date->day.' '.self::MONTHS[$date->month - 1].' '.$date->year;
    }
}
