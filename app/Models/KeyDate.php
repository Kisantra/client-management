<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A day the content calendar has to plan around.
 *
 * Two kinds share the table because they answer the same question — what is
 * this week up against — and a screen that had to read two tables to answer it
 * would show them in two places.
 */
class KeyDate extends Model
{
    public const LIBUR = 'libur';

    public const PAJAK = 'pajak';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'confirmed' => 'boolean',
        ];
    }

    /** @param  Builder<self>  $query */
    public function scopeBetween(Builder $query, Carbon $from, Carbon $until): Builder
    {
        return $query->whereBetween('date', [$from->copy()->startOfDay(), $until->copy()->endOfDay()]);
    }

    /** How the calendar labels it in one word. */
    public function kindLabel(): string
    {
        return $this->kind === self::PAJAK ? 'Pajak' : 'Libur';
    }
}
