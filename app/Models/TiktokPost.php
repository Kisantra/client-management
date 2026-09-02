<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class TiktokPost extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'likes' => 'integer',
            'comments' => 'integer',
            'plays' => 'integer',
            'shares' => 'integer',
            'saves' => 'integer',
            'duration' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'hashtags' => 'array',
            'mentions' => 'array',
            'music' => 'array',
            'payload' => 'array',
            'is_slideshow' => 'boolean',
            'is_pinned' => 'boolean',
            'is_ad' => 'boolean',
            'posted_at' => 'datetime',
            'fetched_at' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(TiktokProfile::class, 'tiktok_profile_id');
    }

    /** What the team calls this kind of post. */
    public function format(): string
    {
        return $this->is_slideshow ? 'slideshow' : 'video';
    }

    /**
     * Everything a viewer chose to do about it.
     *
     * TikTok reports four, where Instagram's public scrape reports two. A save
     * belongs in here rather than beside it: for tax advice, keeping a video to
     * come back to is the strongest thing a viewer can do short of asking.
     */
    public function interactions(): int
    {
        return $this->likes + $this->comments + $this->shares + $this->saves;
    }

    /** Portrait, square or landscape — the shape the grid should reserve. */
    public function aspect(): string
    {
        if (! $this->width || ! $this->height) {
            /* A slideshow reports no dimensions; TikTok is portrait by nature. */
            return 'portrait';
        }

        $ratio = $this->width / $this->height;

        return match (true) {
            $ratio < 0.9 => 'portrait',
            $ratio > 1.1 => 'landscape',
            default => 'square',
        };
    }

    /**
     * Interactions against the audience that could have given them.
     *
     * On TikTok that is the people who watched, not the people who follow.
     * The For You page shows a video to strangers by the hundred thousand:
     * this account has 1.644 followers and one video with 296.700 plays, and
     * measuring 17.913 interactions against the followers returns 1.089% — a
     * number that is arithmetically true and says nothing anyone can use.
     * Against the plays it is 6%, which is the figure the rest of the world
     * means by engagement rate on TikTok.
     *
     * Followers stand in only when a video has no plays on record at all,
     * because a rate of nothing over nothing is not an improvement.
     */
    public function engagementRate(int $followers): float
    {
        $basis = $this->rateBasis($followers);

        return $basis > 0
            ? round(($this->interactions() / $basis) * 100, 3)
            : 0.0;
    }

    public function rateBasis(int $followers): int
    {
        return $this->plays > 0 ? $this->plays : $followers;
    }

    public function rateNoun(): string
    {
        return 'pemutaran';
    }

    /*
     |------------------------------------------------------------------
     | The words both platforms answer to
     |------------------------------------------------------------------
     | See InstagramPost: the two are stored apart and read as one.
     */

    public function key(): string
    {
        return $this->post_id;
    }

    /** The track, in the one shape the panel reads. */
    public function track(): ?array
    {
        return $this->music ? [
            'song' => $this->music['song'] ?? null,
            'artist' => $this->music['artist'] ?? null,
        ] : null;
    }

    public function thumb(): ?string
    {
        return $this->coverUrl();
    }

    public function plays(): ?int
    {
        return $this->plays;
    }

    /** TikTok reports plays, and does not separate reach from them. */
    public function views(): ?int
    {
        return null;
    }

    public function shares(): ?int
    {
        return $this->shares;
    }

    public function saves(): ?int
    {
        return $this->saves;
    }

    /** A slideshow's slide count is not in the payload; one stands for all. */
    public function slideCount(): int
    {
        return 1;
    }

    public function seconds(): ?int
    {
        return $this->duration;
    }

    /**
     * The video, if this post has one and somebody has fetched it.
     *
     * Two answers, deliberately separate: `videoSource()` is the link the
     * platform served, which expires; `videoUrl()` is this app's own copy,
     * which does not. A post can have the first and not the second, which is
     * exactly the state the panel offers to fix.
     */
    public function videoSource(): ?string
    {
        return $this->video_url ?: null;
    }

    public function videoUrl(): ?string
    {
        return $this->video_path
            ? Storage::disk('public')->url($this->video_path)
            : null;
    }

    public function coverUrl(): ?string
    {
        return $this->cover_path
            ? Storage::disk('public')->url($this->cover_path)
            : null;
    }
}
