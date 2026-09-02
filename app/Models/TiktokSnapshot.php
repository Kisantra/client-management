<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TiktokSnapshot extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'captured_on' => 'date',
            'followers' => 'integer',
            'following' => 'integer',
            'hearts' => 'integer',
            'videos_count' => 'integer',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(TiktokProfile::class, 'tiktok_profile_id');
    }
}
