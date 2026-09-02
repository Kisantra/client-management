<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class InstagramProfile extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'followers' => 'integer',
            'follows' => 'integer',
            'posts_count' => 'integer',
            'verified' => 'boolean',
            'is_business' => 'boolean',
            'fetched_at' => 'datetime',
        ];
    }

    public function posts(): HasMany
    {
        return $this->hasMany(InstagramPost::class)->orderByDesc('posted_at');
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(InstagramSnapshot::class)->orderBy('captured_on');
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path
            ? Storage::disk('public')->url($this->avatar_path)
            : null;
    }
}
