<?php

namespace App\Models;

use App\Models\Concerns\RecordsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

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
 * The signers are chosen per letter from the office's list and their
 * signatures print as soon as they are chosen; there is no approval round.
 * While the letter is a draft the list follows the signer records, so a new
 * signature image shows at once; issuing freezes name, title and image.
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
 * @property string|null $recipient
 * @property string|null $project
 * @property array<string, mixed> $values
 * @property array<int, array{label?: string, signer_id?: int|null, name?: string|null, title?: string|null, image?: string|null}>|null $signers
 * @property string $status
 * @property string|null $rendered_html
 * @property Carbon|null $issued_at
 * @property-read LetterTemplate $template
 * @property-read Lead $lead
 * @property-read User|null $creator
 * @property-read Collection<int, LetterRequestedDocument> $requestedDocuments
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
            'signers' => 'array',
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

    /** @return HasMany<LetterRequestedDocument, $this> */
    public function requestedDocuments(): HasMany
    {
        return $this->hasMany(LetterRequestedDocument::class)->orderBy('order')->orderBy('id');
    }

    /**
     * The documents asked for under one checklist field, in order.
     *
     * @return Collection<int, LetterRequestedDocument>
     */
    public function checklist(string $fieldKey): Collection
    {
        return $this->requestedDocuments->where('field_key', $fieldKey)->values();
    }

    /**
     * Who signs, one entry per slot of the template, ready to print.
     *
     * A draft reads each chosen signer's current record; an issued letter
     * prints what was frozen when it went out, even if the signer has since
     * changed title or image.
     *
     * @return array<int, array{label: string, signerId: int|null, name: string|null, title: string|null, image: string|null}>
     */
    public function signatureBlocks(): array
    {
        $stored = array_values($this->signers ?? []);
        $slots = $this->isDraft() || $stored === []
            ? $this->template->signerSlots()
            : array_map(fn ($entry) => ['label' => (string) ($entry['label'] ?? '')], $stored);

        $live = $this->isDraft()
            ? LetterSigner::query()->whereKey(array_filter(array_column($stored, 'signer_id')))->get()->keyBy('id')
            : collect();

        return collect($slots)
            ->values()
            ->map(function (array $slot, int $i) use ($stored, $live) {
                $entry = $stored[$i] ?? [];
                $id = isset($entry['signer_id']) ? (int) $entry['signer_id'] : null;
                $signer = $id ? $live->get($id) : null;

                return [
                    'label' => $slot['label'],
                    'signerId' => $id,
                    'name' => $signer->name ?? ($entry['name'] ?? null),
                    'title' => $signer->title ?? ($entry['title'] ?? null),
                    'image' => $signer->signature_path ?? ($entry['image'] ?? null),
                ];
            })
            ->all();
    }

    /**
     * A fresh draft of a template for a lead, with the template's default
     * wording, its default signers, and any document checklist it carries.
     *
     * Shared by the letter form and the lead form's "buat penawaran" shortcut,
     * so a draft looks the same whichever door it came through.
     */
    public static function draft(LetterTemplate $template, Lead $lead, User $by): self
    {
        $letter = self::create([
            'letter_template_id' => $template->id,
            'lead_id' => $lead->id,
            'created_by' => $by->id,
            'letter_date' => Carbon::today(),
            'subject' => $template->subject,
            'recipient' => $template->recipient,
            'values' => $template->defaultValues(),
            'signers' => self::signerSnapshot($template, LetterSigner::defaultsFor($template->signerSlots())),
            'status' => self::DRAFT,
        ]);

        $letter->seedChecklists($template);

        return $letter;
    }

    /**
     * A checklist starts from its default lines, each matched to the master
     * list where the name is the same, so a new request letter opens with
     * the documents the office usually asks for already on it.
     */
    private function seedChecklists(LetterTemplate $template): void
    {
        foreach ($template->fieldDefinitions() as $key => $field) {
            if ($field['type'] !== 'checklist' || blank($field['default'])) {
                continue;
            }

            $names = collect(preg_split('/\R/', (string) $field['default']) ?: [])
                ->map(fn ($line) => trim((string) preg_replace('/^\s*(\d+[.)]|[-*•])\s*/', '', $line)))
                ->filter()
                ->unique()
                ->values();

            $types = RequestedDocumentType::query()->active()->whereIn('name', $names)->pluck('id', 'name');

            foreach ($names as $i => $name) {
                $this->requestedDocuments()->create([
                    'field_key' => $key,
                    'requested_document_type_id' => $types[$name] ?? null,
                    'name' => $name,
                    'order' => $i + 1,
                ]);
            }
        }
    }

    /**
     * The signer list as stored: each slot's chosen signer with their name,
     * title and image copied in, so the record reads on its own.
     *
     * @param  array<int, int|null>  $signerIds  by slot index
     * @return array<int, array{label: string, signer_id: int|null, name: string|null, title: string|null, image: string|null}>
     */
    public static function signerSnapshot(LetterTemplate $template, array $signerIds): array
    {
        $signers = LetterSigner::query()->whereKey(array_filter($signerIds))->get()->keyBy('id');

        return collect($template->signerSlots())
            ->values()
            ->map(function (array $slot, int $i) use ($signerIds, $signers) {
                $signer = isset($signerIds[$i]) ? $signers->get((int) $signerIds[$i]) : null;

                return [
                    'label' => $slot['label'],
                    'signer_id' => $signer?->id,
                    'name' => $signer?->name,
                    'title' => $signer?->title,
                    'image' => $signer?->signature_path,
                ];
            })
            ->all();
    }

    /**
     * The signer list in its stored shape, read through signatureBlocks()
     * so each chosen signer's current record is what gets frozen.
     *
     * @return array<int, array{label: string, signer_id: int|null, name: string|null, title: string|null, image: string|null}>
     */
    public function frozenSigners(): array
    {
        return array_map(fn (array $block) => [
            'label' => $block['label'],
            'signer_id' => $block['signerId'],
            'name' => $block['name'],
            'title' => $block['title'],
            'image' => $block['image'],
        ], $this->signatureBlocks());
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
            'project' => $this->project,
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
        return ['values', 'rendered_html', 'subject', 'recipient', 'project', 'signers', 'letter_date', 'issued_at', 'sequence', 'year'];
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
