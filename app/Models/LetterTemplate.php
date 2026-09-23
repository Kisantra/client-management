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
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property string $number_prefix
 * @property string $subject
 * @property string $recipient
 * @property string|null $stage_on_issue
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
    ];

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
     * @return array<string, mixed>
     */
    public function defaultValues(): array
    {
        return collect($this->fieldDefinitions())
            ->map(fn (array $field) => $field['default'] ?? ($field['type'] === 'items' ? [] : null))
            ->all();
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
                'number_prefix' => 'PEN',
                'subject' => 'Penawaran Jasa Layanan Perpajakan',
                'recipient' => 'Pimpinan {{klien_kapital}}',
                // The offer is the proposal: issuing it moves the lead there.
                'stage_on_issue' => 'proposal',
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
        ];
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
        return ['fields', 'sort_order'];
    }

    public function activityFieldLabels(): array
    {
        return [
            ...$this->sharedFieldLabels(),
            'number_prefix' => 'Awalan nomor',
            'subject' => 'Perihal',
            'recipient' => 'Tujuan',
            'stage_on_issue' => 'Tahap setelah terbit',
            'body' => 'Isi surat',
            'description' => 'Keterangan',
            'is_active' => 'Aktif',
        ];
    }
}
