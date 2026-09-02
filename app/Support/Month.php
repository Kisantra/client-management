<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * A calendar month as a range a query can trust.
 *
 * Dates are stored with a time behind them, so a range that ends on the bare
 * date `2026-08-31` excludes everything recorded that day — the month silently
 * loses its last day, and only on that day, which is the hardest kind of wrong
 * to notice. The end bound therefore runs to the last second.
 */
class Month
{
    /** @return array{0: Carbon, 1: Carbon} */
    public static function bounds(Carbon $month): array
    {
        return [
            $month->copy()->startOfMonth(),
            $month->copy()->endOfMonth(),
        ];
    }
}
