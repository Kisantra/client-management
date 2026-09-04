<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One reviewer note on a piece of content.
 *
 * The QA statuses say where a piece stands; these say why it is standing
 * there. Open until somebody acts on it and says so.
 */
class ContentComment extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Content, $this> */
    public function content(): BelongsTo
    {
        return $this->belongsTo(Content::class);
    }

    public function isResolved(): bool
    {
        return $this->resolved_at !== null;
    }

    /** @return array<string, mixed> */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'author' => $this->author,
            'body' => $this->body,
            // The full moment, not just the day: reviews move within hours.
            'at' => $this->created_at->toIso8601String(),
            'resolved' => $this->isResolved(),
            'resolvedBy' => $this->resolved_by,
        ];
    }
}
