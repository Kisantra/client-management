<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * Reads the "Brief" tab: one written brief per pipeline run.
 *
 * Where the Berita tab is a log of rows, this one is prose — a markdown
 * document per morning, and the document has been rewritten twice while the
 * pipeline was running. Three generations are in the sheet at once:
 *
 *  - `**🔥 Topik Hangat**` with `• **Judul** — teks`, closing on a numbered
 *    Top Headlines list of Google News links.
 *  - the same, plus `⚡ Quick Win` and `🎯 Sudut Unik`, with the ideas still
 *    written as `• **"Judul"** — teks` and carrying no link at all.
 *  - `### 🔥 Topik Panas Hari Ini` with `- **Judul** — teks`, and ideas as
 *    `🔹 Judul` over a paragraph and a real publisher link.
 *
 * So the parser reads by marker rather than by shape, and anything it does
 * not recognise is kept whole in its own section instead of being dropped.
 * The raw markdown is stored beside the parse for the same reason: the
 * template will change again, and re-deriving beats re-fetching.
 */
class BriefSheet
{
    /**
     * Section headings seen in the sheet, normalised, mapped to what they are.
     *
     * `ide konten hari ini` is a label the newer template prints above the
     * whole brief rather than a section with anything under it, and the sheet
     * title is not a section either — both are dropped rather than rendered
     * as empty headings.
     */
    private const SECTIONS = [
        'topik panas hari ini' => 'topics',
        'topik hangat' => 'topics',
        'ide konten' => 'ideas',
        'quick win' => 'extra',
        'sudut unik' => 'extra',
        'topik unik' => 'extra',
        'saran' => 'extra',
        'antisipasi ke depan' => 'extra',
        'narasi berjalan' => 'extra',
        'top headlines' => 'extra',
        'ide konten hari ini' => 'drop',
        'brief pajak & keuangan' => 'drop',
    ];

    /** @param array<string, mixed> $config */
    public function __construct(private readonly array $config) {}

    public static function make(): self
    {
        return new self(config('services.news_sheet'));
    }

    public function configured(): bool
    {
        return filled($this->config['id'] ?? null) && filled($this->config['brief_gid'] ?? null);
    }

    /**
     * Every brief in the tab, newest first.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function briefs(): Collection
    {
        if (! $this->configured()) {
            throw new RuntimeException('Tab brief belum dikonfigurasi.');
        }

        return $this->select(GoogleSheet::csv(
            $this->config['id'],
            $this->config['brief_gid'],
            (int) $this->config['timeout'],
        ));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function select(string $csv): Collection
    {
        return GoogleSheet::rows($csv)
            ->map(fn (array $cells) => $this->brief($cells))
            ->filter()
            ->keyBy('fingerprint')
            ->sortByDesc(fn (array $brief) => $brief['published_at']->timestamp)
            ->values();
    }

    /**
     * @param  array<string, string|null>  $cells
     * @return array<string, mixed>|null
     */
    private function brief(array $cells): ?array
    {
        $raw = trim((string) ($cells['Brief'] ?? ''));
        $at = $this->date((string) ($cells['Tanggal'] ?? ''));

        if ($raw === '' || $at === null) {
            return null;
        }

        $sections = $this->sections($raw);

        /* Only a brief nothing at all could be read from is dropped. One
           morning the pipeline produced a headline list and no topics or
           ideas at all; that is a failed run, and a failed run the team can
           see is worth more than a gap it cannot. */
        if ($sections['topics'] === [] && $sections['ideas'] === [] && $sections['extras'] === []) {
            return null;
        }

        return [
            /* One sheet row is one brief. A rewritten brief is a different
               brief, and the sheet keeps both, so the text itself is the key. */
            'fingerprint' => sha1($raw),
            'published_at' => $at,
            'raw' => $raw,
            'topics' => $sections['topics'],
            'ideas' => $sections['ideas'],
            'extras' => $sections['extras'],
        ];
    }

    /**
     * Split one brief into the parts the page draws.
     *
     * @return array{topics: list<array<string, string|null>>, ideas: list<array<string, string|null>>, extras: list<array<string, mixed>>}
     */
    public function sections(string $raw): array
    {
        $topics = [];
        $ideas = [];
        $extras = [];

        $kind = null;
        $heading = null;
        $items = [];

        $close = function () use (&$kind, &$heading, &$items, &$topics, &$ideas, &$extras) {
            $items = array_values(array_filter($items, fn (array $i) => $i['title'] !== ''));

            if ($items !== []) {
                match ($kind) {
                    'topics' => $topics = array_merge($topics, $items),
                    'ideas' => $ideas = array_merge($ideas, $items),
                    'extra' => $extras[] = ['heading' => $heading, 'items' => $items],
                    default => null,
                };
            }

            $kind = null;
            $heading = null;
            $items = [];
        };

        foreach (preg_split('/\R/u', $raw) ?: [] as $line) {
            $line = trim($line);

            if ($line === '' || $this->isRule($line)) {
                continue;
            }

            if (($found = $this->heading($line)) !== null) {
                $close();
                [$kind, $heading] = $found;

                continue;
            }

            if ($kind === null) {
                /* Anything before the first heading — the sheet's own title
                   line and the date under it — belongs to neither section. */
                continue;
            }

            if (($marker = $this->item($line)) !== null) {
                $items[] = $marker;

                continue;
            }

            if ($items === []) {
                continue;
            }

            $last = array_key_last($items);

            if (($url = $this->link($line)) !== null) {
                $items[$last]['url'] ??= $url;

                continue;
            }

            /* A plain line under an item continues it: the newer template
               writes the idea's paragraph on its own line. */
            $items[$last]['body'] = trim(($items[$last]['body'] ?? '').' '.$this->plain($line));
        }

        $close();

        return ['topics' => $topics, 'ideas' => $ideas, 'extras' => $extras];
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    private function heading(string $line): ?array
    {
        $text = preg_replace('/^#{1,6}\s*/u', '', $line) ?? $line;
        $text = trim($this->plain($text));
        /* Every heading in this sheet leads with an emoji; stripping it is
           what lets three generations of the template share one table. */
        $text = trim(preg_replace('/^[^\p{L}\p{N}]+/u', '', $text) ?? $text);

        if ($text === '' || str_word_count($text, 0, '&0123456789') > 6) {
            return null;
        }

        $key = mb_strtolower($text);

        return isset(self::SECTIONS[$key]) ? [self::SECTIONS[$key], $text] : null;
    }

    /**
     * @return array<string, string|null>|null
     */
    private function item(string $line): ?array
    {
        $body = null;

        if (preg_match('/^\*\*(\d+)\.\*\*\s*(.+)$/u', $line, $m) === 1) {
            $line = $m[2];
        } elseif (preg_match('/^(?:[•\-–—]|🔹|▪️?|\*)\s+(.+)$/u', $line, $m) === 1) {
            $line = $m[1];
        } else {
            return null;
        }

        /* "**Judul** — teks" is the shape two of the three generations use;
           the newest writes the title alone and its paragraph underneath. */
        if (preg_match('/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/u', $line, $m) === 1) {
            [$line, $body] = [$m[1], $m[2]];
        }

        $url = $this->link($line);

        return [
            'title' => $this->plain($line),
            'body' => $body === null ? null : $this->plain($body),
            'url' => $url,
        ];
    }

    private function link(string $line): ?string
    {
        if (preg_match('/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/u', $line, $m) === 1) {
            return $m[1];
        }

        return preg_match('/^(https?:\/\/\S+)$/u', trim($line), $m) === 1 ? $m[1] : null;
    }

    /**
     * Markdown out; the page sets type rather than rendering asterisks.
     *
     * The zero-width space is removed with str_replace rather than named in a
     * trim() charlist. That charlist is a set of BYTES, not characters, so
     * `trim($text, "\u{200B}")` quietly strips a leading 0xE2 — the first byte
     * of every U+2xxx character, "⚡" among them. It left the heading as
     * broken UTF-8, every /u pattern after it returned null, and the section
     * vanished with nothing reported.
     */
    private function plain(string $text): string
    {
        $text = preg_replace('/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/u', '$1', $text) ?? $text;
        $text = preg_replace('/[*_`]+/u', '', $text) ?? $text;
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        $text = str_replace("\u{200B}", '', $text);

        return trim($text);
    }

    private function isRule(string $line): bool
    {
        return preg_match('/^[━─—\-=_]{3,}$/u', $line) === 1;
    }

    private function date(string $value): ?Carbon
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        foreach (['Y-m-d H:i:s', 'Y-m-d H:i', '!Y-m-d'] as $format) {
            try {
                return Carbon::createFromFormat($format, $value)->startOfMinute();
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }
}
