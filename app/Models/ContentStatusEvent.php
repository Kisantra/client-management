<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One move in a piece's production flow: which status, when, by whom. */
class ContentStatusEvent extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'at' => 'date',
        ];
    }

    /** @return BelongsTo<Content, $this> */
    public function content(): BelongsTo
    {
        return $this->belongsTo(Content::class);
    }
}
