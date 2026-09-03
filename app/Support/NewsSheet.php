<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * Reads the "Berita" tab of the team's news sheet.
 *
 * The sheet is the output of a pipeline that runs every morning and writes
 * down everything it finds: around fifty stories a day, scored nought to ten.
 * This class is the filter between that and the app. One rule, the team's:
 * only what the pipeline scored 9 or 10, and all of it — the whole sheet, not
 * a recent slice of it. A window can be put back by setting NEWS_SHEET_DAYS.
 *
 * Four things about the sheet had to be measured rather than assumed, and all
 * four are handled here because none of them announce themselves:
 *
 *  - The dates carry Indonesian month names. `Agu`, not `Aug`. A parser that
 *    does not know that drops every August row without a word — 40% of the
 *    sheet, silently — and 21 rows use a second format entirely.
 *  - The links are Google News redirects. A story that arrives twice arrives
 *    under two different URLs, so the link cannot identify anything; the
 *    fingerprint of a normalised title can.
 *  - The publisher exists only as the tail of the title, after the last dash.
 *  - The pipeline's scores are not stable. The same story has been scored 7
 *    one day and 10 the next, so a row is refreshed on every sync rather than
 *    written once and trusted.
 */
class NewsSheet
{
    /** Indonesian month abbreviations that differ from the English ones. */
    private const MONTHS = [
        'Mei' => 'May',
        'Agu' => 'Aug',
        'Ags' => 'Aug',
        'Okt' => 'Oct',
        'Des' => 'Dec',
    ];

    /* The bare-date fallback is anchored with "!" so the missing time comes
       out as midnight rather than as whatever o'clock the sync happened to
       run at. */
    private const FORMATS = ['d M Y, H.i', 'Y-m-d H:i', '!Y-m-d'];

    /** @param array<string, mixed> $config */
    public function __construct(private readonly array $config) {}

    public static function make(): self
    {
        return new self(config('services.news_sheet'));
    }

    public function configured(): bool
    {
        return filled($this->config['id'] ?? null);
    }

    /**
     * The first moment a story may have been published and still be shown,
     * or null when the feed reads the whole sheet.
     */
    public function since(): ?Carbon
    {
        $days = (int) $this->config['days'];

        return $days > 0 ? Carbon::now()->subDays($days)->startOfDay() : null;
    }

    /**
     * Every story in the window that clears the score, newest first.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function rows(): Collection
    {
        if (! $this->configured()) {
            throw new RuntimeException('Sheet berita belum dikonfigurasi.');
        }

        return $this->select(GoogleSheet::csv(
            $this->config['id'],
            $this->config['gid'],
            (int) $this->config['timeout'],
        ));
    }

    /**
     * Every story in a CSV body that clears the window and the score.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function select(string $csv): Collection
    {
        $since = $this->since();
        $minimum = (int) $this->config['min_score'];

        return GoogleSheet::rows($csv)
            ->map(fn (array $cells) => $this->row($cells))
            ->filter()
            ->filter(fn (array $row) => $since === null || $row['published_at']->gte($since))
            ->filter(fn (array $row) => $row['score'] >= $minimum)
            /* Newest wins: the same story is re-scored every morning, and the
               latest reading is the one the sheet stands behind. */
            ->sortBy(fn (array $row) => $row['published_at']->timestamp)
            ->keyBy('fingerprint')
            ->sortByDesc(fn (array $row) => $row['published_at']->timestamp)
            ->values();
    }

    /**
     * @param  array<string, string|null>  $cells
     * @return array<string, mixed>|null
     */
    private function row(array $cells): ?array
    {
        $title = trim((string) ($cells['Judul'] ?? ''));
        $at = $this->date((string) ($cells['Tanggal'] ?? ''));

        /* A row with no title or no readable date is not a story. Rather than
           guess at either, it is left out and counted. */
        if ($title === '' || $at === null) {
            return null;
        }

        return [
            'fingerprint' => $this->fingerprint($title),
            'title' => $this->headline($title),
            'source' => $this->publisher($title),
            'category' => $this->clean($cells['Kategori'] ?? null, 48),
            'score' => (int) ($cells['Skor'] ?? 0),
            'url' => $this->clean($cells['Link'] ?? null),
            'summary' => $this->clean($cells['Ringkasan'] ?? null),
            'published_at' => $at,
        ];
    }

    private function date(string $value): ?Carbon
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        $value = strtr($value, self::MONTHS);

        foreach (self::FORMATS as $format) {
            try {
                return Carbon::createFromFormat($format, $value)->startOfMinute();
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }

    /**
     * The publisher, which the sheet only records as the tail of the title.
     *
     * Some outlets carry a dash of their own ("IKPI | Ikatan Konsultan Pajak
     * Indonesia"), so the split is on the last one, and a tail long enough to
     * be part of the headline is not a publisher at all.
     */
    private function publisher(string $title): string
    {
        $cut = mb_strrpos($title, ' - ');

        if ($cut === false) {
            return 'Tanpa sumber';
        }

        $tail = trim(mb_substr($title, $cut + 3));

        return $tail === '' || mb_strlen($tail) > 60 ? 'Tanpa sumber' : $tail;
    }

    /**
     * The headline with the outlet's own tags taken off the end of it.
     *
     * Google News sometimes appends two of them, not one — "… - MUI - Majelis
     * Ulama Indonesia", "… - radarutara.disway.id - Disway", "… - Market -
     * Bloomberg Technoz". Taking only the last leaves a headline ending in a
     * bare domain, which reads as a bug on the page.
     *
     * So after the publisher comes off, further trailing segments come off too
     * — but only single tokens. A segment with a space in it ("- Sebuah
     * Tinjauan") is part of the headline, and stripping it would be this class
     * rewriting the news.
     */
    private function headline(string $title): string
    {
        if ($this->publisher($title) === 'Tanpa sumber') {
            return mb_substr($title, 0, 512);
        }

        $head = trim(mb_substr($title, 0, (int) mb_strrpos($title, ' - ')));

        for ($i = 0; $i < 2; $i++) {
            $cut = mb_strrpos($head, ' - ');

            if ($cut === false) {
                break;
            }

            $tail = trim(mb_substr($head, $cut + 3));

            if (mb_strlen($tail) > 30 || preg_match('/\s/u', $tail) === 1) {
                break;
            }

            $head = trim(mb_substr($head, 0, $cut));
        }

        return mb_substr($head, 0, 512);
    }

    /**
     * What makes two rows the same story.
     *
     * Case, punctuation and runs of space are thrown away before hashing,
     * because the pipeline does not always reproduce a headline character for
     * character between mornings.
     */
    private function fingerprint(string $title): string
    {
        $key = mb_strtolower($title);
        $key = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $key) ?? $key;

        return sha1(trim($key));
    }

    private function clean(?string $value, ?int $limit = null): ?string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        return $limit === null ? $value : mb_substr($value, 0, $limit);
    }
}
