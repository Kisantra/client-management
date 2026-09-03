<?php

namespace App\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * One tab of a published Google Sheet, read as CSV.
 *
 * The team's news pipeline writes four tabs into one sheet, and two of them
 * feed this app. Both reads need the same three things handled the same way,
 * so they live here rather than twice: the export URL, the failure that
 * arrives dressed as a sign-in page, and headings that carry stray spaces.
 */
class GoogleSheet
{
    private const ENDPOINT = 'https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s';

    public static function csv(string $id, string $gid, int $timeout): string
    {
        try {
            $response = Http::timeout($timeout)->get(sprintf(self::ENDPOINT, $id, $gid));
        } catch (ConnectionException $e) {
            throw new RuntimeException('Sheet tidak bisa dihubungi: '.$e->getMessage(), 0, $e);
        }

        if (! $response->successful()) {
            /*
             | A sheet that has stopped being shared answers with a sign-in
             | page rather than an error, so the status code is the only
             | warning there is that the door was closed.
             */
            throw new RuntimeException(
                'Sheet menjawab '.$response->status().'. Periksa apakah tautannya masih dibagikan.'
            );
        }

        return $response->body();
    }

    /**
     * Every data row, keyed by its heading.
     *
     * @return Collection<int, array<string, string|null>>
     */
    public static function rows(string $csv): Collection
    {
        $handle = fopen('php://memory', 'r+');
        fwrite($handle, $csv);
        rewind($handle);

        $header = fgetcsv($handle, escape: '');

        if ($header === false) {
            fclose($handle);

            throw new RuntimeException('Sheet kosong.');
        }

        /* The sheet's own headings carry stray spaces — "Tanggal ", " Kategori ". */
        $header = array_map(fn ($name) => trim((string) $name), $header);
        $rows = collect();

        while (($line = fgetcsv($handle, escape: '')) !== false) {
            if ($line === [null] || $line === []) {
                continue;
            }

            $rows->push(array_combine(
                $header,
                array_pad(array_slice($line, 0, count($header)), count($header), null),
            ));
        }

        fclose($handle);

        return $rows;
    }
}
