<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class InstagramPost extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'likes' => 'integer',
            'comments' => 'integer',
            'video_views' => 'integer',
            'video_plays' => 'integer',
            'video_duration' => 'integer',
            'hashtags' => 'array',
            'mentions' => 'array',
            'tagged_users' => 'array',
            'music' => 'array',
            'payload' => 'array',
            'slides' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'is_pinned' => 'boolean',
            'paid_partnership' => 'boolean',
            'comments_disabled' => 'boolean',
            'posted_at' => 'datetime',
            'fetched_at' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(InstagramProfile::class, 'instagram_profile_id');
    }

    /** A Reel is a video posted as clips; everything else is grid content. */
    public function isReel(): bool
    {
        return $this->product_type === 'clips';
    }

    /** What the team calls this kind of post. */
    public function format(): string
    {
        return match (true) {
            $this->isReel() => 'reel',
            $this->type === 'Video' => 'video',
            $this->type === 'Sidecar' => 'carousel',
            default => 'foto',
        };
    }

    /**
     * The only interaction Instagram lets a public scrape see.
     *
     * Saves and shares are not in the data, so this is deliberately named for
     * what it counts rather than called "engagement" outright.
     */
    public function interactions(): int
    {
        return $this->likes + $this->comments;
    }

    /** Portrait, square or landscape — the shape the grid should reserve. */
    public function aspect(): string
    {
        if (! $this->width || ! $this->height) {
            return 'square';
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
     * On Instagram that audience is the followers: a post is shown to the
     * people who follow the account, so measuring against them is measuring
     * against everyone who had the chance.
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
        return $followers;
    }

    public function rateNoun(): string
    {
        return 'pengikut';
    }

    /*
     |------------------------------------------------------------------
     | The words both platforms answer to
     |------------------------------------------------------------------
     | Instagram and TikTok are stored apart because they are counted in
     | different currencies, but the screens read one shape. These are the
     | names that shape is assembled from, so the statistics never have to
     | ask which account they are looking at.
     */

    public function key(): string
    {
        return $this->short_code;
    }

    /** The track, in the one shape the panel reads. */
    public function track(): ?array
    {
        return $this->music ? [
            'song' => $this->music['song_name'] ?? null,
            'artist' => $this->music['artist_name'] ?? null,
        ] : null;
    }

    public function thumb(): ?string
    {
        return $this->thumbnailUrl();
    }

    public function plays(): ?int
    {
        return $this->video_plays;
    }

    public function views(): ?int
    {
        return $this->video_views;
    }

    /** Instagram's public scrape reports neither. */
    public function shares(): ?int
    {
        return null;
    }

    public function saves(): ?int
    {
        return null;
    }

    public function slideCount(): int
    {
        return $this->slides ?? 1;
    }

    public function seconds(): ?int
    {
        return $this->video_duration;
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

    public function thumbnailUrl(): ?string
    {
        return $this->thumbnail_path
            ? Storage::disk('public')->url($this->thumbnail_path)
            : null;
    }
}
