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
    /** The pieces the sample leads came in from, as LeadSeeder names them. */
    private const SOURCES = [
        ['instagram', 'carousel', 'Batas Lapor SPT Badan'],
        ['instagram', 'feed', 'Checklist dokumen pajak'],
        ['tiktok', 'video', '5 Kesalahan Pembukuan UMKM'],
        ['tiktok', 'video', 'Checklist audit internal'],
        ['linkedin', 'post', 'PPh 21 karyawan — contoh hitung'],
        ['linkedin', 'artikel', 'Tax planning untuk PT baru'],
        ['web', 'artikel', 'Insentif pajak 2026'],
        ['web', 'artikel', 'Panduan restitusi PPN'],
        ['web', 'halaman', 'Syarat pendirian PT 2026'],
    ];

    private const TITLES = [
        'instagram' => [
            ['carousel', '3 tanda pembukuan perlu dirapikan'],
            ['reels', 'Kapan UMKM wajib jadi PKP?'],
            ['feed', 'Cara membaca bukti potong'],
            ['story', 'Jadwal pajak bulan ini'],
            ['carousel', 'Mitos dan fakta tax planning'],
            ['reels', 'Arsip faktur pajak tanpa pusing'],
            ['feed', 'Tanya jawab: SPT Badan'],
        ],
        'tiktok' => [
            ['video', 'Denda telat lapor SPT'],
            ['video', 'PPN 12%: apa yang berubah'],
            ['video', 'Gaji vs THR, pajaknya beda?'],
            ['story', 'Reminder lapor SPT masa'],
            ['video', 'Cara hitung PPh final 0,5%'],
        ],
        'linkedin' => [
            ['post', 'Restitusi PPN: kapan layak diajukan'],
            ['artikel', 'Audit internal sebelum diperiksa'],
            ['dokumen', 'Checklist kesiapan Coretax'],
            ['post', 'Transfer pricing untuk grup kecil'],
            ['post', 'Studi kasus: SP2DK yang selesai rapi'],
        ],
        'web' => [
            ['update', 'Update regulasi: PMK terbaru'],
            ['halaman', 'Layanan: Payroll & PPh 21'],
            ['artikel', 'Panduan SP2DK untuk pemilik usaha'],
            ['artikel', 'Kalender pajak 2026'],
            ['artikel', 'Pembukuan sederhana untuk CV'],
        ],
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

        foreach (self::SOURCES as $index => [$channel, $format, $title]) {
            $date = $start->copy()->addDays($index * 9 + $this->int(4));

            $this->persist([
                'title' => $title,
                'channel' => $channel,
                'format' => $format,
                'status' => Content::PUBLISHED,
                'scheduled_for' => $date,
                'published_at' => $date,
                'status_changed_at' => $date,
                'owner' => $this->pick(self::TEAM),
                'brief' => $this->pick(self::BRIEFS),
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
        $channels = ContentPlan::channels();
        $cursor = $this->today->copy()->startOfWeek()->subWeeks(9);
        $end = $this->today->copy()->startOfWeek()->addWeeks(3);
        $used = [];

        while ($cursor->lte($end)) {
            $count = 3 + $this->int(3);

            for ($i = 0; $i < $count; $i++) {
                $channel = $channels[($i + $this->int(2)) % count($channels)];
                $pool = self::TITLES[$channel];
                [$format, $title] = $pool[($used[$channel] ?? 0) % count($pool)];
                $used[$channel] = ($used[$channel] ?? 0) + 1;

                // Weekdays only; nobody schedules a post for Sunday.
                $date = $cursor->copy()->addDays($this->int(5));
                $status = $this->statusFor($date);
                $changed = $this->changedAt($date, $status);

                $this->persist([
                    'title' => $title,
                    'channel' => $channel,
                    'format' => $format,
                    'status' => $status,
                    'scheduled_for' => $date,
                    'published_at' => $status === Content::PUBLISHED ? $date : null,
                    'status_changed_at' => $changed,
                    'owner' => $this->pick(self::TEAM),
                    'brief' => $this->pick(self::BRIEFS),
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
            ->get(['id', 'channel', 'title'])
            ->unique(fn (Content $content) => $content->channel.'|'.$content->title);

        foreach ($published as $content) {
            Lead::whereNull('content_id')
                ->where('channel', $content->channel)
                ->where('source', $content->title)
                ->update(['content_id' => $content->id]);
        }
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
    private function pick(array $options): mixed
    {
        return $options[$this->int(count($options))];
    }
}
