<?php

namespace App\Http\Controllers;

use App\Support\Report;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The month, or the week, written up.
 *
 * Two shapes of the same reading. The page is for a person — figures beside
 * the period before them, so a number can be judged rather than merely read —
 * and it prints, because the thing anybody is actually asked for is a PDF and
 * the browser already makes one. The CSV is for a spreadsheet, and carries the
 * rows the tables were summed from rather than the sums themselves: a report
 * you cannot check is a report somebody has to redo by hand.
 *
 * No PDF library is installed and none is needed. A print stylesheet turns the
 * page itself into the document, which also means the printed page and the
 * page on screen can never drift apart.
 */
class ReportController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $report = $this->asked($request);

        return Inertia::render('report', [
            'period' => $report->toArray(),
            'previous' => $report->previous()->toArray(),
            'steps' => [
                'back' => $report->shifted(-1)->start->toDateString(),
                /* Null at the newest period there is: a report of a month that
                   has not started counts nothing and reads as a fault. */
                'forward' => $report->isOpen()
                    ? null
                    : $report->shifted(1)->start->toDateString(),
            ],
            'summary' => $report->summary(),
            'channels' => $report->byChannel(),
            'owners' => $report->byOwner(),
            'sources' => $report->leadSources(),
            'earning' => $report->earning(),
            'generatedAt' => Report::shortDate(Carbon::now()),
        ]);
    }

    /**
     * The period's own rows, as a file a spreadsheet opens.
     *
     * Two files rather than one: content and leads have nothing in common but
     * the dates they fall between, and a single sheet holding both would be a
     * sheet nobody can sort.
     */
    public function export(Request $request, string $part): StreamedResponse
    {
        abort_unless(in_array($part, ['konten', 'lead'], true), 404);

        $report = $this->asked($request);

        $rows = $part === 'konten' ? $report->contentRows() : $report->leadRows();
        $name = 'kisantra-'.$part.'-'.$report->slug().'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');

            /*
             | The byte order mark is not decoration: without it Excel reads a
             | UTF-8 file as the local codepage and every "Rp" and every name
             | with an accent in it arrives as mojibake.
             */
            fwrite($out, "\xEF\xBB\xBF");

            if ($rows === []) {
                fputcsv($out, ['Tidak ada data pada periode ini']);
            } else {
                fputcsv($out, array_keys($rows[0]));

                foreach ($rows as $row) {
                    fputcsv($out, array_values($row));
                }
            }

            fclose($out);
        }, $name, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function asked(Request $request): Report
    {
        return Report::make(
            (string) $request->query('periode', Report::MONTHLY),
            $request->query('pada') !== null ? (string) $request->query('pada') : null,
        );
    }
}
