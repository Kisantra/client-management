<?php

namespace App\Models;

use App\Models\Concerns\RecordsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadFollowUp extends Model
{
    use RecordsActivity;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'scheduled_for' => 'date',
            'done' => 'boolean',
        ];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function activityType(): string
    {
        return 'follow-up';
    }

    public function activityLabel(): string
    {
        return (string) $this->note;
    }

    public function activityUrl(): ?string
    {
        return $this->lead_id
            ? route('leads.show', $this->lead_id, false)
            : null;
    }
}
