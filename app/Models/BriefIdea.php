<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One idea out of one morning's brief: a headline, why it works, and the
 * article it came from.
 *
 * It is a row rather than a field on the brief because somebody presses it:
 * an idea sent to the backlog has to remember that it went, or the team sends
 * the same one twice on the same morning.
 */
class BriefIdea extends Model
{
    protected $guarded = [];

    /** @return BelongsTo<NewsBrief, $this> */
    public function brief(): BelongsTo
    {
        return $this->belongsTo(NewsBrief::class, 'news_brief_id');
    }

    /** The backlog entry somebody turned this into, once they did. */
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
            'body' => $this->body ?: null,
            'url' => $this->url ?: null,
            'ideaId' => $this->content_idea_id,
        ];
    }
}
