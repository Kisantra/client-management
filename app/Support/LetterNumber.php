<?php

namespace App\Support;

use App\Models\Letter;
use App\Models\LetterNumberCounter;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Letter numbers: PEN-011/KSN-MS/VIII/2026.
 *
 * The sequence runs per prefix and restarts each year. It is drawn from a
 * locked counter row inside the issuing transaction, so two people issuing
 * at once can never be handed the same number, and it is drawn only at
 * issue, so a draft that is thrown away leaves no hole in the register.
 */
class LetterNumber
{
    private const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

    /**
     * Draws the next number for a letter and writes it onto the record.
     *
     * A letter that already carries a number keeps it: pulling an issued
     * letter back to draft and issuing it again must not spend a second one.
     */
    public static function assign(Letter $letter): void
    {
        if ($letter->number !== null) {
            return;
        }

        $prefix = $letter->template->number_prefix;
        $date = $letter->letter_date instanceof CarbonInterface ? $letter->letter_date : Carbon::parse($letter->letter_date);
        $year = $date->year;

        DB::transaction(function () use ($letter, $prefix, $date, $year) {
            $counter = LetterNumberCounter::query()
                ->where('prefix', $prefix)
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            if ($counter === null) {
                /* First letter of this prefix this year. Start from whatever
                   is already on record, in case letters were numbered before
                   the counter existed. */
                $counter = LetterNumberCounter::create([
                    'prefix' => $prefix,
                    'year' => $year,
                    'last_sequence' => self::highestIssued($prefix, $year),
                ]);
            }

            $sequence = $counter->last_sequence + 1;
            $counter->update(['last_sequence' => $sequence]);

            $letter->forceFill([
                'number' => self::format($prefix, $sequence, $date, self::initials($letter->lead->company)),
                'sequence' => $sequence,
                'year' => $year,
            ]);
        });
    }

    /**
     * The highest sequence already printed on a letter of this prefix and
     * year. A counter may never be wound below it, or two letters would
     * carry the same number.
     */
    public static function highestIssued(string $prefix, int $year): int
    {
        return (int) Letter::query()
            ->where('year', $year)
            ->whereHas('template', fn ($q) => $q->where('number_prefix', $prefix))
            ->max('sequence');
    }

    /** What the next issue of this prefix on this date would be numbered, without drawing it. */
    public static function preview(string $prefix, CarbonInterface $date, string $company): string
    {
        $last = LetterNumberCounter::query()
            ->where('prefix', $prefix)
            ->where('year', $date->year)
            ->value('last_sequence');

        $last ??= self::highestIssued($prefix, $date->year);

        return self::format($prefix, ((int) $last) + 1, $date, self::initials($company));
    }

    public static function format(string $prefix, int $sequence, CarbonInterface $date, string $initials): string
    {
        $config = config('letter.number');

        return strtr((string) $config['format'], [
            '{prefix}' => $prefix,
            '{seq}' => str_pad((string) $sequence, (int) $config['digits'], '0', STR_PAD_LEFT),
            '{code}' => (string) $config['code'],
            '{inisial}' => $initials,
            '{roman}' => self::ROMAN[$date->month - 1],
            '{year}' => (string) $date->year,
        ]);
    }

    /**
     * "Marwi Sulistyarini" → "MS"; "Sinar Rejeki Abadi Jaya" → "SRA".
     *
     * Three letters at most, so the number stays a number and not a second
     * name. A one-word company gives its first two letters, so it still
     * reads as an abbreviation rather than a single initial.
     */
    public static function initials(string $company): string
    {
        $words = preg_split('/[\s\-\.,&\/]+/u', trim($company), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $words = array_values(array_filter($words, fn ($w) => preg_match('/^[\p{L}\p{N}]/u', $w) === 1));

        if ($words === []) {
            return 'XX';
        }

        if (count($words) === 1) {
            return Str::upper(Str::substr($words[0], 0, 2));
        }

        return Str::upper(implode('', array_map(fn ($w) => Str::substr($w, 0, 1), array_slice($words, 0, 3))));
    }
}
