<?php

namespace App\Support;

/**
 * A rupiah figure written out in words: "Sepuluh Juta Rupiah".
 *
 * Every offer letter prints the fee twice, once in digits and once in words,
 * because the words are what a reader checks the digits against. Typing them
 * by hand is how "Rp 10.000.000" ends up beside "Satu Juta Rupiah".
 */
class Terbilang
{
    private const ONES = [
        '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan',
        'Sepuluh', 'Sebelas',
    ];

    private const SCALES = [
        [1_000_000_000_000, 'Triliun'],
        [1_000_000_000, 'Miliar'],
        [1_000_000, 'Juta'],
        [1_000, 'Ribu'],
    ];

    /** "Sepuluh Juta Rupiah". Zero reads as "Nol Rupiah". */
    public static function rupiah(int $amount): string
    {
        return self::words($amount).' Rupiah';
    }

    /** The number alone, Title Case, no unit. */
    public static function words(int $number): string
    {
        if ($number === 0) {
            return 'Nol';
        }

        if ($number < 0) {
            return 'Minus '.self::words(-$number);
        }

        return trim(self::spell($number));
    }

    private static function spell(int $n): string
    {
        if ($n < 12) {
            return self::ONES[$n];
        }

        if ($n < 20) {
            return self::ONES[$n - 10].' Belas';
        }

        if ($n < 100) {
            return trim(self::ONES[intdiv($n, 10)].' Puluh '.self::spell($n % 10));
        }

        if ($n < 200) {
            return trim('Seratus '.self::spell($n - 100));
        }

        if ($n < 1_000) {
            return trim(self::ONES[intdiv($n, 100)].' Ratus '.self::spell($n % 100));
        }

        if ($n < 2_000) {
            return trim('Seribu '.self::spell($n - 1_000));
        }

        foreach (self::SCALES as [$size, $name]) {
            if ($n >= $size) {
                return trim(self::spell(intdiv($n, $size)).' '.$name.' '.self::spell($n % $size));
            }
        }

        return '';
    }
}
