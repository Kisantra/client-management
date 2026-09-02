<?php

namespace Database\Seeders;

use App\Models\Content;
use App\Models\Lead;
use App\Support\ContentPlan;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Sample content: a few months of the team's calendar, in every status.
 *
 * Nothing here is real. Generated from a fixed seed so every machine shows
 * the same calendar. The nine pieces the sample leads name as their source
 * are created first and published early, and every lead that names one is
 * linked to it, so the chain from content to client reads end to end.
 */
class ContentSeeder extends Seeder
{
    /**
     * The pieces the sample leads came in from, as LeadSeeder names them.
     * Lead channel, shape, pillar, title.
     */
    private const SOURCES = [
        ['instagram', 'carousel', 'informasi', 'Batas Lapor SPT Badan'],
        ['instagram', 'single_photo', 'tips', 'Checklist dokumen pajak'],
        ['tiktok', 'short_video', 'edukasi', '5 Kesalahan Pembukuan UMKM'],
        ['tiktok', 'short_video', 'tips', 'Checklist audit internal'],
        ['linkedin', 'single_photo', 'edukasi', 'PPh 21 karyawan — contoh hitung'],
        ['linkedin', 'artikel', 'edukasi', 'Tax planning untuk PT baru'],
        ['web', 'artikel', 'informasi', 'Insentif pajak 2026'],
        ['web', 'artikel', 'edukasi', 'Panduan restitusi PPN'],
        ['web', 'artikel', 'informasi', 'Syarat pendirian PT 2026'],
    ];

    /** Shape, pillar, title — per the channel the piece leads with. */
    private const TITLES = [
        'instagram' => [
            ['carousel', 'edukasi', '3 tanda pembukuan perlu dirapikan'],
            ['short_video', 'edukasi', 'Kapan UMKM wajib jadi PKP?'],
            ['single_photo', 'tips', 'Cara membaca bukti potong'],
            ['story', 'informasi', 'Jadwal pajak bulan ini'],
            ['carousel', 'edukasi', 'Mitos dan fakta tax planning'],
            ['short_video', 'tips', 'Arsip faktur pajak tanpa pusing'],
            ['single_photo', 'interaksi', 'Tanya jawab: SPT Badan'],
            ['motion', 'greetings', 'Selamat Hari Raya dari kami'],
            ['carousel', 'meet_the_team', 'Kenalan dengan tim tax kami'],
            ['single_photo', 'testimonial', 'Cerita klien: SP2DK selesai rapi'],
        ],
        'tiktok' => [
            ['videos', 'informasi', 'Denda telat lapor SPT'],
            ['short_video', 'informasi', 'PPN 12%: apa yang berubah'],
            ['short_video', 'edukasi', 'Gaji vs THR, pajaknya beda?'],
            ['story', 'informasi', 'Reminder lapor SPT masa'],
            ['videos', 'edukasi', 'Cara hitung PPh final 0,5%'],
        ],
        'linkedin' => [
            ['single_photo', 'edukasi', 'Restitusi PPN: kapan layak diajukan'],
            ['artikel', 'edukasi', 'Audit internal sebelum diperiksa'],
            ['carousel', 'tips', 'Checklist kesiapan Coretax'],
            ['single_photo', 'edukasi', 'Transfer pricing untuk grup kecil'],
            ['single_photo', 'testimonial', 'Studi kasus: SP2DK yang selesai rapi'],
            ['carousel', 'employee_engagement', 'Sertifikasi brevet tim kami'],
        ],
        'web' => [
            ['artikel', 'informasi', 'Update regulasi: PMK terbaru'],
            ['artikel', 'informasi', 'Layanan: Payroll & PPh 21'],
            ['artikel', 'edukasi', 'Panduan SP2DK untuk pemilik usaha'],
            ['artikel', 'informasi', 'Kalender pajak 2026'],
            ['artikel', 'edukasi', 'Pembukuan sederhana untuk CV'],
        ],
    ];

    /**
     * Who a piece is cross-posted to besides the channel it leads with.
     * A carousel written for Instagram goes to Facebook with no extra work;
     * an article does not go to TikTok. Kept sparse, because most pieces
     * really do go out in one place.
     */
    private const ALSO = [
        'instagram' => ['facebook', 'twitter'],
        'tiktok' => ['instagram'],
        'linkedin' => ['twitter'],
        'web' => ['linkedin'],
    ];

    /** Sample copy, so the panel has something to show under "Text copy". */
    private const CAPTIONS = [
        "Batas lapor SPT tinggal hitung hari. Siapkan dokumennya dari sekarang biar tidak buru-buru di akhir.\n\nButuh bantuan? DM kami.\n\n#pajak #spt #konsultanpajak",
        "Pembukuan rapi bukan soal software mahal, tapi soal kebiasaan mencatat tiap hari.\n\nSwipe untuk 3 tandanya 👉\n\n#pembukuan #umkm #keuangan",
        "Banyak yang tanya soal ini, jadi kami rangkum jadi satu.\n\nAda yang mau ditambahkan? Tulis di komentar.\n\n#tanyapajak #edukasipajak",
    ];

    /** Where the material came from — a real page the writer worked off. */
    private const REFERENCES = [
        'https://www.pajak.go.id/id/peraturan',
        'https://jdih.kemenkeu.go.id/',
        'https://www.pajak.go.id/id/artikel',
        null,
        null,
    ];

    private const TEAM = ['Dimas', 'Sari', 'Putri', 'Bayu', 'Andre'];

    private const BRIEFS = [
        'Angle: ambil dari pertanyaan yang paling sering masuk lewat WhatsApp bulan lalu. Tutup dengan ajakan konsultasi gratis 30 menit.',
        'Format ringkas, satu poin per slide. Sertakan contoh angka yang gampang dibayangkan pemilik usaha kecil.',
        'Rujuk ke regulasi terbaru dan sebut tanggalnya. Hindari istilah teknis tanpa penjelasan.',
        'Reuse riset dari artikel web, dipadatkan untuk format pendek. Hook di 3 detik pertama.',
        'Target: pemilik PT baru dan finance staff. Sertakan link ke halaman layanan terkait.',
    ];

    private int $state = 0;

    private Carbon $today;

    public function run(): void
    {
        $this->today = Carbon::today();
        $this->state = 20260829;

        DB::transaction(function () {
            $this->seedSources();
            $this->seedCalendar();
            $this->link();
        });

        $this->command?->info(Content::count().' konten dibuat, '.Lead::whereNotNull('content_id')->count().' lead tertaut ke kontennya.');
    }

    /** The nine pieces the sample leads name, published well before the first lead. */
    private function seedSources(): void
    {
        $start = Carbon::parse('2025-02-10');

        foreach (self::SOURCES as $index => [$channel, $type, $pillar, $title]) {
            $date = $start->copy()->addDays($index * 9 + $this->int(4));

            $this->persist([
                'title' => $title,
                'channels' => $this->spread($channel),
                'pillar' => $pillar,
                'type' => $type,
                'status' => Content::PUBLISHED,
                'scheduled_for' => $date,
                'scheduled_time' => $this->slot(),
                'published_at' => $date,
                'status_changed_at' => $date,
                'owner' => $this->pick(self::TEAM),
                'brief' => $this->pick(self::BRIEFS),
                'caption' => $this->pick(self::CAPTIONS),
                'reference_url' => $this->pick(self::REFERENCES),
                'url' => $this->url($channel, $title),
            ]);
        }
    }

    /**
     * Nine weeks behind and three ahead, three to five pieces a week.
     *
     * What is past is mostly live, with a few pieces that slipped and now read
     * as late. What is ahead sits in draft, review or approved, nearer to live
     * the sooner it is due.
     */
    private function seedCalendar(): void
    {
        $channels = array_keys(self::TITLES);
        $cursor = $this->today->copy()->startOfWeek()->subWeeks(9);
        $end = $this->today->copy()->startOfWeek()->addWeeks(3);
        $used = [];

        while ($cursor->lte($end)) {
            $count = 3 + $this->int(3);

            for ($i = 0; $i < $count; $i++) {
                $channel = $channels[($i + $this->int(2)) % count($channels)];
                $pool = self::TITLES[$channel];
                [$type, $pillar, $title] = $pool[($used[$channel] ?? 0) % count($pool)];
                $used[$channel] = ($used[$channel] ?? 0) + 1;

                // Weekdays only; nobody schedules a post for Sunday.
                $date = $cursor->copy()->addDays($this->int(5));
                $status = $this->statusFor($date);
                $changed = $this->changedAt($date, $status);

                $this->persist([
                    'title' => $title,
                    'channels' => $this->spread($channel),
                    'pillar' => $pillar,
                    'type' => $type,
                    'status' => $status,
                    'scheduled_for' => $date,
                    'scheduled_time' => $this->slot(),
                    'published_at' => $status === Content::PUBLISHED ? $date : null,
                    'status_changed_at' => $changed,
                    'owner' => $this->pick(self::TEAM),
                    'brief' => $this->pick(self::BRIEFS),
                    'caption' => $this->pick(self::CAPTIONS),
                    'reference_url' => $this->pick(self::REFERENCES),
                    'url' => $status === Content::PUBLISHED ? $this->url($channel, $title) : null,
                ]);
            }

            $cursor->addWeek();
        }
    }

    /** Where a piece stands, given how far its date is from today. */
    private function statusFor(Carbon $date): string
    {
        $days = (int) $this->today->diffInDays($date, false);

        if ($days < -2) {
            // Almost everything in the past went out; a few slipped.
            return $this->next() < 0.9 ? Content::PUBLISHED : $this->pick(['draft', 'review', 'approved']);
        }

        if ($days <= 0) {
            return $this->next() < 0.6 ? Content::PUBLISHED : 'approved';
        }

        if ($days <= 7) {
            return $this->pick(['approved', 'approved', 'review', 'review', 'draft']);
        }

        return $this->pick(['draft', 'draft', 'draft', 'review', 'approved']);
    }

    /**
     * When the piece entered its status. A published piece changed on its
     * day; anything else changed a little before its date, and a few have
     * been sitting long enough to read as stuck.
     */
    private function changedAt(Carbon $date, string $status): Carbon
    {
        if ($status === Content::PUBLISHED) {
            return $date;
        }

        $stuck = $this->next() < 0.2;
        $back = $stuck ? 8 + $this->int(8) : 1 + $this->int(4);

        return $date->copy()->subDays($back)->min($this->today);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function persist(array $attributes): void
    {
        $content = Content::create($attributes);

        /*
         | The history behind the status: one event per step up to the current
         | one, spaced a few days apart and ending on the day the status changed.
         */
        $steps = array_slice(ContentPlan::keys(), 0, ContentPlan::index($content->status) + 1);
        $at = $content->status_changed_at->copy();

        // Walk backwards from the current status; dates are immutable, so keep each step.
        foreach (array_reverse($steps) as $step) {
            $content->statusEvents()->create([
                'status' => $step,
                'author' => $this->pick(self::TEAM),
                'at' => $at,
            ]);

            $at = $at->subDays(2 + $this->int(4));
        }
    }

    /** Links every sample lead to the published piece it names. */
    private function link(): void
    {
        $published = Content::published()
            ->orderBy('published_at')
            ->get(['id', 'channels', 'title'])
            ->unique(fn (Content $content) => $content->channels[0].'|'.$content->title);

        foreach ($published as $content) {
            Lead::whereNull('content_id')
                ->where('channel', $content->channels[0])
                ->where('source', $content->title)
                ->update(['content_id' => $content->id]);
        }
    }

    /**
     * The channel a piece leads with, plus the odd cross-post.
     *
     * @return array<int, string>
     */
    private function spread(string $channel): array
    {
        $also = self::ALSO[$channel] ?? [];

        if ($also === [] || $this->next() < 0.65) {
            return [$channel];
        }

        return [$channel, $also[$this->int(count($also))]];
    }

    private function url(string $channel, string $title): string
    {
        $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $title) ?? '', '-'));

        return match ($channel) {
            'instagram' => 'https://www.instagram.com/p/'.substr(md5($title), 0, 11).'/',
            'tiktok' => 'https://www.tiktok.com/@contoh/video/'.substr(md5($title), 0, 19),
            'linkedin' => 'https://www.linkedin.com/posts/contoh_'.$slug,
            default => 'https://contoh.example/blog/'.$slug,
        };
    }

    /** A deterministic pseudo-random number in [0, 1). */
    private function next(): float
    {
        $this->state = (int) (($this->state * 1103515245 + 12345) % 2147483648);

        return $this->state / 2147483648;
    }

    private function int(int $below): int
    {
        return (int) floor($this->next() * $below);
    }

    /**
     * @template T
     *
     * @param  array<int, T>  $options
     * @return T
     */
    /**
     * The hour a piece goes out.
     *
     * Real teams publish at set hours, and one piece in six has no hour agreed
     * yet — a state the calendar has to be able to show.
     */
    private function slot(): ?string
    {
        $slots = ['07:00', '09:00', '12:00', '17:00', '19:00'];

        return $this->int(6) === 0 ? null : $slots[$this->int(count($slots))];
    }

    private function pick(array $options): mixed
    {
        return $options[$this->int(count($options))];
    }
}
