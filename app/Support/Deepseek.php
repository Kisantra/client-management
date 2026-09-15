<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The reading of the figures, written out.
 *
 * A table of medians tells a reader what happened; it does not tell them what
 * it means or what to do on Monday. That paragraph is the one part of a report
 * a person actually acts on, and it is also the part nobody has time to write
 * every month — so the model writes it.
 *
 * The model is never allowed near a calculation. It receives figures this app
 * computed, and its whole job is to put them into sentences: which of them is
 * the finding, which is noise, and what follows. The prompt says so, the
 * schema it must answer in leaves no room for a stray number to become a
 * claim, and every figure printed in the document comes from the report, not
 * from here.
 *
 * When there is no key, no network or no patience, the report renders in full
 * without this section. Numbers that took a quarter to earn do not wait on a
 * third party being up.
 */
final class Deepseek
{
    /**
     * What the model must answer with. Anything else is discarded rather than
     * printed: a half-parsed analysis is worse than an absent one.
     */
    private const SHAPE = <<<'JSON'
    {
      "ringkasan": "2-4 kalimat",
      "temuan": [{"judul": "3-6 kata", "isi": "1-2 kalimat"}],
      "rekomendasi": [{"judul": "3-6 kata", "isi": "1-2 kalimat"}],
      "risiko": "1-2 kalimat, atau string kosong bila tidak ada"
    }
    JSON;

    private const SYSTEM = <<<'TEXT'
    Kamu analis pemasaran untuk sebuah kantor jasa akuntansi dan pajak di Indonesia.
    Kamu menerima angka yang SUDAH dihitung dari dua bagian: pipeline lead
    (Bagian I) dan performa media sosial (Bagian II). Tugasmu hanya membacanya.

    Aturan keras:
    - Jangan menghitung, memperkirakan, atau menyebut angka yang tidak ada di data.
    - Boleh mengutip angka dari data, apa adanya.
    - "khas" = median, "rata-rata" = mean. Bila keduanya jauh berbeda, itu temuan.
    - Engagement rate tiap platform memakai pembagi berbeda (Instagram: pengikut,
      TikTok: pemutaran khas). Jangan pernah membandingkan angka rate antar platform.
    - Bila sebuah platform punya sedikit post, katakan datanya tipis, jangan
      menyimpulkan tren darinya.
    - Rekomendasi harus bisa dikerjakan tim minggu depan, bukan nasihat umum.
    - Lead dan post terjadi bersamaan, bukan sebab-akibat. Jangan pernah menulis
      bahwa post tertentu menghasilkan lead tertentu; penautannya belum ada.
    - "Lead masuk" adalah lead yang datang di periode ini. "Client baru" adalah
      lead yang ditutup di periode ini, sebagian besar datang jauh sebelumnya.
      Jangan membagi keduanya menjadi satu angka konversi.
    - Ringkasan wajib menyentuh kedua bagian, bukan hanya salah satunya.

    Bahasa Indonesia, lugas, tanpa jargon pemasaran, tanpa basa-basi pembuka.
    Jawab HANYA JSON valid sesuai bentuk yang diminta.
    TEXT;

    public static function make(): self
    {
        return new self;
    }

    public function configured(): bool
    {
        return filled(config('services.deepseek.key'));
    }

    /**
     * The analysis for one report, or null when it could not be had.
     *
     * Cached on the shape of the figures themselves: asking twice for the same
     * quarter is the same question, and every ask is billed.
     *
     * @param  array<string, mixed>  $facts
     * @return array<string, mixed>|null
     */
    public function read(array $facts): ?array
    {
        if (! $this->configured()) {
            return null;
        }

        $key = 'deepseek:'.md5(json_encode($this->brief($facts)));

        return cache()->remember($key, now()->addHours(12), fn () => $this->ask($facts));
    }

    /** Throws the cached reading away, for a report asked to think again. */
    public function forget(array $facts): void
    {
        cache()->forget('deepseek:'.md5(json_encode($this->brief($facts))));
    }

    /** @return array<string, mixed>|null */
    private function ask(array $facts): ?array
    {
        try {
            $response = Http::withToken(config('services.deepseek.key'))
                ->timeout(config('services.deepseek.timeout'))
                ->acceptJson()
                ->post(rtrim(config('services.deepseek.base'), '/').'/chat/completions', [
                    'model' => config('services.deepseek.model'),
                    'messages' => [
                        ['role' => 'system', 'content' => self::SYSTEM],
                        ['role' => 'user', 'content' => $this->prompt($facts)],
                    ],
                    'response_format' => ['type' => 'json_object'],
                    /* Low, not zero: the same quarter should read the same way
                       twice, and this is analysis rather than invention. */
                    'temperature' => 0.3,
                    'max_tokens' => 1400,
                ]);

            if ($response->failed()) {
                Log::warning('DeepSeek menolak permintaan', [
                    'status' => $response->status(),
                    'body' => mb_substr($response->body(), 0, 400),
                ]);

                return null;
            }

            $content = $response->json('choices.0.message.content');

            return $content ? $this->parse($content) : null;
        } catch (Throwable $error) {
            Log::warning('DeepSeek tidak bisa dihubungi', ['error' => $error->getMessage()]);

            return null;
        }
    }

    /**
     * The answer, kept only if it is the shape that was asked for.
     *
     * @return array<string, mixed>|null
     */
    private function parse(string $content): ?array
    {
        $decoded = json_decode($content, true);

        if (! is_array($decoded) || ! isset($decoded['ringkasan'])) {
            return null;
        }

        $list = fn (mixed $rows) => collect(is_array($rows) ? $rows : [])
            ->filter(fn ($row) => is_array($row) && filled($row['judul'] ?? null))
            ->map(fn (array $row) => [
                'judul' => (string) $row['judul'],
                'isi' => (string) ($row['isi'] ?? ''),
            ])
            ->take(5)
            ->values()
            ->all();

        return [
            'ringkasan' => (string) $decoded['ringkasan'],
            'temuan' => $list($decoded['temuan'] ?? []),
            'rekomendasi' => $list($decoded['rekomendasi'] ?? []),
            'risiko' => trim((string) ($decoded['risiko'] ?? '')) ?: null,
            'model' => config('services.deepseek.model'),
        ];
    }

    /**
     * The figures, as the model receives them.
     *
     * Deliberately smaller than the report: captions, links and per-post rows
     * are left out. They cost tokens, they invite the model to quote a post
     * back as if it were a finding, and none of them change the reading.
     *
     * @param  array<string, mixed>  $facts
     * @return array<string, mixed>
     */
    private function brief(array $facts): array
    {
        return [
            'periode' => $facts['period']['label'],
            'lama_bulan' => $facts['period']['months'],
            'gabungan' => $facts['combined'],
            'per_bulan' => collect($facts['months'])->map(fn (array $row) => [
                'bulan' => $row['label'].' '.$row['year'],
                'post' => $row['posts'],
                'interaksi' => $row['interactions'],
            ])->all(),
            'platform' => collect($facts['platforms'])->map(fn (array $row) => [
                'nama' => $row['label'],
                'post_terukur' => $row['measured'],
                'pengikut' => $row['followers'],
                'total' => $row['totals'],
                'khas' => $row['typical'],
                'rata_rata' => $row['average'],
                'engagement' => $row['engagement'],
                'irama' => $row['cadence'],
                'format' => $row['formats'],
                'konsentrasi' => $row['concentration'],
                'pencilan' => $row['outlier'],
            ])->all(),
            'bisnis' => $facts['business'],
            'lead' => [
                'ikhtisar' => $facts['leads']['summary'] ?? null,
                'corong' => $facts['leads']['funnel'] ?? null,
                'sumber' => $facts['leads']['sources'] ?? null,
                'kecepatan' => $facts['leads']['speed'] ?? null,
                'penanggung_jawab' => $facts['leads']['owners'] ?? null,
                'berhenti' => $facts['leads']['closed'] ?? null,
                'follow_up' => $facts['leads']['followUps'] ?? null,
                'per_bulan' => $facts['leads']['months'] ?? null,
            ],
        ];
    }

    /** @param  array<string, mixed>  $facts */
    private function prompt(array $facts): string
    {
        return 'Data laporan kuartalan Kisantra (Bagian I lead, Bagian II media sosial):'.PHP_EOL.PHP_EOL
            .json_encode($this->brief($facts), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE).PHP_EOL.PHP_EOL
            .'Bentuk jawaban yang diminta:'.PHP_EOL.self::SHAPE.PHP_EOL.PHP_EOL
            .'Beri 3 sampai 4 temuan dan 3 sampai 4 rekomendasi.';
    }
}
