<?php

namespace App\Models;

use App\Models\Concerns\RecordsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeadNote extends Model
{
    use RecordsActivity;

    protected $guarded = [];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(LeadAttachment::class);
    }

    public function activityType(): string
    {
        return 'catatan';
    }

    public function activityLabel(): string
    {
        return (string) $this->body;
    }

    public function activityUrl(): ?string
    {
        return $this->lead_id
            ? route('leads.show', $this->lead_id, false)
            : null;
    }
}
