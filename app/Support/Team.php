<?php

namespace App\Support;

use App\Models\Content;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Who may be put down as PJ.
 *
 * Not simply the account list. The work predates most of the accounts — five
 * names carry leads and content today and only one of them can sign in — so a
 * picker offering accounts alone would leave every existing PJ unselectable
 * and blank the field the moment somebody opened the form to change something
 * else. The list is therefore accounts plus every name the work already
 * carries, the same rule the Team page reads by.
 *
 * A name without an account is still shown, and shown as such: that gap is a
 * fact about the team worth seeing, not one to paper over.
 */
class Team
{
    /** The tables that sign a record with the name of whoever wrote it. */
    private const SIGNED = ['lead_notes', 'content_status_events', 'content_ideas', 'content_comments'];

    /**
     * @return array<int, array{name: string, hasAccount: bool, active: int}>
     */
    public static function members(): array
    {
        $accounts = User::query()->orderBy('name')->pluck('name');

        /* How much unfinished content each name is holding — the one load
           figure the app can state truthfully today. There is no capacity to
           measure it against yet, so none is invented. */
        $load = Content::query()
            ->where('status', '!=', Content::PUBLISHED)
            ->whereNotNull('owner')
            ->where('owner', '!=', '')
            ->toBase()
            ->selectRaw('owner, count(*) as total')
            ->groupBy('owner')
            ->pluck('total', 'owner');

        return self::names($accounts)
            ->map(fn (string $name) => [
                'name' => $name,
                'hasAccount' => $accounts->contains($name),
                'active' => (int) ($load[$name] ?? 0),
            ])
            ->sortBy([['hasAccount', 'desc'], ['name', 'asc']])
            ->values()
            ->all();
    }

    /** Every name the roster holds: accounts, and every PJ the work carries. @return array<int, string> */
    public static function roster(): array
    {
        return self::names(User::query()->pluck('name'))->all();
    }

    /**
     * How much of the work is written down under a name.
     *
     * @return array{content: int, leads: int}
     */
    public static function holdings(string $name): array
    {
        return [
            'content' => Content::query()->where('owner', $name)->count(),
            'leads' => Lead::query()->where('owner', $name)->count(),
        ];
    }

    /**
     * A new name, everywhere the old one was written.
     *
     * The app ties a person to their work by the exact name, so a rename that
     * touched only the account would quietly orphan everything they hold —
     * and every note they wrote would go on being signed by somebody who, as
     * far as the app can tell, no longer exists.
     *
     * @return array{content: int, leads: int}
     */
    public static function rename(string $from, string $to): array
    {
        if ($from === $to) {
            return ['content' => 0, 'leads' => 0];
        }

        return DB::transaction(function () use ($from, $to) {
            foreach (self::SIGNED as $table) {
                DB::table($table)->where('author', $from)->update(['author' => $to]);
            }

            return [
                'content' => DB::table('contents')->where('owner', $from)->update(['owner' => $to]),
                'leads' => DB::table('leads')->where('owner', $from)->update(['owner' => $to]),
            ];
        });
    }

    /**
     * Everything a name is PJ for, given to somebody else or to nobody.
     *
     * Authorship is left alone on purpose. Who is responsible for a piece
     * can change hands; who wrote a note on it cannot.
     *
     * @return array{content: int, leads: int}
     */
    public static function handOver(string $from, ?string $to): array
    {
        return DB::transaction(fn () => [
            'content' => DB::table('contents')->where('owner', $from)->update(['owner' => $to]),
            'leads' => DB::table('leads')->where('owner', $from)->update(['owner' => $to]),
        ]);
    }

    /**
     * @param  Collection<int, string>  $accounts
     * @return Collection<int, string>
     */
    private static function names(Collection $accounts): Collection
    {
        return $accounts
            ->merge(self::owners(Content::query()))
            ->merge(self::owners(Lead::query()))
            ->filter(fn (?string $name) => filled($name))
            ->unique()
            ->values();
    }

    /**
     * @param  Builder<covariant \Illuminate\Database\Eloquent\Model>  $query
     * @return Collection<int, string>
     */
    private static function owners($query): Collection
    {
        return $query
            ->whereNotNull('owner')
            ->where('owner', '!=', '')
            ->distinct()
            ->pluck('owner');
    }
}
