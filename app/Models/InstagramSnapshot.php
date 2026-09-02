<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InstagramSnapshot extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'captured_on' => 'date',
            'followers' => 'integer',
            'follows' => 'integer',
            'posts_count' => 'integer',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(InstagramProfile::class, 'instagram_profile_id');
    }
}
