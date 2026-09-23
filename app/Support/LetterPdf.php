<?php

namespace App\Support;

use App\Models\Letter;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\File;

/**
 * A letter as a PDF, on the letterhead, in Arial.
 *
 * Rendered on request rather than kept on disk: an issued letter's words are
 * frozen on the record, so the file can be made again at any time and is
 * always the same file. Nothing to sync, nothing to go stale.
 */
class LetterPdf
{
    public static function render(Letter $letter): string
    {
        $letterhead = config('letter.letterhead.image');
        $letterheadPath = $letterhead && is_file(public_path($letterhead)) ? public_path($letterhead) : null;

        $html = view('pdf.letter', [
            'letter' => $letter,
            'document' => LetterRenderer::document($letter, forPdf: true),
            'styles' => LetterRenderer::styles(),
            'letterhead' => $letterheadPath,
            'margins' => config('letter.letterhead.margins'),
        ])->render();

        $cache = storage_path('app/dompdf');
        File::ensureDirectoryExists($cache);

        $options = new Options;
        $options->setChroot([base_path()]);
        $options->setFontDir($cache);
        $options->setFontCache($cache);
        $options->setDefaultFont('Arial');
        $options->setIsFontSubsettingEnabled(true);
        /* The letterhead and the signature are local files; nothing here is
           fetched over the network, so a slow host can never hold up a download. */
        $options->setIsRemoteEnabled(false);

        $dompdf = new Dompdf($options);

        foreach (config('letter.fonts', []) as $font) {
            $file = resource_path('fonts/'.$font['file']);

            if (File::exists($file)) {
                $dompdf->getFontMetrics()->registerFont(
                    ['family' => 'Arial', 'weight' => $font['weight'], 'style' => $font['style']],
                    $file,
                );
            }
        }

        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }
}
