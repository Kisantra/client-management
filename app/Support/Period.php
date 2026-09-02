<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * A window of time, named once and read the same way everywhere.
 *
 * Both the content calendar and the Instagram figures need to be asked "over
 * what stretch", and the answer has to mean the same thing on both. It is a
 * value object rather than a pair of dates on a query so the window can also
 * say its own name back to the reader — a page scoped to a period nobody can
 * see the name of is a page quietly lying about what it counted.
 *
 * The end bound always runs to the last second of its day. Dates are stored
 * with a time behind them, so a range ending on the bare date `2026-08-31`
 * drops everything recorded that day: the hardest kind of wrong to notice,
 * because it is only ever wrong on one day.
 */
class Period
{
    /**
     * Every window either page offers, and what to call it.
     *
     * Content looks forwards as well as back — half its calendar has not
     * happened yet — while the Instagram figures only ever look back, so each
     * page is handed the subset that makes sense for it rather than one list
     * with dead entries in it.
     */
    public const LABELS = [
        'bulan-ini' => 'Bulan ini',
        'bulan-lalu' => 'Bulan lalu',
        'bulan-depan' => 'Bulan depan',
        'kuartal' => 'Kuartal ini',
        'tahun' => 'Tahun ini',
        '30hari' => '30 hari terakhir',
        '90hari' => '90 hari terakhir',
        '6bulan' => '6 bulan terakhir',
        'semua' => 'Semua waktu',
        'khusus' => 'Rentang khusus',
    ];

    private function __construct(
        public readonly string $key,
        public readonly ?Carbon $from,
        public readonly ?Carbon $to,
    ) {}

    /**
     * The window a request is asking for.
     *
     * Anything unrecognised, and any custom range whose dates will not parse
     * or run backwards, falls back to the page's own default rather than to
     * an empty result: a mistyped URL should show something, not nothing.
     *
     * @param  array<int, string>  $allowed  the keys this page offers
     */
    public static function from(
        ?string $key,
        ?string $from,
        ?string $to,
        array $allowed,
        string $default,
    ): self {
        $key = in_array($key, $allowed, true) ? $key : $default;

        if ($key === 'khusus') {
            $start = self::date($from);
            $end = self::date($to);

            return $start && $end && $start->lte($end)
                ? new self('khusus', $start->startOfDay(), $end->endOfDay())
                : self::from($default, null, null, $allowed, $default);
        }

        $today = Carbon::today();

        [$start, $end] = match ($key) {
            'bulan-ini' => [$today->copy()->startOfMonth(), $today->copy()->endOfMonth()],
            'bulan-lalu' => [$today->copy()->subMonthNoOverflow()->startOfMonth(), $today->copy()->subMonthNoOverflow()->endOfMonth()],
            'bulan-depan' => [$today->copy()->addMonthNoOverflow()->startOfMonth(), $today->copy()->addMonthNoOverflow()->endOfMonth()],
            'kuartal' => [$today->copy()->startOfQuarter(), $today->copy()->endOfQuarter()],
            'tahun' => [$today->copy()->startOfYear(), $today->copy()->endOfYear()],
            '30hari' => [$today->copy()->subDays(29), $today->copy()],
            '90hari' => [$today->copy()->subDays(89), $today->copy()],
            '6bulan' => [$today->copy()->subMonthsNoOverflow(6)->addDay(), $today->copy()],
            default => [null, null],
        };

        return new self($key, $start?->startOfDay(), $end?->endOfDay());
    }

    /** True when the window has no bounds at all. */
    public function isOpen(): bool
    {
        return $this->from === null || $this->to === null;
    }

    /** @return array{0: Carbon, 1: Carbon} */
    public function bounds(): array
    {
        return [$this->from, $this->to];
    }

    public function label(): string
    {
        if ($this->key !== 'khusus') {
            return self::LABELS[$this->key] ?? self::LABELS['semua'];
        }

        return Dates::range($this->from, $this->to);
    }

    /**
     * The window as the browser reads it: its key, its name, and the two dates
     * a custom range needs to reopen on the right days.
     *
     * @return array<string, string|null>
     */
    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'label' => $this->label(),
            'from' => $this->from?->toDateString(),
            'to' => $this->to?->toDateString(),
        ];
    }

    private static function date(?string $value): ?Carbon
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::createFromFormat('Y-m-d', $value);
        } catch (\Throwable) {
            return null;
        }
    }
}
