<?php

use App\Support\Period;
use Illuminate\Support\Carbon;

beforeEach(fn () => Carbon::setTestNow('2026-08-20'));
afterEach(fn () => Carbon::setTestNow());

/** Every window either page offers. */
const OFFERED = [
    'bulan-ini', 'bulan-lalu', 'bulan-depan', 'kuartal', 'tahun',
    '30hari', '90hari', '6bulan', 'semua', 'khusus',
];

function window(string $key, ?string $from = null, ?string $to = null): Period
{
    return Period::from($key, $from, $to, OFFERED, 'semua');
}

it('resolves every named window against today', function (string $key, string $from, string $to) {
    $period = window($key);

    expect($period->from?->toDateString())->toBe($from)
        ->and($period->to?->toDateString())->toBe($to);
})->with([
    ['bulan-ini', '2026-08-01', '2026-08-31'],
    ['bulan-lalu', '2026-07-01', '2026-07-31'],
    ['bulan-depan', '2026-09-01', '2026-09-30'],
    ['kuartal', '2026-07-01', '2026-09-30'],
    ['tahun', '2026-01-01', '2026-12-31'],
    ['30hari', '2026-07-22', '2026-08-20'],
    ['90hari', '2026-05-23', '2026-08-20'],
]);

it('runs the end bound to the last second of its day', function () {
    /*
     | Dates are stored with a time behind them, so a range ending on the bare
     | date drops everything recorded that day — wrong on one day only, which
     | is the hardest kind of wrong to notice.
     */
    expect(window('bulan-ini')->to->toDateTimeString())->toBe('2026-08-31 23:59:59')
        ->and(window('bulan-ini')->from->toDateTimeString())->toBe('2026-08-01 00:00:00');
});

it('leaves "semua" unbounded', function () {
    $period = window('semua');

    expect($period->isOpen())->toBeTrue()
        ->and($period->from)->toBeNull()
        ->and($period->to)->toBeNull()
        ->and($period->label())->toBe('Semua waktu');
});

it('takes a custom range and names it by its dates', function () {
    $period = window('khusus', '2026-07-04', '2026-08-28');

    expect($period->key)->toBe('khusus')
        ->and($period->from->toDateString())->toBe('2026-07-04')
        ->and($period->to->toDateTimeString())->toBe('2026-08-28 23:59:59')
        ->and($period->label())->toBe('4 Jul – 28 Agu 2026');

    // Inside one month the month is said once; across years, both years are.
    expect(window('khusus', '2026-08-04', '2026-08-28')->label())->toBe('4 – 28 Agu 2026')
        ->and(window('khusus', '2025-12-28', '2026-01-04')->label())->toBe('28 Des 2025 – 4 Jan 2026')
        ->and(window('khusus', '2026-08-04', '2026-08-04')->label())->toBe('4 Agu 2026');
});

it('falls back to the default rather than to nothing', function () {
    // A window this page does not offer, a range that will not parse, and one
    // that runs backwards all land on the default — never on an empty result.
    foreach ([
        ['nanti', null, null],
        ['khusus', 'bukan-tanggal', '2026-08-28'],
        ['khusus', '2026-08-28', null],
        ['khusus', '2026-08-28', '2026-07-04'],
    ] as [$key, $from, $to]) {
        expect(Period::from($key, $from, $to, OFFERED, 'bulan-ini')->key)->toBe('bulan-ini');
    }

    // And a window a page does not offer is not reachable by typing it in.
    expect(Period::from('tahun', null, null, ['30hari', 'semua'], 'semua')->key)->toBe('semua');
});
