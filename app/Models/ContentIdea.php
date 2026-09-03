<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A piece the team might make one day, written down before it is forgotten.
 *
 * An idea has no date and no status: those arrive the moment it is scheduled,
 * when it becomes a Content and this record points at it.
 */
class ContentIdea extends Model
{
    protected $guarded = [];

    /** The piece this idea became, once it did. */
    public function content(): BelongsTo
    {
        return $this->belongsTo(Content::class);
    }

    /**
     * Still waiting to be made.
     *
     * @param  Builder<ContentIdea>  $query
     * @return Builder<ContentIdea>
     */
    public function scopeFresh(Builder $query): Builder
    {
        return $query->whereNull('content_id');
    }

    /** @return array<string, mixed> */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'channel' => $this->channel ?: null,
            'note' => $this->note ?: null,
            'sourceUrl' => $this->source_url ?: null,
            'author' => $this->author ?: null,
            'createdAt' => $this->created_at->toDateString(),
            'content' => $this->relationLoaded('content') && $this->content
                ? [
                    'id' => $this->content->id,
                    'title' => $this->content->title,
                    'status' => $this->content->status,
                    'scheduledFor' => $this->content->scheduled_for->toDateString(),
                ]
                : null,
        ];
    }
}
