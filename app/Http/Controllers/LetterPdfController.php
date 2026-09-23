<?php

namespace App\Http\Controllers;

use App\Models\Letter;
use App\Support\LetterPdf;
use App\Support\LetterRenderer;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The letter as the file that gets sent.
 *
 * Streamed rather than saved: an issued letter's words are on the record, so
 * the same PDF can be made again whenever it is asked for. A draft can be
 * looked at the same way, watermark-free, because the number on it reads
 * "…" and that is warning enough.
 */
class LetterPdfController extends Controller
{
    public function __invoke(Request $request, Letter $letter): StreamedResponse
    {
        $letter->load(['template', 'lead']);

        $pdf = LetterPdf::render($letter);
        $name = LetterRenderer::fileName($letter);

        /* ?lihat=1 opens it in the tab instead of saving it: the way to check
           the page breaks before sending. */
        $disposition = $request->boolean('lihat') ? 'inline' : 'attachment';

        return response()->stream(
            fn () => print $pdf,
            200,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => $disposition.'; filename="'.str_replace('"', '', $name).'"',
            ],
        );
    }
}
