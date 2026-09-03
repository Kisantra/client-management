<?php

namespace App\Models;

use App\Support\NewsSheet;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A story worth knowing about: a regulation, an announcement, an issue the
 * audience is asking about. Raw material for the calendar, not part of it.
 *
 * Filled by `news:sync` from the team's pipeline sheet, which is why the same
 * story can arrive more than once: the fingerprint of its headline, not its
 * link, is what says it has been seen before.
 */
class NewsItem extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    /**
     * The window the Berita page promises, when it promises one.
     *
     * By default it does not: the page shows every 9 and 10 in the sheet. If a
     * window is configured, a story somebody turned into an idea still stays
     * in the table past it — the idea points back at it — but stops appearing
     * on a page that would then be claiming to show only recent news.
     */
    #[Scope]
    protected function recent(Builder $query): void
    {
        $since = NewsSheet::make()->since();

        $query->when($since, fn (Builder $q) => $q->where('published_at', '>=', $since));
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
            'category' => $this->category ?: null,
            'url' => $this->url ?: null,
            'summary' => $this->summary ?: null,
            'publishedAt' => $this->published_at->toDateString(),
            'ideaId' => $this->content_idea_id,
        ];
    }
}
