<?php

namespace App\Models;

use App\Support\ContentPlan;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One piece of content on the team's calendar, from draft to live.
 *
 * The chain this product exists for runs through here: a lead records which
 * piece brought it in, so a piece can say how many leads it produced and how
 * many of those became clients.
 */
class Content extends Model
{
    public const PUBLISHED = 'published';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'scheduled_for' => 'date',
            'published_at' => 'date',
            'status_changed_at' => 'date',
        ];
    }

    /**
     * Leads that came in from this piece.
     *
     * @return HasMany<Lead, $this>
     */
    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class);
    }

    /** @return HasMany<ContentStatusEvent, $this> */
    public function statusEvents(): HasMany
    {
        return $this->hasMany(ContentStatusEvent::class)->orderBy('at')->orderBy('id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::PUBLISHED;
    }

    /** Past its date and still not live. */
    public function isLate(): bool
    {
        return ! $this->isPublished() && $this->scheduled_for->startOfDay()->lt(Carbon::today());
    }

    public function daysLate(): int
    {
        return $this->isLate()
            ? (int) $this->scheduled_for->startOfDay()->diffInDays(Carbon::today())
            : 0;
    }

    /**
     * How long the piece has stood in its current status. A published piece
     * stops counting on the day it went live: nothing is waiting any more.
     */
    public function daysInStatus(): int
    {
        $until = $this->isPublished() ? ($this->published_at ?? Carbon::today()) : Carbon::today();

        return max((int) $this->status_changed_at->startOfDay()->diffInDays($until), 0);
    }

    /** Sitting in a status longer than config/content.php tolerates. */
    public function isStuck(): bool
    {
        $limit = ContentPlan::stuckAfter($this->status);

        return $limit !== null && $this->daysInStatus() > $limit;
    }

    /**
     * @param  Builder<Content>  $query
     * @return Builder<Content>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', self::PUBLISHED);
    }

    /**
     * @param  Builder<Content>  $query
     * @return Builder<Content>
     */
    public function scopeLate(Builder $query): Builder
    {
        return $query
            ->where('status', '!=', self::PUBLISHED)
            ->whereDate('scheduled_for', '<', Carbon::today());
    }

    /**
     * The row shape the calendar, the list and the detail page all read.
     *
     * Late and stuck are decided here, from config, so no screen can disagree
     * with another about the same piece.
     *
     * @return array<string, mixed>
     */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'channel' => $this->channel,
            'format' => $this->format,
            'formatLabel' => ContentPlan::formatLabel($this->channel, $this->format),
            'status' => $this->status,
            'statusLabel' => ContentPlan::label($this->status),
            'scheduledFor' => $this->scheduled_for->toDateString(),
            'publishedAt' => $this->published_at?->toDateString(),
            'owner' => $this->owner ?: null,
            'url' => $this->url ?: null,
            'late' => $this->isLate(),
            'daysLate' => $this->daysLate(),
            'daysInStatus' => $this->daysInStatus(),
            'stuck' => $this->isStuck(),
            'stuckAfter' => ContentPlan::stuckAfter($this->status),
            // Present when the query counted them; the chain, in two numbers.
            'leads' => isset($this->leads_count) ? (int) $this->leads_count : null,
            'clients' => isset($this->clients_count) ? (int) $this->clients_count : null,
        ];
    }
}
