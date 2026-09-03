<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A story worth knowing about: a regulation, an announcement, an issue the
 * audience is asking about. Raw material for the calendar, not part of it.
 */
class NewsItem extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'published_at' => 'date',
        ];
    }

    /** The idea somebody turned this story into, once they did. */
    public function idea(): BelongsTo
    {
        return $this->belongsTo(ContentIdea::class, 'content_idea_id');
    }

    /** @return array<string, mixed> */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'source' => $this->source,
            'url' => $this->url ?: null,
            'summary' => $this->summary ?: null,
            'publishedAt' => $this->published_at->toDateString(),
            'ideaId' => $this->content_idea_id,
        ];
    }
}
