<?php

namespace App\Http\Controllers;

use App\Models\LetterNumberCounter;
use App\Support\LetterNumber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Where a number sequence stands, for an office picking up from a paper
 * register: the last number already used outside this app goes in, and the
 * next letter continues after it.
 *
 * The counter can be moved forward freely and back only as far as the
 * highest number already printed here, so no two letters share a number.
 */
class LetterCounterController extends Controller
{
    public function update(Request $request)
    {
        $validated = $request->validate([
            'prefix' => ['required', 'string', 'max:8', 'exists:letter_templates,number_prefix'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'last' => ['required', 'integer', 'min:0', 'max:99999'],
        ], [
            'last.required' => 'Isi nomor terakhir yang sudah terpakai.',
        ]);

        /* Locked the way issuing locks it, so a letter numbered in the same
           second is counted before the floor is checked. */
        DB::transaction(function () use ($validated) {
            $counter = LetterNumberCounter::query()
                ->where('prefix', $validated['prefix'])
                ->where('year', $validated['year'])
                ->lockForUpdate()
                ->first();

            $highest = LetterNumber::highestIssued($validated['prefix'], $validated['year']);

            if ($validated['last'] < $highest) {
                throw ValidationException::withMessages([
                    'last' => 'Nomor '.$highest.' sudah terpakai di surat '.$validated['prefix'].' tahun ini. Counter tidak bisa diturunkan di bawahnya.',
                ]);
            }

            $counter
                ? $counter->update(['last_sequence' => $validated['last']])
                : LetterNumberCounter::create(['prefix' => $validated['prefix'], 'year' => $validated['year'], 'last_sequence' => $validated['last']]);
        });

        $this->toast('Penomoran disimpan', 'Surat '.$validated['prefix'].' berikutnya bernomor urut '.($validated['last'] + 1).'.');

        return back();
    }
}
