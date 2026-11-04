<?php

namespace App\Models;

use App\Models\Concerns\RecordsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * Someone who signs letters for the office, and the signature they sign with.
 *
 * Kept apart from user accounts on purpose: the director signs every offer
 * without ever opening this app. The image lives on the local disk, never
 * the public one, so a signature cannot be lifted off a guessable URL; the
 * preview embeds it and the PDF reads it from the file.
 *
 * A replaced image is stored under a new name and the old file is kept,
 * because a letter issued last month froze the path it was signed with.
 *
 * @property int $id
 * @property string $name
 * @property string $title
 * @property string|null $signature_path
 * @property bool $is_default
 * @property bool $is_active
 * @property int $sort_order
 */
class LetterSigner extends Model
{
    use RecordsActivity {
        activityFieldLabels as sharedFieldLabels;
    }

    public const DISK = 'local';

    public const DIR = 'signatures';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    public function hasSignature(): bool
    {
        return self::fileFor($this->signature_path) !== null;
    }

    /**
     * Where a stored signature image is on disk, or null when it is gone.
     */
    public static function fileFor(?string $path): ?string
    {
        if (blank($path) || ! Storage::disk(self::DISK)->exists($path)) {
            return null;
        }

        return Storage::disk(self::DISK)->path($path);
    }

    /**
     * The image as a data URI, for the on-screen page. The browser cannot be
     * pointed at the file itself, and a route per image would only re-serve
     * the same bytes through a second request.
     */
    public static function dataUriFor(?string $path): ?string
    {
        $file = self::fileFor($path);

        if ($file === null) {
            return null;
        }

        $mime = mime_content_type($file) ?: 'image/png';

        return 'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($file));
    }

    /**
     * Who a new letter starts with in each slot: whoever carries the slot's
     * title, nobody twice, the office default first when several carry it.
     * A slot no one's title matches stays empty for the writer to choose —
     * a director in the manager's column is a wrong letter, not a
     * convenient one.
     *
     * @param  array<int, array{label: string}>  $slots
     * @return array<int, int|null>
     */
    public static function defaultsFor(array $slots): array
    {
        $signers = self::query()->active()->orderByDesc('is_default')->ordered()->get();
        $taken = [];

        return collect($slots)
            ->values()
            ->map(function (array $slot) use ($signers, &$taken) {
                $label = mb_strtolower(trim($slot['label']));
                $free = $signers->reject(fn (self $signer) => in_array($signer->id, $taken, true));

                $match = $free->first(fn (self $signer) => mb_strtolower(trim($signer->title)) === $label)
                    ?? $free->first(fn (self $signer) => $label !== '' && str_contains(mb_strtolower($signer->title), $label));

                if ($match !== null) {
                    $taken[] = $match->id;
                }

                return $match?->id;
            })
            ->all();
    }

    public function activityType(): string
    {
        return 'penanda-tangan';
    }

    public function activityLabel(): string
    {
        return trim($this->name.' · '.$this->title);
    }

    public function activityUrl(): ?string
    {
        return route('letters.settings', absolute: false);
    }

    public function activityIgnores(): array
    {
        return ['sort_order'];
    }

    public function activityFieldLabels(): array
    {
        return [
            ...$this->sharedFieldLabels(),
            'title' => 'Jabatan',
            'signature_path' => 'Tanda tangan',
            'is_default' => 'Bawaan',
            'is_active' => 'Aktif',
        ];
    }
}
