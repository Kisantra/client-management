<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One morning's brief: what the day is about, and what can be made from it.
 *
 * Written by `news:sync` out of the pipeline's own sheet. The team reads this
 * before the news log — it is three topics and a handful of ideas instead of
 * thirty headlines, and its links go to the publisher rather than through a
 * redirect.
 */
class NewsBrief extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'topics' => 'array',
            'extras' => 'array',
        ];
    }

    /** @return HasMany<BriefIdea, $this> */
    public function ideas(): HasMany
    {
        return $this->hasMany(BriefIdea::class)->orderBy('position');
    }

    /**
     * What the archive rail shows for this brief.
     *
     * A date on its own is a bare figure. The day's leading topic is the
     * counterweight that makes the archive scannable as subjects rather than
     * as a column of dates.
     */
    public function lead(): ?string
    {
        return $this->topics[0]['title'] ?? $this->ideas->first()?->title;
    }

    /** @return array<string, mixed> */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'publishedAt' => $this->published_at->toDateTimeString(),
            'lead' => $this->lead(),
            'topics' => array_values($this->topics ?? []),
            'extras' => array_values($this->extras ?? []),
            'ideas' => $this->ideas->map(fn (BriefIdea $idea) => $idea->toRow())->all(),
        ];
    }
}
