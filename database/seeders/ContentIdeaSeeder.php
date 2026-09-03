<?php

namespace Database\Seeders;

use App\Models\ContentIdea;
use App\Models\NewsItem;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Sample ideas and sample news, so both pages read as they will in use.
 *
 * Nothing here is real. Sources are categories rather than outlets on
 * purpose: fabricated headlines must not carry a real publication's name.
 */
class ContentIdeaSeeder extends Seeder
{
    private const IDEAS = [
        ['Serial 60 detik paham Coretax', 'tiktok', 'Satu fitur per episode, bahasa awam, tanpa jargon. Tutup dengan ajakan tanya di komentar.'],
        ['Behind the scene tim audit', 'instagram', 'Foto proses kerja, bukan hasil. Angkat sisi teliti dan rapinya.'],
        ['Template checklist tutup buku', 'web', 'Unduhan gratis sebagai penukar alamat email. Sertakan versi cetak.'],
        ['Q&A langsung: SP2DK itu apa', null, 'Live singkat 20 menit, pertanyaan dikumpulkan dari komentar seminggu sebelumnya.'],
        ['Infografik kalender pajak kuartal depan', 'linkedin', null],
    ];

    /** [days ago, source, title, summary, has url] */
    private const NEWS = [
        [0, 'Regulasi', 'Aturan baru insentif pajak UMKM mulai berlaku bulan depan', 'Batas omzet dan syarat administrasi berubah; client UMKM banyak yang akan bertanya.', true],
        [1, 'Media', 'Tarif PPN kembali jadi perbincangan jelang RAPBN', 'Belum ada keputusan, tapi pertanyaan client biasanya mendahului beritanya.', true],
        [1, 'Komunitas', 'Banyak UMKM salah kaprah soal PPh final 0,5%', 'Thread ramai di komunitas pengusaha; cocok jadi konten luruskan-mitos.', false],
        [2, 'Regulasi', 'Petunjuk teknis pelaporan via Coretax diperbarui', 'Ada perubahan alur unggah lampiran yang sering bikin gagal lapor.', true],
        [3, 'Internal', 'Pertanyaan terbanyak minggu ini: denda telat lapor SPT masa', 'Rekap dari WhatsApp masuk; lima orang bertanya hal yang sama.', false],
        [4, 'Media', 'Tren pemeriksaan pajak menyasar transaksi digital', 'Marketplace dan pembayaran digital jadi sorotan; relevan untuk client online.', true],
        [5, 'Regulasi', 'Batas waktu pemadanan NIK-NPWP diperpanjang', 'Kesempatan konten reminder dengan tenggat yang jelas.', true],
        [6, 'Komunitas', 'Diskusi hangat: gaji karyawan asing dan PPh 26', 'Kasus nyata dari forum HR; jarang dibahas kompetitor.', false],
        [8, 'Media', 'Survei: separuh pemilik usaha kecil tidak punya pembukuan rapi', 'Angka yang kuat untuk membuka konten edukasi pembukuan.', true],
        [9, 'Internal', 'Dua lead bulan ini bertanya soal restitusi PPN ekspor', 'Sinyal permintaan; belum ada konten yang menjawabnya.', false],
        [11, 'Regulasi', 'Formulir baru untuk permohonan insentif ditetapkan', 'Perubahan formulir selalu jadi konten how-to yang dicari.', true],
        [13, 'Media', 'Kripto dan pajak: aturan main yang sering terlewat', 'Volume pencarian naik; cocok untuk artikel web berumur panjang.', true],
    ];

    public function run(): void
    {
        $today = Carbon::today();

        foreach (self::IDEAS as $index => [$title, $channel, $note]) {
            ContentIdea::firstOrCreate(
                ['title' => $title],
                [
                    'channel' => $channel,
                    'note' => $note,
                    'author' => ['Sari', 'Dimas', 'Putri', 'Bayu', 'Andre'][$index % 5],
                    'created_at' => $today->copy()->subDays($index + 1),
                    'updated_at' => $today->copy()->subDays($index + 1),
                ],
            );
        }

        foreach (self::NEWS as $index => [$daysAgo, $source, $title, $summary, $hasUrl]) {
            $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $title) ?? '', '-'));

            NewsItem::firstOrCreate(
                ['title' => $title],
                [
                    'source' => $source,
                    'url' => $hasUrl ? 'https://contoh.example/berita/'.$slug : null,
                    'summary' => $summary,
                    'published_at' => $today->copy()->subDays($daysAgo),
                    'created_at' => $today->copy()->subDays($daysAgo),
                    'updated_at' => $today->copy()->subDays($daysAgo),
                ],
            );
        }

        $this->command?->info(ContentIdea::count().' ide dan '.NewsItem::count().' berita contoh tersedia.');
    }
}
