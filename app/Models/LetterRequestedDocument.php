<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One document a letter asks the client for.
 *
 * Added and removed only while the letter is a draft, because the list is
 * part of what the letter says. Marked received at any time after, because
 * that is the team keeping track of what has actually arrived — it changes
 * nothing on the page that was sent.
 *
 * @property int $id
 * @property int $letter_id
 * @property string $field_key
 * @property int|null $requested_document_type_id
 * @property string $name
 * @property string|null $note
 * @property int $order
 * @property Carbon|null $received_at
 * @property int|null $received_by
 * @property-read RequestedDocumentType|null $type
 * @property-read User|null $receiver
 */
class LetterRequestedDocument extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Letter, $this> */
    public function letter(): BelongsTo
    {
        return $this->belongsTo(Letter::class);
    }

    /** The master entry this was picked from; null for one typed by hand. */
    public function type(): BelongsTo
    {
        return $this->belongsTo(RequestedDocumentType::class, 'requested_document_type_id');
    }

    /** @return BelongsTo<User, $this> */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function isReceived(): bool
    {
        return $this->received_at !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toItem(): array
    {
        return [
            'id' => $this->id,
            'field' => $this->field_key,
            'typeId' => $this->requested_document_type_id,
            'name' => $this->name,
            'note' => $this->note,
            'description' => $this->type?->description,
            'receivedAt' => $this->received_at?->toDateString(),
            'receivedBy' => $this->receiver?->name,
        ];
    }
}
