<?php

namespace App\Models;

use App\Jobs\SyncHandoff;
use App\Support\ProjectManagement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * A signed client handed over to Project Management, and how far it got.
 *
 * The lead decides what should be true over there — signed means Project
 * Management should have the client, not signed means the deal is off — and
 * App\Jobs\SyncHandoff makes it so. This row only remembers the outcome.
 *
 * @property int $id
 * @property int $lead_id
 * @property string $status
 * @property int|null $pm_client_id
 * @property string|null $pm_client_url
 * @property bool $matched
 * @property string|null $pm_project_name
 * @property string|null $pm_project_url
 * @property int $attempts
 * @property string|null $error
 * @property Carbon|null $sent_at
 * @property Carbon|null $completed_at
 * @property string|null $completed_by
 * @property Carbon|null $withdrawn_at
 * @property-read Lead $lead
 */
class Handoff extends Model
{
    /** Waiting for the queue to talk to Project Management. */
    public const QUEUED = 'antre';

    /** Project Management has it and the tax team is checking it. */
    public const SENT = 'terkirim';

    /** The tax team made the client and its project. */
    public const COMPLETED = 'lengkap';

    /** The deal came off and Project Management was told. */
    public const WITHDRAWN = 'batal';

    /** The last attempt did not get through. */
    public const FAILED = 'gagal';

    /** How many times the queue tries before it waits for a person. */
    public const TRIES = 3;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'matched' => 'boolean',
            'attempts' => 'integer',
            'sent_at' => 'datetime',
            'completed_at' => 'datetime',
            'withdrawn_at' => 'datetime',
        ];
    }

    /**
     * Called when a lead becomes signed or stops being signed.
     *
     * A deal that never reached Project Management has nothing to call off
     * there, so un-signing a lead with no handoff is not news.
     */
    public static function follow(Lead $lead): void
    {
        if (! ProjectManagement::enabled()) {
            return;
        }

        if (! $lead->isSigned() && ! $lead->handoff()->exists()) {
            return;
        }

        self::queue($lead);
    }

    /**
     * Marks the lead as waiting and queues the sync once the surrounding
     * transaction lands, so the job never reads a stage move that rolled back.
     */
    public static function queue(Lead $lead): self
    {
        $handoff = self::updateOrCreate(
            ['lead_id' => $lead->id],
            ['status' => self::QUEUED, 'attempts' => 0, 'error' => null],
        );

        DB::afterCommit(fn () => SyncHandoff::dispatch($lead->id));

        return $handoff;
    }

    /** @return BelongsTo<Lead, $this> */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    /** Out of automatic tries, so only the button sends it again. */
    public function exhausted(): bool
    {
        return $this->status === self::FAILED && $this->attempts >= self::TRIES;
    }

    /**
     * The shape the lead page renders its Project Management panel from.
     *
     * @return array<string, mixed>
     */
    public function toPanel(): array
    {
        return [
            'status' => $this->status,
            'matched' => $this->matched,
            'clientUrl' => $this->pm_client_url,
            'projectName' => $this->pm_project_name,
            'projectUrl' => $this->pm_project_url,
            'sentAt' => $this->sent_at?->toIso8601String(),
            'completedAt' => $this->completed_at?->toIso8601String(),
            'completedBy' => $this->completed_by,
            'withdrawnAt' => $this->withdrawn_at?->toIso8601String(),
            'error' => $this->error,
            'attempts' => $this->attempts,
            'exhausted' => $this->exhausted(),
        ];
    }
}
