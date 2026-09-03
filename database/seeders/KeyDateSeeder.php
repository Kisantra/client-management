<?php

namespace Database\Seeders;

use App\Models\KeyDate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * The dates a tax firm's content year is built around.
 *
 * Only what can be relied on is here. Fixed-date national days do not move,
 * and the filing deadlines are written into the tax law rather than decided
 * each year — those are seeded as confirmed. Everything on the lunar and Hindu
 * calendars, and every cuti bersama, is set annually by a joint decree of
 * three ministries, and this seeder does not guess at them: for a firm that
 * advises on deadlines, a plausible wrong date is worse than a missing one.
 * `run()` says so when it finishes.
 *
 * Safe to run repeatedly. Rows are keyed on the day and the title, so a second
 * run refreshes the notes rather than doubling the calendar.
 */
class KeyDateSeeder extends Seeder
{
    /**
     * National days that fall on the same date every year.
     *
     * @var array<int, array{0: int, 1: int, 2: string, 3: string}>
     */
    private const HOLIDAYS = [
        [1, 1, 'Tahun Baru Masehi', 'Awal tahun pajak baru. Momen untuk konten checklist kewajiban setahun ke depan.'],
        [5, 1, 'Hari Buruh Internasional', 'Angle PPh 21, THR, dan kewajiban pemberi kerja.'],
        [6, 1, 'Hari Lahir Pancasila', 'Hari libur nasional; jadwal tayang biasanya digeser.'],
        [8, 17, 'Hari Kemerdekaan RI', 'Konten seremonial dan rekap kontribusi pajak untuk pembangunan.'],
        [12, 25, 'Hari Raya Natal', 'Hari libur nasional; jadwal tayang biasanya digeser.'],
    ];

    /**
     * Days that are not holidays but that the audience is already talking
     * about, so a post has somewhere to land.
     *
     * @var array<int, array{0: int, 1: int, 2: string, 3: string}>
     */
    private const OBSERVANCES = [
        [4, 21, 'Hari Kartini', 'Angle pengusaha perempuan dan literasi keuangan.'],
        [5, 2, 'Hari Pendidikan Nasional', 'Angle edukasi pajak untuk pemilik usaha baru.'],
        [5, 20, 'Hari Kebangkitan Nasional', 'Angle UMKM bangkit dan insentif yang tersedia.'],
        [8, 12, 'Hari UMKM Nasional', 'Paling relevan untuk firma ini: PPh final UMKM, batas omzet, dan kapan wajib jadi PKP.'],
        [10, 1, 'Hari Kesaktian Pancasila', 'Konten seremonial.'],
        [10, 28, 'Hari Sumpah Pemuda', 'Angle wirausaha muda dan pajak pertama mereka.'],
        [11, 10, 'Hari Pahlawan', 'Konten seremonial.'],
        [12, 22, 'Hari Ibu', 'Angle ibu pemilik usaha dan pembukuan rumah tangga usaha.'],
    ];

    /**
     * Deadlines and observances fixed by the tax law itself.
     *
     * @var array<int, array{0: int, 1: int, 2: string, 3: string, 4: string}>
     */
    private const ANNUAL_TAX = [
        [3, 31, 'Batas lapor SPT Tahunan Orang Pribadi', 'Puncak musim SPT OP. Konten pengingat mulai dari awal Februari.', 'UU KUP'],
        [4, 30, 'Batas lapor SPT Tahunan Badan', 'Puncak musim SPT Badan. Konten pengingat mulai dari akhir Maret.', 'UU KUP'],
        [7, 14, 'Hari Pajak', 'Hari Pajak nasional. Momen paling wajar untuk konten edukasi perpajakan.', 'Peringatan nasional'],
    ];

    /**
     * The monthly rhythm, which is where most of the year's deadlines are.
     *
     * A deadline landing on a holiday or weekend moves to the next working
     * day. The statutory date is what is stored, because the day it moves to
     * depends on a holiday list this seeder deliberately does not invent.
     *
     * @var array<int, array{day: int|null, title: string, note: string}>
     */
    private const MONTHLY_TAX = [
        [
            'day' => 10,
            'title' => 'Batas setor PPh',
            'note' => 'PPh Pasal 21, 23, 26 dan 4 ayat (2) untuk masa pajak bulan sebelumnya.',
        ],
        [
            'day' => 15,
            'title' => 'Batas setor PPh Pasal 25',
            'note' => 'Angsuran PPh Pasal 25 untuk masa pajak bulan sebelumnya.',
        ],
        [
            'day' => 20,
            'title' => 'Batas lapor SPT Masa PPh',
            'note' => 'Pelaporan SPT Masa PPh untuk masa pajak bulan sebelumnya.',
        ],
        [
            /* The last day of the month, whatever length it is. */
            'day' => null,
            'title' => 'Batas lapor & setor SPT Masa PPN',
            'note' => 'SPT Masa PPN untuk masa pajak bulan sebelumnya, jatuh di akhir bulan.',
        ],
    ];

    private const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    public function run(): void
    {
        $thisYear = Carbon::today()->year;
        $years = [$thisYear, $thisYear + 1];
        $written = 0;

        foreach ($years as $year) {
            foreach (self::HOLIDAYS as [$month, $day, $title, $note]) {
                $written += $this->put($year, $month, $day, $title, KeyDate::LIBUR, $note, 'Tanggal tetap');
            }

            foreach (self::OBSERVANCES as [$month, $day, $title, $note]) {
                $written += $this->put($year, $month, $day, $title, KeyDate::LIBUR, $note, 'Tanggal tetap');
            }

            foreach (self::ANNUAL_TAX as [$month, $day, $title, $note, $source]) {
                $written += $this->put($year, $month, $day, $title, KeyDate::PAJAK, $note, $source);
            }

            foreach (range(1, 12) as $month) {
                foreach (self::MONTHLY_TAX as $rule) {
                    $due = Carbon::create($year, $month, 1);
                    $day = $rule['day'] ?? $due->copy()->endOfMonth()->day;

                    /*
                     | Named for the period it settles, not the month it falls
                     | in. A deadline on 10 September is for August's masa, and
                     | the date beside it already says September — labelling it
                     | September twice would say the wrong thing twice.
                     */
                    $period = self::MONTHS[$due->copy()->subMonthNoOverflow()->month - 1];

                    $written += $this->put(
                        $year,
                        $month,
                        $day,
                        $rule['title'].' masa '.$period,
                        KeyDate::PAJAK,
                        $rule['note'].' Kalau jatuh di hari libur, batasnya mundur ke hari kerja berikutnya.',
                        'Ketentuan bulanan',
                    );
                }
            }
        }

        $this->command?->info($written.' tanggal penting tersimpan untuk '.implode(' dan ', $years).'.');

        /*
         | Said out loud rather than left for someone to discover: the holidays
         | that move are the ones a content calendar most needs, and they are
         | exactly the ones this seeder refuses to invent.
         */
        $this->command?->warn(
            'Belum termasuk: Idul Fitri, Idul Adha, Nyepi, Waisak, Imlek, Isra Mikraj, '
            .'Wafat & Kenaikan Isa Almasih, Tahun Baru Islam, Maulid Nabi, dan cuti bersama. '
            .'Tanggalnya ditetapkan SKB 3 Menteri tiap tahun — tambahkan dari SKB resmi, '
            .'jangan dari perkiraan.'
        );
    }

    /** One row, refreshed rather than duplicated on a second run. */
    private function put(
        int $year,
        int $month,
        int $day,
        string $title,
        string $kind,
        string $note,
        string $source,
    ): int {
        KeyDate::updateOrCreate(
            [
                'date' => Carbon::create($year, $month, $day)->toDateString(),
                'title' => $title,
            ],
            [
                'kind' => $kind,
                'note' => $note,
                'source' => $source,
                'confirmed' => true,
            ],
        );

        return 1;
    }
}
