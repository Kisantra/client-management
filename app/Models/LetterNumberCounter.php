<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The last sequence handed out for one prefix in one year.
 *
 * @property int $id
 * @property string $prefix
 * @property int $year
 * @property int $last_sequence
 */
class LetterNumberCounter extends Model
{
    protected $guarded = [];
}
