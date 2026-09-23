<?php

namespace App\Http\Controllers;

use App\Models\Letter;

/**
 * A letter that should not stand, kept on the register so its number is
 * accounted for. A draft with no number yet has nothing to account for and
 * is deleted instead.
 */
class LetterCancelController extends Controller
{
    public function __invoke(Letter $letter)
    {
        if ($letter->isCanceled()) {
            return back();
        }

        if ($letter->canBeDeleted()) {
            $this->toast('Draft ini belum bernomor', 'Hapus saja; tidak ada yang perlu dicatat.', 'warning');

            return back();
        }

        $letter->update(['status' => Letter::CANCELED]);

        $this->toast(
            'Surat dibatalkan',
            'Nomor '.$letter->number.' tetap tercatat dan tidak dipakai surat lain.',
        );

        return back();
    }
}
