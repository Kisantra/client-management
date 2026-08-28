<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class LeadAttachment extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function note(): BelongsTo
    {
        return $this->belongsTo(LeadNote::class, 'lead_note_id');
    }

    public function url(): string
    {
        return Storage::disk('public')->url($this->path);
    }
}
