<?php

namespace App\Models;

use App\Models\Concerns\RecordsActivity;
use App\Support\Pipeline;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

class Lead extends Model
{
    use RecordsActivity;

    /** Still being worked. */
    public const ACTIVE = 'aktif';

    /** Stopped: not won, and no longer expected to move. */
    public const CLOSED = 'tidak_lanjut';

    /** The stages where the client has signed and Project Management takes over. */
    public const SIGNED = ['deal', 'client'];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'entered_at' => 'date',
            'stage_changed_at' => 'date',
            'last_contact_at' => 'date',
            'stalled_at' => 'date',
            'closed_at' => 'date',
            'contract_start' => 'date',
            'contract_ends_at' => 'date',
            'value' => 'integer',
            'contract_months' => 'integer',
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

            // A twelve-month contract from 1 January runs through 31 December.
            $lead->contract_ends_at = $lead->contract_months && $lead->contract_start
                ? Carbon::parse($lead->contract_start)->addMonthsNoOverflow($lead->contract_months)->subDay()
                : null;
        });

        /*
         | Signing and un-signing are what Project Management hears about.
         | The stage dialog, the edit form, an issued letter, closing and
         | reopening all end in a save, so this is the one place that notices
         | instead of five that each have to remember. `updated` still has the
         | old values in getOriginal(), which is what makes the comparison.
         */
        static::created(function (Lead $lead) {
            if ($lead->isSigned()) {
                Handoff::follow($lead);
            }
        });

        static::updated(function (Lead $lead) {
            $was = $lead->getOriginal('status') !== self::CLOSED
                && in_array($lead->getOriginal('stage'), self::SIGNED, true);

            if ($was !== $lead->isSigned()) {
                Handoff::follow($lead);
            }
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

    /** @return HasMany<LeadAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(LeadAttachment::class);
    }

    public function letters(): HasMany
    {
        return $this->hasMany(Letter::class);
    }

    /** @return HasOne<Handoff, $this> */
    public function handoff(): HasOne
    {
        return $this->hasOne(Handoff::class);
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

    /** Signed and still on: the client Project Management should be holding. */
    public function isSigned(): bool
    {
        return ! $this->isClosed() && in_array($this->stage, self::SIGNED, true);
    }

    /**
     * The contract term, or null for a client engaged on the spot.
     *
     * @return array{months: int, start: string, end: string, daysLeft: int}|null
     */
    public function contract(): ?array
    {
        if ($this->contract_ends_at === null) {
            return null;
        }

        return [
            'months' => $this->contract_months,
            'start' => $this->contract_start->toDateString(),
            'end' => $this->contract_ends_at->toDateString(),
            // Negative once the term has run out.
            'daysLeft' => (int) Carbon::today()->diffInDays($this->contract_ends_at, false),
        ];
    }

    /**
     * Why this lead may not be deleted, or null when it may.
     *
     * A numbered letter is on the register for good, and deleting the lead
     * would take the letter with it. A client Project Management is holding
     * would be left there with nobody on this side to call it off. Reads the
     * `letters_numbered_exists` and `handoff` the caller loaded.
     */
    public function deletionBlocker(): ?string
    {
        if ($this->letters_numbered_exists) {
            return 'Punya surat bernomor, yang harus tetap tercatat.';
        }

        $handoff = $this->handoff;

        if ($handoff !== null && $handoff->status !== Handoff::WITHDRAWN && $handoff->sent_at !== null) {
            return 'Sudah diserahkan ke Project Management.';
        }

        return null;
    }

    /** @param  Builder<Lead>  $query */
    public function scopeWithDeletionFacts(Builder $query): Builder
    {
        return $query
            ->with('handoff')
            ->withExists(['letters as letters_numbered_exists' => fn (Builder $letters) => $letters->whereNotNull('number')]);
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

    public function activityType(): string
    {
        return 'lead';
    }

    public function activityLabel(): string
    {
        return trim($this->entity.' '.$this->company);
    }

    public function activityUrl(): ?string
    {
        return route('leads.show', $this, false);
    }

    /** Dates the pipeline keeps in step by itself; nobody typed these. */
    public function activityIgnores(): array
    {
        return ['stage_changed_at', 'stalled_at', 'contract_ends_at'];
    }
}
