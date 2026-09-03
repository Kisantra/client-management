<?php

use App\Models\KeyDate;
use Database\Seeders\KeyDateSeeder;
use Illuminate\Support\Carbon;

beforeEach(fn () => Carbon::setTestNow('2026-09-02'));
afterEach(fn () => Carbon::setTestNow());

it('seeds the dates a tax year is built around', function () {
    $this->seed(KeyDateSeeder::class);

    // Two years, so planning in December still has somewhere to look.
    expect(KeyDate::whereYear('date', 2026)->count())->toBeGreaterThan(0)
        ->and(KeyDate::whereYear('date', 2027)->count())->toBeGreaterThan(0);

    // The two dates the whole year bends around.
    expect(KeyDate::whereDate('date', '2026-03-31')->where('title', 'like', '%Orang Pribadi%')->exists())->toBeTrue()
        ->and(KeyDate::whereDate('date', '2026-04-30')->where('title', 'like', '%Badan%')->exists())->toBeTrue()
        ->and(KeyDate::whereDate('date', '2026-07-14')->where('title', 'Hari Pajak')->exists())->toBeTrue();

    // Fixed national days, which do not move.
    expect(KeyDate::whereDate('date', '2026-08-17')->where('kind', KeyDate::LIBUR)->exists())->toBeTrue();
});

it('names a monthly deadline for the period it settles, not the month it falls in', function () {
    $this->seed(KeyDateSeeder::class);

    /*
     | A deposit due on 10 September settles August, and the date beside it
     | already says September; naming it September would say the wrong thing
     | twice. January's settles the December before it.
     */
    expect(KeyDate::whereDate('date', '2026-09-10')->value('title'))
        ->toContain('masa Agustus')
        ->and(KeyDate::whereDate('date', '2026-01-10')->value('title'))
        ->toContain('masa Desember');

    // The PPN deadline lands on the last day, whatever length the month is.
    expect(KeyDate::whereDate('date', '2026-02-28')->where('title', 'like', '%PPN%')->exists())->toBeTrue();
});

it('seeds no date that moves with the lunar calendar', function () {
    $this->seed(KeyDateSeeder::class);

    /*
     | Idul Fitri, Nyepi, Waisak and every cuti bersama are set each year by a
     | joint ministerial decree. For a firm that advises on deadlines a
     | plausible wrong date is worse than a missing one, so none is invented
     | here — and this test is what keeps a later edit from quietly adding one.
     */
    foreach (['Idul Fitri', 'Idul Adha', 'Nyepi', 'Waisak', 'Imlek', 'Cuti Bersama', 'Maulid'] as $moving) {
        expect(KeyDate::where('title', 'like', "%{$moving}%")->exists())->toBeFalse();
    }

    expect(KeyDate::where('confirmed', false)->count())->toBe(0);
});

it('can be run twice without doubling the calendar', function () {
    $this->seed(KeyDateSeeder::class);
    $first = KeyDate::count();

    $this->seed(KeyDateSeeder::class);

    expect(KeyDate::count())->toBe($first);
});
