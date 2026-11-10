<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadAttachment extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    /** @return BelongsTo<Lead, $this> */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function note(): BelongsTo
    {
        return $this->belongsTo(LeadNote::class, 'lead_note_id');
    }

    /** Where a signed-in person opens it. */
    public function url(): string
    {
        return route('leads.attachments.show', [$this->lead_id, $this->id]);
    }
}
