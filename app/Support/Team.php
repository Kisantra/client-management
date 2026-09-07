<?php

namespace App\Support;

use App\Models\Content;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

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
