<?php

namespace App\Models;

use App\Models\Concerns\RecordsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The words of one kind of letter, and the blanks in them.
 *
 * A template is paragraphs with {{placeholders}}. Some placeholders the
 * system fills by itself — the client, the number, the date — and the rest
 * are fields the writer fills for each letter. The office edits the wording
 * here, once, and every letter made afterwards reads the new way; letters
 * already issued keep the words they went out with.
 *
 * One register serves the whole office: the marketing team's offers and the
 * tax team's replies to the tax office, berita acara and document requests
 * are all templates here, told apart by category and numbered by prefix.
 *
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property string $category
 * @property string $number_prefix
 * @property string $subject
 * @property string|null $recipient
 * @property string|null $stage_on_issue
 * @property array<int, array{label?: string}|string>|null $signers
 * @property bool $checklist_as_attachment
 * @property array<int, array<string, mixed>> $fields
 * @property string $body
 * @property int $sort_order
 * @property bool $is_active
 */
class LetterTemplate extends Model
{
    use RecordsActivity {
        activityFieldLabels as sharedFieldLabels;
    }

    /** The kinds of blank a template may ask the writer to fill. */
    public const FIELD_TYPES = [
        'text' => 'Teks singkat',
        'textarea' => 'Paragraf',
        'list' => 'Daftar (satu butir per baris)',
        'select' => 'Pilihan',
        'date' => 'Tanggal',
        'items' => 'Rincian jasa dan biaya',
        'checklist' => 'Daftar dokumen (bisa dicentang saat diterima)',
        'currency' => 'Nominal rupiah',
        'number' => 'Angka',
    ];

    /** What kind of document a template makes, for grouping and the picker. */
    public const CATEGORIES = [
        'surat' => 'Surat',
        'berita_acara' => 'Berita acara',
        'pengingat' => 'Pengingat',
        'pemberitahuan' => 'Pemberitahuan',
    ];

    /** The slot a template without its own signer list prints. */
    private const DEFAULT_SLOTS = [['label' => 'Direktur']];

    /**
     * Placeholders every template may use without declaring a field.
     *
     * @var array<string, string>
     */
    public const BUILTIN = [
        'klien' => 'Nama client, berikut badan usahanya (PT Sinar Rejeki)',
        'klien_kapital' => 'Nama client dalam huruf kapital',
        'pic' => 'Nama PIC di sisi client',
        'layanan_lead' => 'Layanan yang ditanyakan lead',
        'proyek' => 'Proyek yang dipilih di surat',
        'nomor' => 'Nomor surat (terisi saat diterbitkan)',
        'tanggal_surat' => 'Tanggal surat, ditulis lengkap',
        'perusahaan' => 'Nama kantor (Kisantra)',
        'perusahaan_legal' => 'Nama badan hukum kantor (PT Kinara Sadayatra Nusantara)',
        'kota' => 'Kota kantor',
        'telepon' => 'Telepon kantor',
        'email' => 'Email kantor',
        'email_marketing' => 'Email marketing kantor',
        'total' => 'Jumlah seluruh biaya pada rincian jasa',
        'terbilang' => 'Jumlah biaya dalam kata-kata',
    ];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'fields' => 'array',
            'signers' => 'array',
            'checklist_as_attachment' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function letters(): HasMany
    {
        return $this->hasMany(Letter::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    /**
     * The fields, keyed by their key, with every optional part filled in so
     * nothing downstream has to ask whether a template said.
     *
     * @return array<string, array{key: string, label: string, type: string, required: bool, placeholder: ?string, help: ?string, options: array<string, string>, default: mixed, style: string, note_key: ?string}>
     */
    public function fieldDefinitions(): array
    {
        return collect($this->fields ?? [])
            ->filter(fn ($field) => filled($field['key'] ?? null))
            ->map(fn ($field) => [
                'key' => $field['key'],
                'label' => $field['label'] ?? $field['key'],
                'type' => array_key_exists($field['type'] ?? '', self::FIELD_TYPES) ? $field['type'] : 'text',
                'required' => (bool) ($field['required'] ?? false),
                'placeholder' => $field['placeholder'] ?? null,
                'help' => $field['help'] ?? null,
                'options' => (array) ($field['options'] ?? []),
                'default' => $field['default'] ?? null,
                // list: bullet | number
                'style' => $field['style'] ?? 'bullet',
                // items: the key of a text field printed in italics under the total
                'note_key' => $field['note_key'] ?? null,
            ])
            ->keyBy('key')
            ->all();
    }

    /**
     * A fresh set of values for a new letter: every field at its default.
     *
     * A checklist keeps its documents in their own table, so its default
     * lines seed those rows instead of sitting in the values.
     *
     * @return array<string, mixed>
     */
    public function defaultValues(): array
    {
        return collect($this->fieldDefinitions())
            ->map(fn (array $field) => match ($field['type']) {
                'checklist' => null,
                'items' => $field['default'] ?? [],
                default => $field['default'],
            })
            ->all();
    }

    /** @return array<int, string> */
    public function checklistKeys(): array
    {
        return collect($this->fieldDefinitions())->where('type', 'checklist')->keys()->all();
    }

    /**
     * Who signs this kind of letter, in print order. Only the label lives on
     * the template — "Manajer", "Direktur" — and each letter picks the person.
     *
     * @return array<int, array{label: string}>
     */
    public function signerSlots(): array
    {
        $slots = collect($this->signers ?? [])
            ->map(fn ($slot) => ['label' => trim((string) (is_array($slot) ? ($slot['label'] ?? '') : $slot))])
            ->filter(fn (array $slot) => $slot['label'] !== '')
            ->values()
            ->all();

        return $slots === [] ? self::DEFAULT_SLOTS : $slots;
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? $this->category;
    }

    /**
     * Whether the wording prints a placeholder anywhere, so a blank the
     * template actually uses can be required before the letter issues.
     */
    public function uses(string $placeholder): bool
    {
        return preg_match('/\{\{\s*'.preg_quote($placeholder, '/').'\s*\}\}/i', $this->body.' '.$this->recipient) === 1;
    }

    /**
     * Copies the built-in wording back over this template.
     */
    public function restoreDefault(): bool
    {
        $default = collect(self::defaults())->firstWhere('code', $this->code);

        if ($default === null) {
            return false;
        }

        $this->fill($default)->save();

        return true;
    }

    /**
     * Writes any built-in template that is missing, and returns how many were.
     */
    public static function seedDefaults(): int
    {
        $written = 0;

        foreach (self::defaults() as $i => $template) {
            $existing = self::query()->where('code', $template['code'])->exists();

            if (! $existing) {
                self::create($template + ['sort_order' => $i + 1, 'is_active' => true]);
                $written++;
            }
        }

        return $written;
    }

    /**
     * The templates the office starts with, in the words of its own letters.
     *
     * Paragraphs are separated by a blank line. A line beginning "- " is a
     * bullet, **bold** is bold, and a paragraph that is only a {{field}} of
     * type list or items renders as that block.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function defaults(): array
    {
        return [
            [
                'code' => 'penawaran-jasa',
                'name' => 'Surat Penawaran Jasa',
                'description' => 'Penawaran layanan perpajakan kepada calon client: rincian jasa dan biaya, total beserta terbilang, catatan, dan kontak.',
                'category' => 'surat',
                'number_prefix' => 'PEN',
                'subject' => 'Penawaran Jasa Layanan Perpajakan',
                'recipient' => 'Pimpinan {{klien_kapital}}',
                // The offer is the proposal: issuing it moves the lead there.
                'stage_on_issue' => 'proposal',
                'signers' => [['label' => 'Direktur']],
                'checklist_as_attachment' => false,
                'fields' => [
                    [
                        'key' => 'sapaan',
                        'label' => 'Sapaan untuk client',
                        'type' => 'select',
                        'required' => true,
                        'options' => ['Bapak' => 'Bapak', 'Ibu' => 'Ibu', 'Bapak/Ibu' => 'Bapak/Ibu'],
                        'default' => 'Bapak/Ibu',
                    ],
                    [
                        'key' => 'layanan',
                        'label' => 'Rincian jasa dan biaya',
                        'type' => 'items',
                        'required' => true,
                        'help' => 'Satu bagian per jenis jasa (A, B, C). Setiap bagian punya tabel keterangan dan biayanya sendiri; totalnya dihitung dari semua baris.',
                        'note_key' => 'keterangan_biaya',
                        'default' => [
                            [
                                'title' => 'Pendampingan SP2DK',
                                'rows' => [
                                    ['name' => 'Pendampingan SP2DK', 'amount' => 10_000_000],
                                ],
                            ],
                        ],
                    ],
                    [
                        'key' => 'keterangan_biaya',
                        'label' => 'Keterangan di bawah total',
                        'type' => 'text',
                        'required' => false,
                        'default' => '(Biaya sudah mencakup seluruh layanan di atas, tanpa biaya tambahan)',
                    ],
                    [
                        'key' => 'catatan',
                        'label' => 'Catatan',
                        'type' => 'list',
                        'required' => false,
                        'style' => 'bullet',
                        'help' => 'Satu butir per baris.',
                        'default' => "Jasa diberikan berdasarkan kesepakatan / persetujuan atas penawaran yang diberikan dan dengan mekanisme pembayaran sesuai invoice resmi.\nSeluruh komunikasi, data, dan dokumen dijamin kerahasiaannya.",
                    ],
                ],
                'body' => <<<'TXT'
Dengan hormat,

Kami dari **{{perusahaan_legal}}** menawarkan jasa perpajakan untuk membantu **{{sapaan}} {{klien}}** mengelola kewajiban pajak secara profesional dan sesuai ketentuan yang berlaku.

Kami menawarkan jasa sebagai berikut:

{{layanan}}

**Catatan:**

{{catatan}}

Untuk informasi lebih lanjut atau pembahasan kebutuhan, silakan hubungi kami di {{email_marketing}} / {{telepon}}.

Demikian penawaran ini kami sampaikan. Kami berharap dapat bermitra dalam pengelolaan pajak **{{sapaan}} {{klien}}**.
TXT,
            ],
            ...self::taxTemplates(),
        ];
    }

    /**
     * The tax team's letters, moved over from the project-management app with
     * their wording intact. A letter to the tax office names that office as
     * its addressee; a berita acara is addressed to nobody.
     *
     * @return array<int, array<string, mixed>>
     */
    private static function taxTemplates(): array
    {
        $manajer = ['label' => 'Manajer'];
        $direktur = ['label' => 'Direktur'];
        // A berita acara that names this field prints the client's own signature column.
        $pihakKlien = self::field('pihak_klien', 'Nama & jabatan wakil klien', 'text', true, ['placeholder' => 'mis. Budi Santoso, Direktur']);

        return [
            [
                'code' => 'surat-permintaan-dokumen',
                'name' => 'Surat Permintaan Dokumen kepada Klien',
                'description' => 'Meminta data/dokumen pendukung dari klien dengan tenggat yang tegas. Daftar dokumen dicetak sebagai lampiran.',
                'category' => 'surat',
                'number_prefix' => 'S',
                'subject' => 'Permintaan Data dan Dokumen',
                'recipient' => 'Bapak/Ibu Pimpinan {{klien}}',
                'stage_on_issue' => null,
                'signers' => [$manajer],
                'checklist_as_attachment' => true,
                'fields' => [
                    self::field('keperluan', 'Keperluan / dasar permintaan', 'text', true, ['placeholder' => 'mis. tindak lanjut SP2DK Nomor S-445/P2DK/KPP.1410/2026 Tahun Pajak 2024']),
                    self::field('tujuan_penggunaan', 'Data akan digunakan untuk', 'text', true, ['placeholder' => 'mis. penyusunan Laporan Keuangan Tahun 2024 dan surat tanggapan atas SP2DK', 'default' => 'penyusunan laporan keuangan dan surat tanggapan']),
                    self::field('daftar_dokumen', 'Dokumen yang diminta', 'checklist', true, ['help' => 'Dicetak sebagai tabel di halaman Lampiran I. Keterangan per dokumen mengisi kolom "Rincian yang Diminta".']),
                    self::field('kanal_pengiriman', 'Kirim dokumen ke', 'text', true, ['default' => 'WhatsApp (+62-811-8000-9787)']),
                    self::field('tenggat', 'Tenggat penyerahan', 'date'),
                ],
                'body' => <<<'TXT'
Dengan hormat,

Sehubungan dengan {{keperluan}}, bersama ini kami mengajukan permohonan bantuan penyampaian data dan/atau dokumen pendukung sebagaimana tercantum dalam lampiran surat ini.

Data dan/atau dokumen tersebut hanya akan kami gunakan sebagai dasar {{tujuan_penggunaan}}, dan kami menjamin kerahasiaannya sesuai standar profesi konsultan pajak serta ketentuan perpajakan yang berlaku.

Mohon kelengkapan dokumen dikirimkan ke {{kanal_pengiriman}} paling lambat {{tenggat}}. Jika terdapat kendala dalam pengumpulan dokumen, silakan hubungi kami agar dapat dibantu.

Demikian surat permintaan data ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.
TXT,
            ],
            [
                'code' => 'surat-tanggapan-sp2dk',
                'name' => 'Surat Tanggapan SP2DK',
                'description' => 'Surat pengantar tanggapan atas SP2DK beserta lampiran kertas kerja.',
                'category' => 'surat',
                'number_prefix' => 'S',
                'subject' => 'Tanggapan atas SP2DK',
                'recipient' => '{{kpp}}',
                'stage_on_issue' => null,
                'signers' => [$manajer, $direktur],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('nomor_sp2dk', 'Nomor SP2DK'),
                    self::field('tanggal_sp2dk', 'Tanggal SP2DK', 'date'),
                    self::field('kpp', 'Ditujukan kepada (KPP)', 'text', true, ['placeholder' => 'mis. KPP Pratama Samarinda Ulu']),
                    self::field('pokok_tanggapan', 'Pokok tanggapan', 'textarea', true, ['default' => 'Setelah menelaah data yang Bapak/Ibu sampaikan, dapat kami jelaskan sebagai berikut …']),
                    self::field('lampiran', 'Lampiran', 'list', true, ['style' => 'number', 'default' => "Lembar analisis kasus\nKertas kerja ekualisasi\nRekapitulasi faktur"]),
                ],
                'body' => <<<'TXT'
Dengan hormat,

Menunjuk Surat Permintaan Penjelasan atas Data dan/atau Keterangan Nomor {{nomor_sp2dk}} tanggal {{tanggal_sp2dk}} yang ditujukan kepada {{klien}}, bersama ini kami selaku kuasa Wajib Pajak menyampaikan penjelasan sebagai berikut:

{{pokok_tanggapan}}

Sebagai kelengkapan, kami lampirkan:

{{lampiran}}

Demikian penjelasan ini kami sampaikan. Apabila diperlukan pembahasan lebih lanjut, kami siap hadir sesuai jadwal yang Bapak/Ibu tentukan.
TXT,
            ],
            [
                'code' => 'surat-tanggapan-sphp',
                'name' => 'Surat Tanggapan SPHP',
                'description' => 'Tanggapan tertulis atas Surat Pemberitahuan Hasil Pemeriksaan (maks 5 hari kerja).',
                'category' => 'surat',
                'number_prefix' => 'S',
                'subject' => 'Tanggapan atas Surat Pemberitahuan Hasil Pemeriksaan',
                'recipient' => '{{kpp}}',
                'stage_on_issue' => null,
                'signers' => [$manajer, $direktur],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('nomor_sphp', 'Nomor SPHP'),
                    self::field('tanggal_sphp', 'Tanggal SPHP', 'date'),
                    self::field('kpp', 'Ditujukan kepada (KPP)', 'text', true, ['placeholder' => 'mis. KPP Pratama Samarinda Ulu']),
                    self::field('pokok_setuju', 'Koreksi yang disetujui', 'textarea', false),
                    self::field('pokok_tidak_setuju', 'Koreksi yang tidak disetujui beserta alasannya', 'textarea'),
                    self::field('lampiran', 'Lampiran', 'list', false, ['style' => 'number']),
                ],
                'body' => <<<'TXT'
Dengan hormat,

Sehubungan dengan Surat Pemberitahuan Hasil Pemeriksaan Nomor {{nomor_sphp}} tanggal {{tanggal_sphp}} atas {{klien}}, bersama ini kami selaku kuasa Wajib Pajak menyampaikan tanggapan tertulis dalam batas waktu yang ditentukan.

Koreksi yang kami setujui:

{{pokok_setuju}}

Koreksi yang tidak kami setujui beserta alasannya:

{{pokok_tidak_setuju}}

Lampiran:

{{lampiran}}

Kami mohon tanggapan ini menjadi bahan pertimbangan dalam pembahasan akhir hasil pemeriksaan.
TXT,
            ],
            [
                'code' => 'surat-permohonan-qa',
                'name' => 'Surat Permohonan Pembahasan Quality Assurance',
                'description' => 'Permohonan tertulis ke Tim QA, maksimal 3 hari kerja sejak Risalah Pembahasan ditandatangani.',
                'category' => 'surat',
                'number_prefix' => 'S',
                'subject' => 'Permohonan Pembahasan Quality Assurance',
                'recipient' => 'Tim Quality Assurance Pemeriksaan {{kanwil}}',
                'stage_on_issue' => null,
                'signers' => [$manajer, $direktur],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('kanwil', 'Ditujukan kepada (Kanwil DJP)'),
                    self::field('nomor_risalah', 'Nomor Risalah Pembahasan'),
                    self::field('tanggal_risalah', 'Tanggal Risalah Pembahasan', 'date'),
                    self::field('pokok_perbedaan', 'Pokok perbedaan pendapat', 'textarea'),
                    self::field('dasar_hukum', 'Dasar hukum yang diajukan', 'textarea'),
                ],
                'body' => <<<'TXT'
Dengan hormat,

Menunjuk Risalah Pembahasan Akhir Hasil Pemeriksaan Nomor {{nomor_risalah}} tanggal {{tanggal_risalah}} atas {{klien}}, dengan ini kami mengajukan permohonan pembahasan dengan Tim Quality Assurance Pemeriksaan atas perbedaan pendapat yang belum disepakati, yaitu:

{{pokok_perbedaan}}

Dasar hukum yang kami ajukan:

{{dasar_hukum}}

Permohonan ini kami sampaikan dalam jangka waktu 3 (tiga) hari kerja sejak Risalah Pembahasan ditandatangani. Kami bersedia hadir pada waktu yang ditetapkan.
TXT,
            ],
            [
                'code' => 'surat-pernyataan-klien',
                'name' => 'Surat Pernyataan Klien atas Kebenaran Data',
                'description' => 'Klien menyatakan data yang diserahkan benar dan lengkap. Perlindungan dasar bagi kantor.',
                'category' => 'surat',
                'number_prefix' => 'S',
                'subject' => 'Pernyataan Kebenaran Data',
                'recipient' => null,
                'stage_on_issue' => null,
                'signers' => [$manajer],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('nama_penandatangan', 'Nama penandatangan dari klien'),
                    self::field('jabatan_penandatangan', 'Jabatan'),
                    self::field('periode', 'Periode data', 'text', true, ['placeholder' => 'mis. Januari–Desember 2025']),
                    self::field('daftar_data', 'Data yang diserahkan', 'list', true, ['style' => 'number']),
                ],
                'body' => <<<'TXT'
Yang bertanda tangan di bawah ini, {{nama_penandatangan}}, selaku {{jabatan_penandatangan}} dari {{klien}}, dengan ini menyatakan bahwa data dan dokumen berikut untuk periode {{periode}} yang kami serahkan kepada {{perusahaan}} adalah benar, lengkap, dan sesuai dengan keadaan yang sebenarnya:

{{daftar_data}}

Kami memahami bahwa {{perusahaan}} menyusun pekerjaannya berdasarkan data tersebut, dan segala akibat yang timbul dari ketidakbenaran atau ketidaklengkapan data menjadi tanggung jawab kami.

Pernyataan ini dibuat dengan sebenarnya tanpa paksaan dari pihak mana pun.
TXT,
            ],
            [
                'code' => 'pemberitahuan-kode-billing',
                'name' => 'Pemberitahuan Kode Billing & Tenggat Setor',
                'description' => 'Mengirim kode billing beserta batas setor dan lapor kepada klien.',
                'category' => 'pemberitahuan',
                'number_prefix' => 'S',
                'subject' => 'Pemberitahuan Kode Billing dan Batas Setor',
                'recipient' => 'Bapak/Ibu Pimpinan {{klien}}',
                'stage_on_issue' => null,
                'signers' => [$manajer],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('jenis_pajak', 'Jenis pajak', 'text', true, ['placeholder' => 'mis. PPh Pasal 21']),
                    self::field('masa_pajak', 'Masa pajak', 'text', true, ['placeholder' => 'mis. Agustus 2026']),
                    self::field('kode_billing', 'Kode billing'),
                    self::field('jumlah', 'Jumlah yang harus disetor', 'currency', true, ['placeholder' => '12.500.000']),
                    self::field('batas_setor', 'Batas waktu setor', 'date'),
                    self::field('batas_lapor', 'Batas waktu lapor', 'date'),
                ],
                'body' => <<<'TXT'
Dengan hormat,

Bersama ini kami sampaikan kode billing untuk pembayaran {{jenis_pajak}} masa {{masa_pajak}} atas nama {{klien}}:

- Kode billing: {{kode_billing}}
- Jumlah: {{jumlah}}
- Batas waktu setor: {{batas_setor}}
- Batas waktu lapor: {{batas_lapor}}

Mohon pembayaran dilakukan sebelum batas waktu setor dan bukti setor dikirimkan kepada kami agar pelaporan dapat kami selesaikan tepat waktu. Keterlambatan setor dikenai sanksi bunga sesuai ketentuan yang berlaku.
TXT,
            ],
            [
                'code' => 'pengingat-pertama',
                'name' => 'Pengingat Pertama — Kelengkapan Data',
                'description' => 'Mengingatkan klien atas data yang belum lengkap, memuat daftar yang sudah diterima dan yang masih ditunggu.',
                'category' => 'pengingat',
                'number_prefix' => 'S',
                'subject' => 'Pengingat Kelengkapan Data',
                'recipient' => 'Bapak/Ibu Pimpinan {{klien}}',
                'stage_on_issue' => null,
                'signers' => [$manajer],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('keperluan', 'Keperluan', 'text', true, ['placeholder' => 'mis. penyusunan SPT Tahunan 2025']),
                    self::field('daftar_diterima', 'Data yang sudah diterima', 'list', false, ['style' => 'number']),
                    self::field('daftar_ditunggu', 'Data yang masih ditunggu', 'list', true, ['style' => 'number']),
                    self::field('tenggat', 'Tenggat penyerahan', 'date'),
                ],
                'body' => <<<'TXT'
Dengan hormat,

Menindaklanjuti permintaan data untuk {{keperluan}}, kami sampaikan status kelengkapan data {{klien}} per {{tanggal_surat}}.

Data yang sudah kami terima:

{{daftar_diterima}}

Data yang masih kami tunggu:

{{daftar_ditunggu}}

Mohon data tersebut dapat kami terima paling lambat {{tenggat}} agar pekerjaan dapat berjalan sesuai jadwal. Terima kasih atas kerja samanya.
TXT,
            ],
            [
                'code' => 'pengingat-kedua',
                'name' => 'Pengingat Kedua — Batas Akhir Data',
                'description' => 'Pengingat terakhir sebelum data difinalkan; menegaskan konsekuensi dan tenggat dari KPP.',
                'category' => 'pengingat',
                'number_prefix' => 'S',
                'subject' => 'Pengingat Kedua: Batas Akhir Penyerahan Data',
                'recipient' => 'Bapak/Ibu Pimpinan {{klien}}',
                'stage_on_issue' => null,
                'signers' => [$manajer, $direktur],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('keperluan', 'Keperluan'),
                    self::field('daftar_ditunggu', 'Data yang masih ditunggu', 'list', true, ['style' => 'number']),
                    self::field('tenggat_akhir', 'Batas akhir dari kami', 'date'),
                    self::field('tenggat_kpp', 'Tenggat kewajiban (KPP)', 'date'),
                    self::field('konsekuensi', 'Konsekuensi bila data tidak diterima', 'textarea', true, ['default' => 'Pekerjaan akan kami finalkan berdasarkan data yang sudah tersedia, dan risiko sanksi keterlambatan atau ketidaklengkapan pelaporan menjadi tanggung jawab klien.']),
                ],
                'body' => <<<'TXT'
Dengan hormat,

Ini adalah pengingat kedua dan terakhir atas data {{klien}} untuk {{keperluan}} yang hingga {{tanggal_surat}} belum kami terima:

{{daftar_ditunggu}}

Batas akhir penyerahan data kepada kami adalah {{tenggat_akhir}}, mengingat tenggat kewajiban dari KPP jatuh pada {{tenggat_kpp}}.

Apabila sampai batas akhir tersebut data belum kami terima:

{{konsekuensi}}

Kami berharap kerja sama Bapak/Ibu agar kewajiban perpajakan dapat dipenuhi tepat waktu.
TXT,
            ],
            [
                'code' => 'ba-serah-terima-dokumen',
                'name' => 'Berita Acara Serah Terima Dokumen',
                'description' => 'Mencatat dokumen yang diterima dari atau diserahkan kepada klien.',
                'category' => 'berita_acara',
                'number_prefix' => 'BA',
                'subject' => 'Berita Acara Serah Terima Dokumen',
                'recipient' => null,
                'stage_on_issue' => null,
                'signers' => [$manajer],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('arah', 'Arah serah terima', 'select', true, ['options' => ['diterima' => 'Diterima dari klien', 'diserahkan' => 'Diserahkan kepada klien'], 'default' => 'diterima']),
                    self::field('tanggal_serah_terima', 'Tanggal serah terima', 'date'),
                    self::field('daftar_dokumen', 'Daftar dokumen', 'list', true, ['style' => 'number']),
                    $pihakKlien,
                    self::field('catatan', 'Catatan', 'textarea', false),
                ],
                'body' => <<<'TXT'
Pada hari ini, {{tanggal_serah_terima}}, telah dilakukan serah terima dokumen antara {{perusahaan}} dan {{klien}} yang diwakili oleh {{pihak_klien}}, dengan status: {{arah}}.

Dokumen yang diserahterimakan:

{{daftar_dokumen}}

{{catatan}}

Dokumen di atas diterima dalam keadaan lengkap dan baik. Berita acara ini dibuat dalam rangkap dua dan ditandatangani oleh kedua belah pihak.
TXT,
            ],
            [
                'code' => 'ba-pembahasan-klien',
                'name' => 'Berita Acara Pembahasan dengan Klien',
                'description' => 'Mencatat pokok pembahasan, kesepakatan, dan tindak lanjut.',
                'category' => 'berita_acara',
                'number_prefix' => 'BA',
                'subject' => 'Berita Acara Pembahasan',
                'recipient' => null,
                'stage_on_issue' => null,
                'signers' => [$manajer],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('tanggal_pembahasan', 'Tanggal pembahasan', 'date'),
                    self::field('tempat', 'Tempat / media', 'text', true, ['placeholder' => 'mis. Kantor klien / Zoom']),
                    self::field('peserta', 'Peserta', 'list', true, ['style' => 'number']),
                    self::field('pokok_pembahasan', 'Pokok pembahasan', 'list', true, ['style' => 'number']),
                    self::field('kesepakatan', 'Kesepakatan', 'list', true, ['style' => 'number']),
                    self::field('tindak_lanjut', 'Tindak lanjut & penanggung jawab', 'list', true, ['style' => 'number']),
                ],
                'body' => <<<'TXT'
Pada {{tanggal_pembahasan}} bertempat di {{tempat}}, telah dilaksanakan pembahasan antara {{perusahaan}} dan {{klien}} dengan peserta:

{{peserta}}

Pokok pembahasan:

{{pokok_pembahasan}}

Kesepakatan:

{{kesepakatan}}

Tindak lanjut:

{{tindak_lanjut}}

Demikian berita acara ini dibuat untuk menjadi rujukan bersama.
TXT,
            ],
            [
                'code' => 'ba-pendapat-profesional',
                'name' => 'Berita Acara Penyampaian Pendapat Profesional',
                'description' => 'Dipakai ketika klien memilih perlakuan pajak yang berbeda dari rekomendasi kantor. Mencatat rekomendasi kantor, pilihan klien, dan pemisahan tanggung jawab. Ditandatangani Direktur.',
                'category' => 'berita_acara',
                'number_prefix' => 'BA',
                'subject' => 'Berita Acara Penyampaian Pendapat Profesional',
                'recipient' => null,
                'stage_on_issue' => null,
                'signers' => [$manajer, $direktur],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('pokok_masalah', 'Pokok masalah / transaksi', 'textarea'),
                    self::field('rekomendasi_kantor', 'Rekomendasi kantor beserta dasar hukumnya', 'textarea'),
                    self::field('pilihan_klien', 'Perlakuan yang dipilih klien', 'textarea'),
                    self::field('risiko', 'Risiko yang telah dijelaskan kepada klien', 'textarea'),
                    $pihakKlien,
                ],
                'body' => <<<'TXT'
Berita acara ini dibuat untuk mencatat penyampaian pendapat profesional {{perusahaan}} kepada {{klien}} yang diwakili oleh {{pihak_klien}}, atas hal berikut:

{{pokok_masalah}}

Rekomendasi kantor:

{{rekomendasi_kantor}}

Perlakuan yang dipilih klien:

{{pilihan_klien}}

Risiko yang telah dijelaskan kepada klien:

{{risiko}}

Dengan ditandatanganinya berita acara ini, klien menyatakan telah memahami rekomendasi dan risiko di atas, dan memilih perlakuan tersebut atas pertimbangannya sendiri. Segala akibat perpajakan yang timbul dari pilihan tersebut menjadi tanggung jawab klien, sedangkan {{perusahaan}} telah melaksanakan kewajiban profesionalnya dengan menyampaikan pendapat ini secara tertulis.
TXT,
            ],
            [
                'code' => 'ba-serah-terima-laporan',
                'name' => 'Berita Acara Serah Terima Laporan',
                'description' => 'Penutup penugasan: menyerahkan hasil pekerjaan kepada klien.',
                'category' => 'berita_acara',
                'number_prefix' => 'BA',
                'subject' => 'Berita Acara Serah Terima Laporan',
                'recipient' => null,
                'stage_on_issue' => null,
                'signers' => [$manajer, $direktur],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('tanggal_serah_terima', 'Tanggal serah terima', 'date'),
                    self::field('periode', 'Periode / tahun pajak', 'text', true, ['placeholder' => 'mis. Tahun Pajak 2025']),
                    self::field('daftar_hasil', 'Hasil pekerjaan yang diserahkan', 'list', true, ['style' => 'number']),
                    $pihakKlien,
                ],
                'body' => <<<'TXT'
Pada {{tanggal_serah_terima}}, {{perusahaan}} telah menyerahkan kepada {{klien}} yang diwakili oleh {{pihak_klien}} hasil pekerjaan {{proyek}} untuk {{periode}} berupa:

{{daftar_hasil}}

Dengan serah terima ini, penugasan dinyatakan selesai. Klien telah memeriksa dan menerima hasil pekerjaan di atas. Dokumen sumber yang dipinjam selama penugasan dikembalikan bersamaan dengan berita acara ini.
TXT,
            ],
            [
                'code' => 'ba-finalisasi-data',
                'name' => 'Berita Acara Finalisasi Data',
                'description' => 'Menutup tahap pengumpulan data: mencatat apa yang diterima, apa yang tidak tersedia, dan atas dasar apa pekerjaan dilanjutkan.',
                'category' => 'berita_acara',
                'number_prefix' => 'BA',
                'subject' => 'Berita Acara Finalisasi Data',
                'recipient' => null,
                'stage_on_issue' => null,
                'signers' => [$manajer, $direktur],
                'checklist_as_attachment' => false,
                'fields' => [
                    self::field('tanggal_finalisasi', 'Tanggal finalisasi', 'date'),
                    self::field('keperluan', 'Keperluan'),
                    self::field('daftar_diterima', 'Data yang diterima', 'list', true, ['style' => 'number']),
                    self::field('daftar_tidak_tersedia', 'Data yang tidak tersedia', 'list', false, ['style' => 'number']),
                    self::field('dasar_lanjut', 'Dasar pekerjaan dilanjutkan', 'textarea'),
                    $pihakKlien,
                ],
                'body' => <<<'TXT'
Pada {{tanggal_finalisasi}}, {{perusahaan}} dan {{klien}} yang diwakili oleh {{pihak_klien}} sepakat menutup tahap pengumpulan data untuk {{keperluan}} dengan rincian berikut.

Data yang diterima:

{{daftar_diterima}}

Data yang tidak tersedia:

{{daftar_tidak_tersedia}}

Pekerjaan dilanjutkan atas dasar:

{{dasar_lanjut}}

Data yang masuk setelah tanggal ini tidak lagi menjadi bagian dari pekerjaan, kecuali disepakati lain secara tertulis.
TXT,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private static function field(string $key, string $label, string $type = 'text', bool $required = true, array $extra = []): array
    {
        return ['key' => $key, 'label' => $label, 'type' => $type, 'required' => $required] + $extra;
    }

    public function activityType(): string
    {
        return 'template-surat';
    }

    public function activityLabel(): string
    {
        return (string) $this->name;
    }

    public function activityUrl(): ?string
    {
        return route('letters.templates.edit', $this, false);
    }

    /** The wording is long prose; the log says it changed, the page shows how. */
    public function activityIgnores(): array
    {
        return ['fields', 'signers', 'sort_order'];
    }

    public function activityFieldLabels(): array
    {
        return [
            ...$this->sharedFieldLabels(),
            'number_prefix' => 'Awalan nomor',
            'category' => 'Kategori',
            'checklist_as_attachment' => 'Daftar dokumen sebagai lampiran',
            'subject' => 'Perihal',
            'recipient' => 'Tujuan',
            'stage_on_issue' => 'Tahap setelah terbit',
            'body' => 'Isi surat',
            'description' => 'Keterangan',
            'is_active' => 'Aktif',
        ];
    }
}
