<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

/**
 * One thing somebody did to one record.
 *
 * Only human actions are kept. Writes that happen with nobody signed in — the
 * seeders, the Instagram and TikTok imports, anything on a schedule — are not
 * recorded at all, because a log where three hundred scraped posts sit between
 * two edits is a log nobody opens twice. What this table answers is "who
 * changed this, and what did they change it from", and only a person can be
 * the answer to that.
 */
class Activity extends Model
{
    public const CREATED = 'created';

    public const UPDATED = 'updated';

    public const DELETED = 'deleted';

    protected $guarded = [];

    /**
     * Fields that must never reach the log, whatever a model asks for.
     *
     * A blocklist here rather than only in each model, because the cost of one
     * model forgetting is a password history in a table the whole team can
     * read. Bookkeeping columns are in the same list for a duller reason: they
     * change on every write and say nothing.
     */
    public const NEVER = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
        'created_at',
        'updated_at',
    ];

    /**
     * Day and month names, written out rather than taken from the locale.
     *
     * The rest of the app does the same — every controller that prints a month
     * carries its own list — because nothing here sets an application locale,
     * and `translatedFormat` on an unset locale quietly returns English into a
     * page that is Indonesian everywhere else. Kept on the model rather than
     * copied into a fifth controller: this is the only place that needs a day
     * name, and the two files that write the log both read it from here.
     */
    public const DAYS = [
        'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
    ];

    public const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    /** What each action is called where it is read. */
    public const ACTION_LABELS = [
        self::CREATED => 'Dibuat',
        self::UPDATED => 'Diubah',
        self::DELETED => 'Dihapus',
    ];

    protected function casts(): array
    {
        return ['diff' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Writes one entry, or nothing at all when there is no person behind it.
     *
     * @param  array<int, array{field: string, label: string, from: ?string, to: ?string}>|null  $changes
     */
    public static function record(
        string $action,
        string $subjectType,
        ?int $subjectId,
        string $subjectLabel,
        ?array $changes = null,
        ?string $url = null,
    ): ?self {
        $user = Auth::user();

        if (! $user) {
            return null;
        }

        /* An update that touched nothing worth naming is not an event. Saving
           a form without changing a field would otherwise post "Andre mengubah
           PT Bumi Mandiri" and leave the reader hunting for what. */
        if ($action === self::UPDATED && $changes === []) {
            return null;
        }

        return self::create([
            'user_id' => $user->id,
            'actor' => $user->name,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'subject_label' => $subjectLabel,
            'diff' => $changes,
            'url' => $url,
        ]);
    }

    /**
     * @return array{
     *     id: int, actor: string, initial: string, action: string,
     *     actionLabel: string, type: string, label: string, url: ?string,
     *     changes: array<int, array{label: string, from: ?string, to: ?string}>,
     *     at: string, time: string
     * }
     */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'actor' => $this->actor,
            'initial' => mb_strtoupper(mb_substr($this->actor, 0, 1)),
            'action' => $this->action,
            'actionLabel' => self::ACTION_LABELS[$this->action] ?? $this->action,
            'type' => $this->subject_type,
            'label' => $this->subject_label,
            /* A deleted record's link is dropped here rather than at write
               time: the entry still names what went, it just has nowhere to
               send you. */
            'url' => $this->action === self::DELETED ? null : $this->url,
            'changes' => $this->diff ?? [],
            'at' => $this->created_at->toIso8601String(),
            'time' => $this->created_at->format('H.i'),
        ];
    }

    /** The day an entry belongs to, as the page groups them. */
    public function day(): string
    {
        return $this->created_at->toDateString();
    }

    /** "Hari ini", "Kemarin", or the date written out. */
    public static function dayLabel(string $date): string
    {
        $day = Carbon::parse($date);

        if ($day->isToday()) {
            return 'Hari ini';
        }

        if ($day->isYesterday()) {
            return 'Kemarin';
        }

        return self::DAYS[$day->dayOfWeek].', '.self::date($day);
    }

    /** A date as the app writes them: 6 September 2026. */
    public static function date(Carbon $at): string
    {
        return $at->day.' '.self::MONTHS[$at->month - 1].' '.$at->year;
    }

    /** The same, shortened, for the from-and-to of a changed field. */
    public static function shortDate(Carbon $at): string
    {
        return $at->day.' '.mb_substr(self::MONTHS[$at->month - 1], 0, 3).' '.$at->year;
    }
}
