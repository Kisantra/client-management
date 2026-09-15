<?php

namespace App\Http\Controllers;

use App\Support\Deepseek;
use App\Support\LeadsReport;
use App\Support\PerformanceReport;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Laporan Kuartalan: the quarter as a document, in two parts.
 *
 * Part I is the pipeline and Part II is the accounts. They are bound into one
 * file on purpose — reach is a means, and a quarter of good numbers on the
 * accounts should never be presentable without the quarter of business
 * underneath it.
 *
 * The screen shows what the document will say and lets somebody choose the
 * stretch it covers; the PDF is the thing that gets sent, printed, and read by
 * whoever was not watching all along. Both are rendered from one computation,
 * so the page can never promise a figure the file does not carry.
 */
class PerformanceReportController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $report = $this->asked($request);
        $facts = $this->facts($report);

        return Inertia::render('performance-report', [
            'report' => $facts,
            /*
             | The reading is fetched lazily. It is a call to somebody else's
             | server, and the figures — which are the report — must be on
             | screen before it, not behind it.
             */
            'analysis' => Inertia::optional(fn () => Deepseek::make()->read($facts)),
            'analysisAvailable' => Deepseek::make()->configured(),
            'spans' => PerformanceReport::SPANS,
            'asked' => [
                'bulan' => $report->months,
                'sampai' => $report->to->format('Y-m'),
                /* Nothing to step forward into: a report of a month that has
                   not begun counts nothing and reads as a fault. */
                'max' => now()->format('Y-m'),
            ],
        ]);
    }

    /**
     * The same report, rendered to paper.
     *
     * Streamed rather than saved: a report is a view of the database at the
     * moment it was asked for, and a file left on disk is a figure that stops
     * being true the next time anybody syncs.
     */
    public function download(Request $request): StreamedResponse
    {
        $report = $this->asked($request);
        $facts = $this->facts($report);

        $html = view('reports.performance', [
            'report' => $facts,
            'analysis' => Deepseek::make()->read($facts),
        ])->render();

        $pdf = $this->render($html);
        $name = 'kisantra-laporan-'.$report->slug().'.pdf';

        return response()->streamDownload(
            fn () => print $pdf,
            $name,
            ['Content-Type' => 'application/pdf'],
        );
    }

    /**
     * HTML to PDF, in the product's own typeface.
     *
     * dompdf ships Helvetica and nothing else, and a report set in the one
     * face every other PDF in the world uses is a report that looks like it
     * came from a form. Manrope is registered from the repo — the same family
     * the app is set in — so the printed page and the screen it was read on
     * are recognisably the same document.
     */
    private function render(string $html): string
    {
        $cache = storage_path('app/dompdf');
        File::ensureDirectoryExists($cache);

        $options = new Options;
        $options->setChroot([base_path()]);
        $options->setFontDir($cache);
        $options->setFontCache($cache);
        $options->setDefaultFont('Manrope');
        /* Nothing in this document is fetched over the network: every figure
           is local and there are no images. Off, so a slow host can never
           hold up a download. */
        $options->setIsRemoteEnabled(false);

        $dompdf = new Dompdf($options);

        foreach ([400 => 'normal', 700 => 'bold', 800 => 'bold'] as $weight => $style) {
            $file = resource_path("fonts/manrope-{$weight}.ttf");

            if (File::exists($file)) {
                $dompdf->getFontMetrics()->registerFont(
                    ['family' => 'Manrope', 'weight' => $weight, 'style' => $style],
                    $file,
                );
            }
        }

        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }

    /**
     * Both halves of the document, computed once.
     *
     * The two reports are kept as separate classes — one knows about posts,
     * the other about leads, and neither has any business knowing about the
     * other — but they are always asked the same question over the same window
     * and always answered together. A document that could show a quarter of
     * reach without the quarter of business underneath it is the document this
     * one was written to replace.
     *
     * @return array<string, mixed>
     */
    private function facts(PerformanceReport $report): array
    {
        return [
            ...$report->toArray(),
            'leads' => LeadsReport::between($report->from, $report->to)->toArray(),
        ];
    }

    private function asked(Request $request): PerformanceReport
    {
        return PerformanceReport::make(
            $request->query('sampai'),
            (int) $request->query('bulan', 3),
        );
    }
}
