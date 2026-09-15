<?php

namespace App\Models;

use App\Support\ContentPlan;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Where one piece of content went live on one channel.
 *
 * The same cut posted to Instagram and TikTok is one piece of work with two
 * addresses, and each of those addresses leads to a different set of figures.
 * Keeping them apart is what lets Performa say how the same piece did on each
 * platform rather than on whichever one somebody happened to paste.
 */
class ContentLink extends Model
{
    protected $guarded = [];

    /** @return BelongsTo<Content, $this> */
    public function content(): BelongsTo
    {
        return $this->belongsTo(Content::class);
    }

    public function channelLabel(): string
    {
        return ContentPlan::channelLabel($this->channel);
    }
}
