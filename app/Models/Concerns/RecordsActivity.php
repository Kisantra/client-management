<?php

namespace App\Models\Concerns;

use App\Models\Activity;
use BackedEnum;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Puts a model in the activity log.
 *
 * A model opts in by using the trait and saying three things about itself:
 * what kind of thing it is (`activityType`), what to call this particular one
 * (`activityLabel`), and where to go to see it (`activityUrl`). Everything
 * else — which fields are worth naming, how a date or a list reads in a
 * sentence, when to stay quiet — is the same for every model and lives here.
 *
 * The scraped tables deliberately do not use it. Instagram and TikTok rows
 * arrive by the hundred from an importer with nobody signed in, and burying
 * one person's edit under three hundred machine writes is how a log becomes
 * something the team stops opening.
 */
trait RecordsActivity
{
    public static function bootRecordsActivity(): void
    {
        static::created(fn (Model $model) => $model->writeActivity(Activity::CREATED));
        static::updated(fn (Model $model) => $model->writeActivity(Activity::UPDATED));
        static::deleted(fn (Model $model) => $model->writeActivity(Activity::DELETED));
    }

    /** The word the log uses for this kind of record. Also its filter value. */
    abstract public function activityType(): string;

    /** This record, named the way a person would name it. */
    abstract public function activityLabel(): string;

    /** Where the entry links to, or null when there is nowhere to send anyone. */
    public function activityUrl(): ?string
    {
        return null;
    }

    /**
     * Fields this model would rather not see in the log, on top of the ones
     * nothing may log. Derived columns mostly: dates the app keeps in step by
     * itself and that nobody set by hand.
     *
     * @return array<int, string>
     */
    public function activityIgnores(): array
    {
        return [];
    }

    /**
     * What each field is called in a sentence.
     *
     * Column names leak otherwise — "scheduled_for berubah" is a schema
     * talking to itself. Names are shared across models because the schema
     * uses them consistently; a model with its own word for something adds it
     * by overriding.
     *
     * @return array<string, string>
     */
    public function activityFieldLabels(): array
    {
        return [
            'title' => 'Judul',
            'company' => 'Nama perusahaan',
            'entity' => 'Badan usaha',
            'pic' => 'PIC',
            'pic_role' => 'Jabatan PIC',
            'phone' => 'Telepon',
            'email' => 'Email',
            'npwp' => 'NPWP',
            'address' => 'Alamat',
            'city' => 'Kota',
            'channel' => 'Channel',
            'channels' => 'Channel',
            'source' => 'Asal',
            'service' => 'Layanan',
            'value' => 'Estimasi nilai',
            'stage' => 'Tahap',
            'status' => 'Status',
            'owner' => 'Penanggung jawab',
            'author' => 'Penulis',
            'note' => 'Catatan',
            'brief' => 'Brief',
            'caption' => 'Caption',
            'body' => 'Isi',
            'pillar' => 'Pilar',
            'type' => 'Jenis',
            'url' => 'Tautan',
            'reference_url' => 'Referensi',
            'source_url' => 'Sumber',
            'scheduled_for' => 'Tanggal tayang',
            'scheduled_time' => 'Jam tayang',
            'published_at' => 'Tanggal publish',
            'entered_at' => 'Tanggal masuk',
            'last_contact_at' => 'Kontak terakhir',
            'closed_at' => 'Tanggal ditutup',
            'date' => 'Tanggal',
            'done' => 'Selesai',
            'confirmed' => 'Dikonfirmasi',
            'resolved_at' => 'Diselesaikan',
            'name' => 'Nama',
            'role' => 'Peran',
            'content_id' => 'Konten',
            'lead_id' => 'Lead',
        ];
    }

    /** Writes this model's entry for one event. */
    protected function writeActivity(string $action): void
    {
        Activity::record(
            action: $action,
            subjectType: $this->activityType(),
            subjectId: $this->getKey(),
            subjectLabel: Str::limit(trim($this->activityLabel()) ?: 'Tanpa nama', 80),
            changes: $action === Activity::UPDATED ? $this->activityChanges() : null,
            url: $this->activityUrl(),
        );
    }

    /**
     * The fields that moved, each with where it moved from and to.
     *
     * Read during the `updated` event, which is the one moment both halves are
     * on the model at once: `getChanges` holds what the save wrote and
     * `getOriginal` still holds what was there before it.
     *
     * @return array<int, array{field: string, label: string, from: ?string, to: ?string}>
     */
    protected function activityChanges(): array
    {
        $skip = array_merge(Activity::NEVER, $this->activityIgnores());
        $labels = $this->activityFieldLabels();
        $changes = [];

        foreach ($this->getChanges() as $field => $to) {
            if (in_array($field, $skip, true)) {
                continue;
            }

            $from = $this->getOriginal($field);

            /* Eloquent reports a change when a date is rewritten in a
               different format but means the same day. Comparing the words
               the log would print keeps those out of it. */
            $before = $this->activityValue($field, $from);
            $after = $this->activityValue($field, $to);

            if ($before === $after) {
                continue;
            }

            $changes[] = [
                'field' => $field,
                'label' => $labels[$field] ?? Str::headline($field),
                'from' => $before,
                'to' => $after,
            ];
        }

        return $changes;
    }

    /** One value, as it should read in a sentence. */
    protected function activityValue(string $field, mixed $value): ?string
    {
        if ($value instanceof BackedEnum) {
            $value = $value->value;
        }

        if ($value === null || $value === '' || $value === []) {
            return null;
        }

        if (is_bool($value)) {
            return $value ? 'Ya' : 'Tidak';
        }

        if (is_array($value)) {
            return implode(', ', $value);
        }

        $cast = $this->getCasts()[$field] ?? null;

        if ($cast === 'array' || $cast === 'json') {
            $decoded = is_string($value) ? json_decode($value, true) : $value;

            return is_array($decoded) ? implode(', ', $decoded) : (string) $value;
        }

        if ($cast && str_starts_with((string) $cast, 'date')) {
            return Activity::shortDate(Carbon::parse($value));
        }

        if ($cast === 'datetime') {
            return Activity::shortDate(Carbon::parse($value)).', '.Carbon::parse($value)->format('H.i');
        }

        if ($cast === 'boolean') {
            return $value ? 'Ya' : 'Tidak';
        }

        /*
         | A clock time held as a plain string, which the schema does for
         | scheduled_time. Normalising it does two jobs: it prints the hour the
         | way the rest of the app writes one, and it stops "12:00:00" and
         | "12:00" — the same minute, written by two different forms — from
         | posting a change nobody made.
         */
        if (is_string($value) && preg_match('/^(\d{1,2}):(\d{2})(:\d{2})?$/', trim($value), $clock) === 1) {
            return str_pad($clock[1], 2, '0', STR_PAD_LEFT).'.'.$clock[2];
        }

        if (is_int($value) || is_float($value)) {
            return number_format((float) $value, 0, ',', '.');
        }

        /* Long prose is a change you can see happened, not one you read in a
           list. The full text is in the record itself. */
        return Str::limit(trim((string) $value), 90);
    }
}
