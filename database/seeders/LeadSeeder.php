<?php

namespace Database\Seeders;

use App\Models\Lead;
use App\Models\LeadAttachment;
use App\Models\LeadFollowUp;
use App\Models\LeadNote;
use App\Models\LeadStageEvent;
use App\Support\Pipeline;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Sample leads at the volume PRODUCT.md records — hundreds a month.
 *
 * Nothing here is real. The set is generated from a fixed seed rather than
 * hand-written, so the same 304 leads appear on every machine and the screens
 * that were designed against them keep showing what they were designed for.
 * Stage totals match the dashboard's pipeline exactly.
 */
class LeadSeeder extends Seeder
{
    /** How many leads sit in each stage, and how many of those are stalled. */
    private const VOLUME = [
        ['key' => 'lead', 'count' => 148, 'stalled' => 9],
        ['key' => 'kontak', 'count' => 62, 'stalled' => 6],
        ['key' => 'konsultasi', 'count' => 31, 'stalled' => 4],
        ['key' => 'proposal', 'count' => 14, 'stalled' => 3],
        ['key' => 'deal', 'count' => 6, 'stalled' => 1],
        ['key' => 'client', 'count' => 43, 'stalled' => 0],
    ];

    private const FIRST = [
        'Sinar', 'Bumi', 'Nusa', 'Karya', 'Anugerah', 'Mitra', 'Cahaya',
        'Sumber', 'Global', 'Tunas', 'Bina', 'Sentosa', 'Duta', 'Berkah',
        'Mandiri', 'Prima', 'Adhi', 'Surya', 'Lintas', 'Graha', 'Tani',
        'Arta', 'Wira', 'Kencana', 'Mekar', 'Indo',
    ];

    private const SECOND = [
        'Rejeki', 'Artha', 'Pratama', 'Mandiri', 'Jaya', 'Sejati', 'Abadi',
        'Makmur', 'Persada', 'Harapan', 'Usaha', 'Raya', 'Niaga', 'Sukses',
        'Cipta', 'Karsa',
    ];

    private const PREFIX = ['PT', 'PT', 'PT', 'CV', 'CV', 'UD', 'Koperasi'];

    private const PIC_FIRST = [
        'Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hendra',
        'Indah', 'Joko', 'Kartika', 'Lukman', 'Maya', 'Nanda', 'Oki', 'Putri',
        'Rizal', 'Sari', 'Tono', 'Wulan', 'Yudi', 'Zahra',
    ];

    private const PIC_LAST = [
        'Santoso', 'Wijaya', 'Halim', 'Kusuma', 'Prasetyo', 'Rahman',
        'Setiawan', 'Hartono', 'Nugroho', 'Permata', 'Salim', 'Gunawan',
    ];

    private const SERVICES = [
        'PPh Badan', 'PPN', 'Payroll & PPh 21', 'Tax Planning',
        'Audit Internal', 'Pendirian PT', 'Restitusi Pajak', 'Konsultasi Umum',
    ];

    /** The content each lead came in from: the chain this product exists for. */
    private const SOURCES = [
        ['instagram', 'Batas Lapor SPT Badan'],
        ['instagram', 'Checklist dokumen pajak'],
        ['tiktok', '5 Kesalahan Pembukuan UMKM'],
        ['tiktok', 'Checklist audit internal'],
        ['linkedin', 'PPh 21 karyawan — contoh hitung'],
        ['linkedin', 'Tax planning untuk PT baru'],
        ['web', 'Insentif pajak 2026'],
        ['web', 'Panduan restitusi PPN'],
        ['web', 'Syarat pendirian PT 2026'],
    ];

    private const ROLES = [
        'Finance Manager', 'Direktur', 'Owner', 'Accounting Staff',
        'General Manager', 'Komisaris',
    ];

    private const STREETS = [
        'Ahmad Yani', 'Gajah Mada', 'Pangeran Antasari', 'Juanda', 'M. Yamin',
    ];

    private const TEAM = ['Dimas', 'Sari', 'Putri', 'Bayu', 'Andre'];

    private const NOTE_BODIES = [
        'Menanyakan biaya penyusunan SPT Badan untuk tahun buku terakhir. Belum punya pembukuan rapi, masih Excel.',
        'Sudah dikirim daftar dokumen yang perlu disiapkan. Menunggu balasan dari sisi client.',
        'Ada rencana ekspansi cabang tahun depan, kemungkinan butuh tax planning terpisah.',
        'Client minta jadwal konsultasi setelah tanggal 15, sedang tutup buku bulanan.',
        'Nomor WhatsApp sudah tersambung, komunikasi lanjut lewat sana.',
        'Pernah kena SP2DK tahun lalu, ingin pendampingan kalau terjadi lagi.',
        'Minta penawaran dipecah per layanan, bukan paket tahunan.',
    ];

    private const NOTE_FILES = [
        ['screenshot-chat.png'],
        ['kartu-nama.png'],
        ['proposal-v1.pdf'],
        ['rekap-omzet-2025.pdf', 'screenshot-chat.png'],
    ];

    /**
     * Leads that stopped, by how many months ago they came in — oldest first.
     *
     * A year of work is mostly this: enquiries that never became anything. They
     * stay on record because the months they arrived in, and the stages they
     * died at, are the only way to read how the funnel is doing.
     */
    private const CLOSED_BY_MONTH = [28, 30, 32, 36, 38, 42, 44, 48, 50, 54, 58, 60];

    /** Where a lost lead tends to die: most never get past the first call. */
    private const CLOSED_AT_STAGE = [
        ['lead', 40],
        ['kontak', 25],
        ['konsultasi', 18],
        ['proposal', 12],
        ['deal', 5],
    ];

    /** Ghosting is the common ending; an outright no is rarer. */
    private const CLOSED_REASONS = [
        ['hilang_kontak', 50],
        ['ditolak', 32],
        ['belum_butuh', 18],
    ];

    private const FOLLOWUP_VIA = ['WhatsApp', 'Telepon', 'Email', 'Kunjungan'];

    private const FOLLOWUP_NOTES = [
        'Menanyakan kelanjutan dokumen yang diminta.',
        'Konfirmasi jadwal konsultasi.',
        'Mengingatkan batas waktu pelaporan.',
        'Menanyakan tanggapan atas penawaran.',
    ];

    /** A 1x1 PNG, stood in for the screenshots and cards a real team uploads. */
    private const SAMPLE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    private int $state = 0;

    private Carbon $today;

    /** Company names already handed out, across both cohorts. */
    private array $used = [];

    public function run(): void
    {
        $this->today = Carbon::today();

        Storage::disk('public')->deleteDirectory('leads');

        $leads = $this->generate();
        $closed = $this->generateClosed();

        DB::transaction(function () use ($leads, $closed) {
            foreach ($leads as $row) {
                $this->persist($row);
            }

            foreach ($closed as $row) {
                $this->persistClosed($row);
            }
        });

        $this->command?->info(count($leads).' lead aktif dan '.count($closed).' lead tidak lanjut dibuat.');
    }

    /**
     * The generated set.
     *
     * The order of the random draws below is deliberate and load-bearing: it
     * mirrors the generator the screens were designed against, so the sample
     * data does not change shape when it moves to the database.
     *
     * @return array<int, array<string, mixed>>
     */
    private function generate(): array
    {
        $this->state = 20260827;

        $out = [];
        $id = 1;

        foreach (self::VOLUME as $stageIndex => $volume) {
            $threshold = Pipeline::threshold($volume['key']);

            for ($i = 0; $i < $volume['count']; $i++) {
                [$entity, $company] = $this->name();

                $stalled = $i < $volume['stalled'];
                $source = $this->pick(self::SOURCES);

                // Stalled leads sit past the stage's own tolerance; the rest inside it.
                $daysInStage = $stalled
                    ? $threshold + 1 + $this->int(18)
                    : max(1, $this->int($threshold));

                /*
                 | A lead deeper in the pipeline has been around longer. The
                 | spread widens with each stage so the sample reads as a year
                 | of work rather than a single busy week.
                 */
                $daysSinceEntry = $daysInStage + $stageIndex * 20 + $this->int(40 + $stageIndex * 65);

                /*
                 | A lead that has never moved has been in its stage since it
                 | arrived: entry and stage change are the same day.
                 */
                if ($stageIndex === 0) {
                    $daysSinceEntry = $daysInStage;
                }

                $pic = $this->pick(self::PIC_FIRST).' '.$this->pick(self::PIC_LAST);
                $service = $this->pick(self::SERVICES);
                $value = (4 + $this->int(28)) * 2_500_000;
                $daysSinceContact = min($daysInStage, $this->int(21));

                $out[] = [
                    'id' => $id++,
                    'index' => $stageIndex,
                    'entity' => $entity,
                    'company' => $company,
                    'pic' => $pic,
                    'stage' => $volume['key'],
                    'channel' => $source[0],
                    'source' => $source[1],
                    'service' => $service,
                    'value' => $value,
                    'daysInStage' => $daysInStage,
                    'daysSinceContact' => $daysSinceContact,
                    'daysSinceEntry' => $daysSinceEntry,
                ];
            }
        }

        return $out;
    }

    /**
     * One lead and everything hanging off it: its history, its notes and the
     * files behind them, and the follow-ups on either side of the current stage.
     */
    private function persist(array $row): void
    {
        $detail = $this->detail($row);

        $lead = Lead::create([
            'entity' => $row['entity'],
            'company' => $row['company'],
            'pic' => $row['pic'],
            'pic_role' => $detail['role'],
            'phone' => $detail['phone'],
            'email' => $detail['email'],
            'npwp' => $detail['npwp'],
            'address' => $detail['address'],
            'city' => 'Samarinda',
            'office_lat' => $detail['office']['lat'] ?? null,
            'office_lng' => $detail['office']['lng'] ?? null,
            'channel' => $row['channel'],
            'source' => $row['source'],
            'service' => $row['service'],
            'value' => $row['value'],
            'stage' => $row['stage'],
            'owner' => $detail['owner'],
            'entered_at' => $this->daysAgo($row['daysSinceEntry']),
            'stage_changed_at' => $this->daysAgo($row['daysInStage']),
            'last_contact_at' => $this->daysAgo($row['daysSinceContact']),
        ]);

        foreach ($detail['timeline'] as $step) {
            LeadStageEvent::create([
                'lead_id' => $lead->id,
                'stage' => $step['key'],
                'entered_at' => $step['enteredAt'],
            ]);
        }

        foreach ($detail['notes'] as $note) {
            $record = LeadNote::create([
                'lead_id' => $lead->id,
                'author' => $note['author'],
                'body' => $note['body'],
                'created_at' => $note['at'],
                'updated_at' => $note['at'],
            ]);

            foreach ($note['files'] as $name) {
                $this->attach($lead, $record, $name, $note['at']);
            }
        }

        foreach ($detail['followUps'] as $followUp) {
            LeadFollowUp::create([
                'lead_id' => $lead->id,
                'scheduled_for' => $followUp['at'],
                'via' => $followUp['via'],
                'note' => $followUp['note'],
                'done' => $followUp['done'],
            ]);
        }
    }

    /**
     * Everything the detail page shows, derived from the lead's own position in
     * the pipeline so its history adds up to the time it has actually been open.
     */
    private function detail(array $row): array
    {
        // Hashed from the lead's own id: the same lead always gets the same detail.
        $this->state = ($row['id'] * 2654435761) % 4294967296;

        $index = $row['index'];
        $before = max($row['daysSinceEntry'] - $row['daysInStage'], 0);

        // Days before the current stage, split across the stages already passed.
        $weights = [];

        for ($step = 0; $step < $index; $step++) {
            $weights[] = 0.5 + $this->next();
        }

        $total = array_sum($weights) ?: 1;

        /*
         | Split the days before the current stage across the stages already
         | passed. Rounded cumulatively rather than per stage, so the parts add
         | up to the whole and the last move lands exactly on the day the lead
         | entered the stage it is in now.
         */
        $spent = 0;
        $running = 0.0;
        $days = [];

        for ($step = 0; $step < $index; $step++) {
            $running += ($weights[$step] / $total) * $before;
            $upTo = (int) round($running);
            $days[$step] = max($upTo - $spent, 0);
            $spent = $upTo;
        }

        $elapsed = $row['daysSinceEntry'];
        $timeline = [];
        $stages = Pipeline::stages();

        for ($step = 0; $step <= $index; $step++) {
            $timeline[] = [
                'key' => $stages[$step]['key'],
                'enteredAt' => $this->daysAgo($elapsed),
            ];

            $elapsed = max($elapsed - ($days[$step] ?? 0), 0);
        }

        $noteCount = 2 + $this->int(2);
        $notes = [];

        for ($i = 0; $i < $noteCount; $i++) {
            $notes[] = [
                'author' => $this->pick(self::TEAM),
                'at' => $this->daysAgo(max(
                    (int) round($row['daysSinceEntry'] * (($i + 1) / ($noteCount + 1))),
                    $row['daysSinceContact'],
                )),
                'body' => self::NOTE_BODIES[($row['id'] + $i * 3) % count(self::NOTE_BODIES)],
                // Roughly a third of notes carry evidence, as they would in practice.
                'files' => ($row['id'] + $i) % 3 === 0
                    ? self::NOTE_FILES[($row['id'] + $i) % count(self::NOTE_FILES)]
                    : [],
            ];
        }

        /*
         | Follow-ups sit between stage moves: one already done inside the
         | current stage, and — unless the lead is already a client — one still
         | ahead.
         */
        $followUps = [[
            'at' => $this->daysAgo(max((int) round($row['daysInStage'] / 2), 1)),
            'via' => $this->pick(self::FOLLOWUP_VIA),
            'note' => $this->pick(self::FOLLOWUP_NOTES),
            'done' => true,
        ]];

        if ($row['stage'] !== 'client') {
            $followUps[] = [
                'at' => $this->daysAgo(-(1 + $this->int(9))),
                'via' => $this->pick(self::FOLLOWUP_VIA),
                'note' => $this->pick(self::FOLLOWUP_NOTES),
                'done' => false,
            ];
        }

        $hasOffice = $this->next() > 0.35;
        $slug = strtolower(str_replace(' ', '', $row['company']));
        $firstName = strtolower(explode(' ', $row['pic'])[0]);

        return [
            'role' => $this->pick(self::ROLES),
            'phone' => '08'.($this->int(9) + 1).str_pad((string) $this->int(100_000_000), 8, '0', STR_PAD_LEFT),
            'email' => $firstName.'@'.$slug.'.co.id',
            'npwp' => sprintf(
                '%d.%d.%d.%d-%d.000',
                $this->int(90) + 10,
                $this->int(900) + 100,
                $this->int(900) + 100,
                $this->int(9),
                $this->int(900) + 100,
            ),
            'address' => 'Jl. '.$this->pick(self::STREETS).' No. '.($this->int(90) + 1),
            // Jittered around Samarinda so the map shows a plausible local office.
            'office' => $hasOffice ? [
                'lat' => round(-0.5022 + ($this->next() - 0.5) * 0.09, 6),
                'lng' => round(117.1536 + ($this->next() - 0.5) * 0.09, 6),
            ] : null,
            'owner' => $this->pick(self::TEAM),
            'timeline' => $timeline,
            'notes' => array_reverse($notes),
            'followUps' => $followUps,
        ];
    }

    /** Writes a real file so the attachment chips lead somewhere. */
    private function attach(Lead $lead, LeadNote $note, string $name, Carbon $at): void
    {
        $extension = pathinfo($name, PATHINFO_EXTENSION);

        $body = $extension === 'pdf'
            ? $this->samplePdf($lead->displayName().' — '.$name)
            : base64_decode(self::SAMPLE_PNG);

        $path = 'leads/'.$lead->id.'/'.uniqid().'.'.($extension === 'pdf' ? 'pdf' : 'png');

        Storage::disk('public')->put($path, $body);

        LeadAttachment::create([
            'lead_id' => $lead->id,
            'lead_note_id' => $note->id,
            'name' => $name,
            'path' => $path,
            'mime' => $extension === 'pdf' ? 'application/pdf' : 'image/png',
            'size' => strlen($body),
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }

    /** A one-page PDF that actually opens, with its cross-reference table. */
    private function samplePdf(string $title): string
    {
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $title);
        $stream = "BT /F1 16 Tf 56 760 Td ({$text}) Tj ET";

        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
            '<< /Length '.strlen($stream)." >>\nstream\n".$stream."\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];

        foreach ($objects as $i => $body) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n".$body."\nendobj\n";
        }

        $start = strlen($pdf);
        $size = count($objects) + 1;

        $pdf .= "xref\n0 {$size}\n0000000000 65535 f \n";

        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf."trailer\n<< /Size {$size} /Root 1 0 R >>\nstartxref\n{$start}\n%%EOF\n";
    }

    /**
     * The contact details a lead is taken down with.
     *
     * A lead that went nowhere still had a person behind it, so its page reads
     * like a record rather than a row of blanks.
     */
    private function contact(string $pic, string $company): array
    {
        return [
            'pic_role' => $this->pick(self::ROLES),
            'phone' => '08'.($this->int(9) + 1).str_pad((string) $this->int(100_000_000), 8, '0', STR_PAD_LEFT),
            'email' => strtolower(explode(' ', $pic)[0])
                .'@'.strtolower(str_replace(' ', '', $company)).'.co.id',
            'address' => 'Jl. '.$this->pick(self::STREETS).' No. '.($this->int(90) + 1),
            'city' => 'Samarinda',
        ];
    }

    /** A company name nobody else has been given yet. */
    private function name(): array
    {
        do {
            $entity = $this->pick(self::PREFIX);
            $company = $this->pick(self::FIRST).' '.$this->pick(self::SECOND);
            $full = $entity.' '.$company;
        } while (isset($this->used[$full]));

        $this->used[$full] = true;

        return [$entity, $company];
    }

    /** Picks from a list of [value, weight] pairs. */
    private function weighted(array $options): string
    {
        $total = array_sum(array_column($options, 1));
        $roll = $this->next() * $total;

        foreach ($options as [$value, $weight]) {
            $roll -= $weight;

            if ($roll < 0) {
                return $value;
            }
        }

        return $options[0][0];
    }

    /**
     * The leads that went nowhere, spread across the last twelve months.
     *
     * Each one arrives, moves as far as it got, and stops. Its stage is left
     * where it died — that is the whole point of keeping it.
     *
     * @return array<int, array<string, mixed>>
     */
    private function generateClosed(): array
    {
        $this->state = 20250714;

        $out = [];

        foreach (self::CLOSED_BY_MONTH as $offset => $count) {
            $monthsAgo = count(self::CLOSED_BY_MONTH) - 1 - $offset;
            $month = $this->today->copy()->startOfMonth()->subMonths($monthsAgo);
            $span = $monthsAgo === 0 ? max($this->today->day - 1, 1) : $month->daysInMonth;

            for ($i = 0; $i < $count; $i++) {
                [$entity, $company] = $this->name();

                $stage = $this->weighted(self::CLOSED_AT_STAGE);
                $index = Pipeline::index($stage);
                $source = $this->pick(self::SOURCES);

                // Long enough to have got where it got, then a while going quiet.
                $alive = max($index * 6 + 3 + $this->int(30), $index * 2 + 3);

                /*
                 | The month it arrived in has to be wide enough to hold the
                 | whole story. Squeezing it against today would produce leads
                 | that reached Deal and closed on the same afternoon.
                 */
                $earliest = $month->copy();
                $latest = min(
                    $month->copy()->endOfMonth(),
                    $this->today->copy()->subDays($alive),
                );

                if ($latest->lt($earliest)) {
                    $latest = $earliest->copy();
                    $alive = max((int) $earliest->diffInDays($this->today), $index + 1);
                }

                $enteredAt = $earliest->copy()->addDays(
                    $this->int((int) $earliest->diffInDays($latest) + 1),
                );
                $closedAt = $enteredAt->copy()->addDays($alive);

                $pic = $this->pick(self::PIC_FIRST).' '.$this->pick(self::PIC_LAST);

                $out[] = [
                    'entity' => $entity,
                    'company' => $company,
                    'pic' => $pic,
                    'contact' => $this->contact($pic, $company),
                    'stage' => $stage,
                    'index' => $index,
                    'channel' => $source[0],
                    'source' => $source[1],
                    'service' => $this->pick(self::SERVICES),
                    'value' => (4 + $this->int(28)) * 2_500_000,
                    'owner' => $this->pick(self::TEAM),
                    'reason' => $this->weighted(self::CLOSED_REASONS),
                    'enteredAt' => $enteredAt,
                    'closedAt' => $closedAt,
                ];
            }
        }

        return $out;
    }

    /**
     * A closed lead and the moves it made before it stopped. No notes and no
     * files: what matters about these is when they came in and where they died.
     */
    private function persistClosed(array $row): void
    {
        $alive = (int) $row['enteredAt']->diffInDays($row['closedAt']);
        $index = $row['index'];
        $stages = Pipeline::stages();

        /*
         | A lead goes quiet in the stage it dies in, so that stage holds most
         | of the wait; the moves before it are spread over what is left.
         */
        $tail = max((int) round($alive * 0.55), 2);
        $each = $index > 0 ? max(intdiv(max($alive - $tail, $index), $index), 1) : 0;

        $steps = [];
        $at = $row['enteredAt']->copy();

        for ($step = 0; $step < $index; $step++) {
            $steps[] = ['stage' => $stages[$step]['key'], 'at' => $at->copy()];
            $at = $at->copy()->addDays($each);
        }

        $final = $row['closedAt']->copy()->subDays($tail);

        $steps[] = [
            'stage' => $stages[$index]['key'],
            'at' => $final->lt($at) ? $at->copy() : $final,
        ];

        $lead = Lead::create([
            'entity' => $row['entity'],
            'company' => $row['company'],
            'pic' => $row['pic'],
            ...$row['contact'],
            'channel' => $row['channel'],
            'source' => $row['source'],
            'service' => $row['service'],
            'value' => $row['value'],
            'stage' => $row['stage'],
            'owner' => $row['owner'],
            'status' => Lead::CLOSED,
            'closed_reason' => $row['reason'],
            'closed_at' => $row['closedAt'],
            'entered_at' => $row['enteredAt'],
            'stage_changed_at' => end($steps)['at'],
            'last_contact_at' => $row['closedAt'],
        ]);

        foreach ($steps as $step) {
            LeadStageEvent::create([
                'lead_id' => $lead->id,
                'stage' => $step['stage'],
                'entered_at' => $step['at'],
            ]);
        }
    }

    private function daysAgo(int $days): Carbon
    {
        return $this->today->copy()->subDays($days);
    }

    /**
     * The same linear congruential generator the front-end sample data used, so
     * the seeded set is the one the screens were built against.
     */
    private function next(): float
    {
        $this->state = ($this->state * 1664525 + 1013904223) % 4294967296;

        return $this->state / 4294967296;
    }

    private function int(int $bound): int
    {
        return (int) floor($this->next() * $bound);
    }

    /** @param array<int, mixed> $list */
    private function pick(array $list): mixed
    {
        return $list[(int) floor($this->next() * count($list))];
    }
}
