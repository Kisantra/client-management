<?php

namespace App\Support;

use App\Models\Letter;
use App\Models\LetterTemplate;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Turns a letter's template and values into the words on the page.
 *
 * One renderer for the on-screen preview and the PDF, so what the writer
 * watches while typing is what prints. The output is plain HTML with its own
 * class names and no framework in it, because dompdf is the second reader
 * and it understands only the 2004 subset of the web.
 */
class LetterRenderer
{
    private const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    /**
     * The whole document for the screen or the PDF: head, body, signature.
     *
     * An issued letter renders from the words it went out with; a draft
     * renders live from its template and values.
     */
    public static function document(Letter $letter, bool $forPdf = false): string
    {
        $letter->loadMissing(['template', 'lead']);

        $body = $letter->isDraft() || $letter->rendered_html === null
            ? self::body($letter)
            : $letter->rendered_html;

        $company = config('letter.company');
        $signer = config('letter.signer');
        $image = $signer['image'] ?? null;
        $imageSrc = null;

        if ($image && is_file(public_path($image))) {
            $imageSrc = $forPdf ? public_path($image) : '/'.ltrim($image, '/');
        }

        return view('letters.document', [
            'letter' => $letter,
            'forPdf' => $forPdf,
            'body' => $body,
            'dateLine' => ($company['city'] ? $company['city'].', ' : '').self::date($letter->letter_date),
            'recipient' => self::interpolate(e($letter->recipient), self::builtins($letter)),
            'legalName' => $company['legal_name'] ?: $company['name'],
            'signatureSrc' => $imageSrc,
        ])->render();
    }

    /** The paper's stylesheet, shared by the preview and the PDF. */
    public static function styles(): string
    {
        return view('letters.style')->render();
    }

    /**
     * The body alone: the template's paragraphs with every blank filled.
     */
    public static function body(Letter $letter): string
    {
        $letter->loadMissing(['template', 'lead']);

        $template = $letter->template;
        $fields = $template->fieldDefinitions();
        $values = $letter->values ?? [];
        $placeholders = self::builtins($letter);

        foreach ($fields as $key => $field) {
            $placeholders[$key] = self::value($field, $values[$key] ?? null, $placeholders, $fields, $values);
        }

        $html = '';

        foreach (preg_split("/\R{2,}/", trim($template->body)) ?: [] as $paragraph) {
            $paragraph = trim($paragraph);

            if ($paragraph === '') {
                continue;
            }

            /*
             | A paragraph that is only one placeholder is a block: a list
             | renders as a list, a fee table as a table, and an optional
             | field left blank drops the paragraph rather than printing "…".
             */
            if (preg_match('/^\{\{\s*([a-z0-9_]+)\s*\}\}$/i', $paragraph, $match) && isset($fields[$match[1]])) {
                $field = $fields[$match[1]];

                if (self::blank($field, $values[$match[1]] ?? null) && ! $field['required']) {
                    continue;
                }

                if (in_array($field['type'], ['list', 'items'], true)) {
                    $html .= $placeholders[$match[1]];

                    continue;
                }
            }

            if (preg_match('/^(-\s.+\R?)+$/', $paragraph)) {
                $items = collect(preg_split("/\R/", $paragraph) ?: [])
                    ->map(fn ($line) => '<li>'.self::inline(ltrim(substr(trim($line), 1)), $placeholders).'</li>')
                    ->join('');

                $html .= '<ul>'.$items.'</ul>';

                continue;
            }

            $html .= '<p>'.nl2br(self::inline($paragraph, $placeholders)).'</p>';
        }

        return $html;
    }

    /**
     * The fields still empty that the template says must not be, by label.
     *
     * @return array<int, string>
     */
    public static function missing(Letter $letter): array
    {
        $values = $letter->values ?? [];

        return collect($letter->template->fieldDefinitions())
            ->filter(fn (array $field) => $field['required'] && self::blank($field, $values[$field['key']] ?? null))
            ->pluck('label')
            ->values()
            ->all();
    }

    /** The sum of every row in every items field, in rupiah. */
    public static function total(Letter $letter): int
    {
        $values = $letter->values ?? [];

        return (int) collect($letter->template->fieldDefinitions())
            ->where('type', 'items')
            ->sum(fn (array $field) => self::sumItems($values[$field['key']] ?? []));
    }

    /** "28 Agustus 2026", in the app's own words rather than the locale's. */
    public static function date(mixed $value): string
    {
        if (blank($value)) {
            return '…';
        }

        $date = $value instanceof CarbonInterface ? $value : Carbon::parse($value);

        return $date->day.' '.self::MONTHS[$date->month - 1].' '.$date->year;
    }

    /** "Rp 10.000.000". */
    public static function rupiah(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }

    /**
     * What every template can print without declaring a field, escaped.
     *
     * @return array<string, string>
     */
    private static function builtins(Letter $letter): array
    {
        $company = config('letter.company');
        $lead = $letter->lead;
        $total = self::total($letter);

        return [
            'klien' => e($letter->clientName()),
            'klien_kapital' => e(mb_strtoupper($letter->clientName())),
            'pic' => e($lead->pic),
            'layanan_lead' => e($lead->service),
            'nomor' => e($letter->number ?? '…'),
            'tanggal_surat' => e(self::date($letter->letter_date)),
            'perusahaan' => e($company['name']),
            'perusahaan_legal' => e($company['legal_name'] ?: $company['name']),
            'kota' => e($company['city']),
            'telepon' => e($company['phone']),
            'email' => e($company['email']),
            'email_marketing' => e($company['marketing_email'] ?: $company['email']),
            'total' => e(self::rupiah($total)),
            'terbilang' => e(Terbilang::rupiah($total)),
        ];
    }

    /**
     * One field's value as HTML: lists and tables as blocks, text inline.
     *
     * @param  array<string, string>  $placeholders
     * @param  array<string, array<string, mixed>>  $fields
     * @param  array<string, mixed>  $values
     */
    private static function value(array $field, mixed $value, array $placeholders, array $fields, array $values): string
    {
        if (self::blank($field, $value)) {
            return '<span class="ltr-blank">'.e($field['placeholder'] ?: '…').'</span>';
        }

        return match ($field['type']) {
            'date' => e(self::date($value)),
            'select' => e($field['options'][$value] ?? (string) $value),
            'list' => self::list($field, (string) $value, $placeholders),
            'items' => self::items($field, (array) $value, $fields, $values, $placeholders),
            'textarea' => nl2br(self::inline((string) $value, $placeholders)),
            default => self::inline((string) $value, $placeholders),
        };
    }

    /** Escapes, then applies **bold** and fills placeholders. */
    private static function inline(string $text, array $placeholders): string
    {
        $escaped = e($text);
        $escaped = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $escaped) ?? $escaped;

        return self::interpolate($escaped, $placeholders);
    }

    /**
     * Fills {{placeholders}} in already-escaped text. e() leaves braces
     * alone, so the tokens survive escaping intact. An unknown token is
     * printed marked, so a misspelt placeholder is seen rather than lost.
     */
    private static function interpolate(string $escaped, array $placeholders): string
    {
        return preg_replace_callback('/\{\{\s*([a-z0-9_]+)\s*\}\}/i', function ($match) use ($placeholders) {
            return $placeholders[$match[1]] ?? '<span class="ltr-missing">'.e('{'.$match[1].'}').'</span>';
        }, $escaped) ?? $escaped;
    }

    private static function list(array $field, string $value, array $placeholders): string
    {
        $items = self::lines($value);

        if ($items === []) {
            return '<span class="ltr-blank">'.e($field['placeholder'] ?: '…').'</span>';
        }

        $tag = ($field['style'] ?? 'bullet') === 'number' ? 'ol' : 'ul';

        return '<'.$tag.'>'.collect($items)
            ->map(fn ($line) => '<li>'.self::inline($line, $placeholders).'</li>')
            ->join('').'</'.$tag.'>';
    }

    /**
     * The fee table: one lettered section per kind of service, each with its
     * own numbered rows, then the total in digits and in words.
     *
     * @param  array<int, array{title?: string, rows?: array<int, array{name?: string, amount?: mixed}>}>  $sections
     */
    private static function items(array $field, array $sections, array $fields, array $values, array $placeholders): string
    {
        $html = '';
        $letters = range('A', 'Z');

        foreach (array_values($sections) as $i => $section) {
            $rows = array_values(array_filter((array) ($section['rows'] ?? []), fn ($row) => filled($row['name'] ?? null)));

            if ($rows === [] && blank($section['title'] ?? null)) {
                continue;
            }

            $html .= '<div class="ltr-section">';
            $html .= '<p class="ltr-section-title">'.($letters[$i] ?? $i + 1).'.) '.e((string) ($section['title'] ?? '')).'</p>';
            $html .= '<table class="ltr-items"><thead><tr>'
                .'<th class="ltr-col-no">NO</th><th>KETERANGAN</th><th class="ltr-col-amount">BIAYA</th>'
                .'</tr></thead><tbody>';

            foreach ($rows as $n => $row) {
                $html .= '<tr>'
                    .'<td class="ltr-col-no">'.($n + 1).'</td>'
                    .'<td>'.e((string) $row['name']).'</td>'
                    .'<td class="ltr-col-amount">'.e(self::rupiah(self::amount($row['amount'] ?? 0))).'</td>'
                    .'</tr>';
            }

            $html .= '</tbody></table></div>';
        }

        $total = self::sumItems($sections);
        $note = $field['note_key'] ? trim((string) ($values[$field['note_key']] ?? '')) : '';

        $html .= '<p class="ltr-total">'
            .'<strong>Biaya Jasa:</strong><br>'
            .'<strong>'.e(self::rupiah($total)).',-</strong> ('.e(Terbilang::rupiah($total)).')'
            .($note !== '' ? '<br><em>'.self::inline($note, $placeholders).'</em>' : '')
            .'</p>';

        return $html;
    }

    /** @param  array<int, array{rows?: array<int, array{amount?: mixed}>}>  $sections */
    private static function sumItems(array $sections): int
    {
        $total = 0;

        foreach ($sections as $section) {
            foreach ((array) ($section['rows'] ?? []) as $row) {
                if (filled($row['name'] ?? null)) {
                    $total += self::amount($row['amount'] ?? 0);
                }
            }
        }

        return $total;
    }

    /** "10.000.000", "10000000" or 10000000 → 10000000. */
    private static function amount(mixed $raw): int
    {
        return (int) preg_replace('/\D+/', '', (string) $raw);
    }

    /** @return array<int, string> */
    private static function lines(string $text): array
    {
        return collect(preg_split("/\R/", $text) ?: [])
            ->map(fn ($line) => trim((string) preg_replace('/^\s*(\d+[.)]|[-*•])\s*/', '', $line)))
            ->filter(fn ($line) => $line !== '')
            ->values()
            ->all();
    }

    private static function blank(array $field, mixed $value): bool
    {
        return match ($field['type']) {
            'items' => self::sumItems((array) $value) === 0 && collect((array) $value)
                ->every(fn ($section) => collect((array) ($section['rows'] ?? []))->every(fn ($row) => blank($row['name'] ?? null))),
            'list' => self::lines((string) $value) === [],
            default => blank($value),
        };
    }

    /** The name the PDF is saved under: "Surat Penawaran - Marwi Sulistyarini - PEN-001-KSN-MS-IX-2026.pdf". */
    public static function fileName(Letter $letter): string
    {
        $parts = array_filter([
            trim($letter->subject),
            trim($letter->lead->company),
            $letter->number ? str_replace('/', '-', $letter->number) : 'Draft-'.$letter->id,
        ]);

        $name = preg_replace('/[\\\\\/:*?"<>|]+/u', '-', implode(' - ', $parts)) ?? '';
        $name = trim((string) preg_replace('/\s+/u', ' ', $name));

        return Str::limit($name, 180, '').'.pdf';
    }

    /** Every placeholder a template may use, for the editor's reference list. */
    public static function placeholderReference(LetterTemplate $template): array
    {
        return [
            'builtin' => collect(LetterTemplate::BUILTIN)
                ->map(fn ($help, $key) => ['key' => $key, 'help' => $help])
                ->values()
                ->all(),
            'fields' => collect($template->fieldDefinitions())
                ->map(fn ($field) => ['key' => $field['key'], 'help' => $field['label'].' ('.LetterTemplate::FIELD_TYPES[$field['type']].')'])
                ->values()
                ->all(),
        ];
    }
}
