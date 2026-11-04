<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A document the office commonly asks a client for.
 *
 * A letter's document list is picked from these rather than typed, so the
 * same document is called the same thing in every letter. The name is
 * copied onto the letter when picked; renaming an entry here rewrites none.
 *
 * @property int $id
 * @property string $name
 * @property string $category
 * @property string|null $description
 * @property int $sort_order
 * @property bool $is_active
 */
class RequestedDocumentType extends Model
{
    public const CATEGORIES = [
        'keuangan' => 'Keuangan',
        'perpajakan' => 'Perpajakan',
        'legal' => 'Legal & perizinan',
        'kepegawaian' => 'Kepegawaian',
        'lainnya' => 'Lainnya',
    ];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /** @return HasMany<LetterRequestedDocument, $this> */
    public function requestedDocuments(): HasMany
    {
        return $this->hasMany(LetterRequestedDocument::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('category')->orderBy('sort_order')->orderBy('name');
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? $this->category;
    }

    /**
     * The active list grouped by category, in the order the picker shows it.
     *
     * @return array<int, array{key: string, label: string, items: array<int, array{id: int, name: string, description: ?string}>}>
     */
    public static function grouped(): array
    {
        $types = self::query()->active()->ordered()->get()->groupBy('category');

        return collect(self::CATEGORIES)
            ->filter(fn (string $label, string $key) => $types->has($key))
            ->map(fn (string $label, string $key) => [
                'key' => $key,
                'label' => $label,
                'items' => $types[$key]->map(fn (self $type) => [
                    'id' => $type->id,
                    'name' => $type->name,
                    'description' => $type->description,
                ])->values()->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * Writes any starter entry that is missing and returns how many were.
     * Never touches an entry the office has since renamed or switched off.
     */
    public static function seedDefaults(): int
    {
        $written = 0;

        foreach (self::defaults() as $category => $names) {
            foreach ($names as $i => $name) {
                $type = self::query()->firstOrCreate(
                    ['name' => $name],
                    ['category' => $category, 'sort_order' => $i + 1, 'is_active' => true],
                );

                $written += $type->wasRecentlyCreated ? 1 : 0;
            }
        }

        return $written;
    }

    /**
     * The documents the tax team asks for most, by category.
     *
     * @return array<string, array<int, string>>
     */
    public static function defaults(): array
    {
        return [
            'keuangan' => [
                'Rekening koran seluruh rekening bank',
                'Laporan keuangan (neraca & laba rugi)',
                'Buku besar / general ledger',
                'Daftar aset tetap dan penyusutan',
                'Daftar piutang dan utang usaha',
                'Daftar persediaan akhir tahun',
                'Rekap penjualan bulanan',
                'Rekap pembelian bulanan',
                'Bukti pengeluaran kas / kwitansi',
                'Perjanjian pinjaman / kredit bank',
            ],
            'perpajakan' => [
                'Bukti potong PPh 21 / 1721-A1',
                'Bukti potong PPh 23',
                'Bukti potong PPh 22',
                'Bukti potong PPh 4 ayat (2)',
                'Faktur pajak keluaran',
                'Faktur pajak masukan',
                'SPT Masa PPN beserta bukti lapor',
                'SPT Masa PPh 21 beserta bukti lapor',
                'SPT Tahunan tahun sebelumnya',
                'Bukti setor pajak (NTPN) / SSP',
                'Surat Keterangan Terdaftar (SKT) / SPPKP',
                'Surat dari KPP (SP2DK, SPHP, STP, SKP)',
            ],
            'legal' => [
                'Akta pendirian dan perubahan terakhir',
                'SK Kemenkumham',
                'NIB / izin usaha (OSS)',
                'NPWP badan dan pengurus',
                'KTP pengurus dan pemegang saham',
                'Perjanjian / kontrak dengan pelanggan atau pemasok',
            ],
            'kepegawaian' => [
                'Daftar karyawan beserta gaji dan tunjangan',
                'Slip gaji / rekap payroll',
                'Bukti pembayaran BPJS Ketenagakerjaan dan Kesehatan',
                'Daftar pesangon / THR',
            ],
        ];
    }
}
