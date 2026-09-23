<?php

namespace App\Models;

use App\Models\Concerns\RecordsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One letter to one lead, made from a template.
 *
 * It starts as a draft the writer fills in and watches take shape on the
 * letterhead. Issuing it draws a number and freezes the words; from then on
 * the PDF is the letter. A typo after issue is fixed by pulling it back to
 * draft — the number stays, because a number once given is on record — and
 * a letter that should never have gone out is cancelled, which keeps the
 * number too so the register has no gap.
 *
 * @property int $id
 * @property int $letter_template_id
 * @property int $lead_id
 * @property int|null $created_by
 * @property string|null $number
 * @property int|null $sequence
 * @property int|null $year
 * @property Carbon $letter_date
 * @property string $subject
 * @property string $recipient
 * @property array<string, mixed> $values
 * @property string $signer_name
 * @property string $signer_title
 * @property string $status
 * @property string|null $rendered_html
 * @property Carbon|null $issued_at
 * @property-read LetterTemplate $template
 * @property-read Lead $lead
 * @property-read User|null $creator
 */
class Letter extends Model
{
    use RecordsActivity {
        activityFieldLabels as sharedFieldLabels;
        activityValue as sharedValue;
    }

    public const DRAFT = 'draft';

    public const ISSUED = 'terbit';

    public const CANCELED = 'batal';

    public const STATUS_LABELS = [
        self::DRAFT => 'Draft',
        self::ISSUED => 'Terbit',
        self::CANCELED => 'Dibatalkan',
    ];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'values' => 'array',
            'letter_date' => 'date',
            'issued_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LetterTemplate, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(LetterTemplate::class, 'letter_template_id');
    }

    /** @return BelongsTo<Lead, $this> */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeStatus(Builder $query, ?string $status): Builder
    {
        return $status ? $query->where('status', $status) : $query;
    }

    public function isDraft(): bool
    {
        return $this->status === self::DRAFT;
    }

    public function isIssued(): bool
    {
        return $this->status === self::ISSUED;
    }

    public function isCanceled(): bool
    {
        return $this->status === self::CANCELED;
    }

    /** Only a draft that never drew a number may go without trace. */
    public function canBeDeleted(): bool
    {
        return $this->isDraft() && $this->number === null;
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    /**
     * The client as a letter names them: "PT Sinar Rejeki", but a person by
     * their name alone. Nobody writes "Yth. Perorangan Marwi Sulistyarini".
     */
    public function clientName(): string
    {
        return $this->lead->entity === 'Perorangan'
            ? trim($this->lead->company)
            : $this->lead->displayName();
    }

    public function displayNumber(): string
    {
        return $this->number ?? 'Belum bernomor';
    }

    /**
     * The row every list reads.
     *
     * @return array<string, mixed>
     */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'subject' => $this->subject,
            'template' => $this->template->name,
            'client' => $this->clientName(),
            'leadId' => $this->lead_id,
            'date' => $this->letter_date->toDateString(),
            'status' => $this->status,
            'statusLabel' => $this->statusLabel(),
            'author' => $this->creator?->name,
            'issuedAt' => $this->issued_at?->toDateString(),
        ];
    }

    public function activityType(): string
    {
        return 'surat';
    }

    public function activityLabel(): string
    {
        return trim(($this->number ? $this->number.' · ' : '').$this->subject);
    }

    public function activityUrl(): ?string
    {
        return route('letters.show', $this, false);
    }

    /**
     * The draft saves itself as it is typed, so the wording is not an event;
     * what the log keeps is when a letter was issued, pulled back or cancelled.
     */
    public function activityIgnores(): array
    {
        return ['values', 'rendered_html', 'subject', 'recipient', 'signer_name', 'signer_title', 'letter_date', 'issued_at', 'sequence', 'year'];
    }

    public function activityFieldLabels(): array
    {
        return [
            ...$this->sharedFieldLabels(),
            'number' => 'Nomor',
        ];
    }

    /** Status in the log reads as the page prints it, not as the column stores it. */
    protected function activityValue(string $field, mixed $value): ?string
    {
        if ($field === 'status' && is_string($value)) {
            return self::STATUS_LABELS[$value] ?? $value;
        }

        return $this->sharedValue($field, $value);
    }
}
