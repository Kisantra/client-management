<?php

namespace App\Models;

use App\Support\Pipeline;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Lead extends Model
{
    /** Still being worked. */
    public const ACTIVE = 'aktif';

    /** Stopped: not won, and no longer expected to move. */
    public const CLOSED = 'tidak_lanjut';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'entered_at' => 'date',
            'stage_changed_at' => 'date',
            'last_contact_at' => 'date',
            'stalled_at' => 'date',
            'closed_at' => 'date',
            'value' => 'integer',
            'office_lat' => 'float',
            'office_lng' => 'float',
        ];
    }

    /**
     * Keep the stalled date in step with the stage.
     *
     * Nothing else may write it: a stage move and its tolerance always travel
     * together, so the column cannot drift away from config/pipeline.php.
     */
    protected static function booted(): void
    {
        static::saving(function (Lead $lead) {
            $changed = $lead->stage_changed_at instanceof Carbon
                ? $lead->stage_changed_at
                : Carbon::parse($lead->stage_changed_at);

            $lead->stalled_at = $changed->copy()->addDays(Pipeline::threshold($lead->stage));
        });
    }

    /**
     * The published piece this lead came in from, when it is on the calendar.
     *
     * @return BelongsTo<Content, $this>
     */
    public function content(): BelongsTo
    {
        return $this->belongsTo(Content::class);
    }

    public function stageEvents(): HasMany
    {
        return $this->hasMany(LeadStageEvent::class)->orderBy('entered_at')->orderBy('id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(LeadNote::class)->latest('created_at')->latest('id');
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(LeadFollowUp::class)->orderBy('scheduled_for');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(LeadAttachment::class);
    }

    /** Full display name, e.g. "PT Sinar Rejeki". */
    public function displayName(): string
    {
        return trim($this->entity.' '.$this->company);
    }

    /** The tolerance for this lead's current stage, in days. */
    public function threshold(): int
    {
        return Pipeline::threshold($this->stage);
    }

    /**
     * How long the lead has stood in its current stage.
     *
     * A closed lead stops counting on the day it closed: nobody is ignoring it
     * any more, so the number is a final duration rather than a growing debt.
     */
    public function daysInStage(): int
    {
        $until = $this->closed_at ?? Carbon::today();

        return (int) $this->stage_changed_at->startOfDay()->diffInDays($until);
    }

    public function daysSinceEntry(): int
    {
        return (int) $this->entered_at->startOfDay()->diffInDays(Carbon::today());
    }

    public function daysSinceContact(): int
    {
        return (int) ($this->last_contact_at ?? $this->entered_at)
            ->startOfDay()
            ->diffInDays(Carbon::today());
    }

    public function isClosed(): bool
    {
        return $this->status === self::CLOSED;
    }

    /** Only a lead someone is still meant to be working can be stalled. */
    public function isStalled(): bool
    {
        return ! $this->isClosed() && $this->stalled_at->startOfDay()->lt(Carbon::today());
    }

    public function scopeStalled(Builder $query): Builder
    {
        return $query->active()->whereDate('stalled_at', '<', Carbon::today());
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::ACTIVE);
    }

    public function scopeClosed(Builder $query): Builder
    {
        return $query->where('status', self::CLOSED);
    }

    /**
     * The row shape every list, board and card reads.
     *
     * Days and stalled are computed here rather than in the browser, so the
     * table, the board and the dashboard cannot disagree about the same lead.
     */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'company' => $this->displayName(),
            'pic' => $this->pic,
            'stage' => $this->stage,
            'channel' => $this->channel,
            'source' => $this->source ?: 'Tidak dicatat',
            'service' => $this->service,
            'value' => $this->value,
            'daysInStage' => $this->daysInStage(),
            'daysSinceContact' => $this->daysSinceContact(),
            'daysSinceEntry' => $this->daysSinceEntry(),
            'entryAt' => $this->entered_at->toDateString(),
            'threshold' => $this->threshold(),
            'stalled' => $this->isStalled(),
            'status' => $this->status,
            'closedReason' => Pipeline::closeReasonLabel($this->closed_reason),
            'closedAt' => $this->closed_at?->toDateString(),
        ];
    }
}
