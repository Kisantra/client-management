<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Who is on the team, and how the work sits across them.
 *
 * A member is anyone the work already knows: an account that can sign in, or
 * a name the calendar carries as PJ. The two are matched by exact name, so
 * the page also shows the gap — people holding content without an account.
 */
class TeamController extends Controller
{
    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public function index(Request $request): Response
    {
        $today = Carbon::today();
        $weekStart = $today->copy()->startOfWeek();
        $weekEnd = $today->copy()->endOfWeek();

        /*
         | One pass over the calendar, grouped by PJ: how much sits in each
         | stage, what is past its date, what this week asks of them, and what
         | this month already shipped. Week bounds are end-exclusive because
         | SQLite compares these dates as text, where BETWEEN loses the last
         | day to the time suffix.
         */
        $loads = Content::query()
            ->toBase()
            ->selectRaw("COALESCE(owner, '') as owner")
            ->selectRaw("SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft")
            ->selectRaw("SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review")
            ->selectRaw("SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved")
            ->selectRaw("SUM(CASE WHEN status <> 'published' AND scheduled_for < ? THEN 1 ELSE 0 END) as late", [$today->toDateString()])
            ->selectRaw('SUM(CASE WHEN scheduled_for >= ? AND scheduled_for < ? THEN 1 ELSE 0 END) as this_week', [
                $weekStart->toDateString(),
                $weekEnd->copy()->addDay()->toDateString(),
            ])
            ->selectRaw("SUM(CASE WHEN status = 'published' AND published_at >= ? THEN 1 ELSE 0 END) as published_month", [
                $today->copy()->startOfMonth()->toDateString(),
            ])
            ->groupBy('owner')
            ->get()
            ->keyBy('owner');

        $accounts = User::query()->orderBy('name')->get()->keyBy('name');

        $names = $accounts->keys()
            ->merge($loads->keys()->filter(fn (string $name) => $name !== ''))
            ->unique()
            ->values();

        $members = $names
            ->map(function (string $name) use ($accounts, $loads, $request) {
                $account = $accounts->get($name);
                $load = $loads->get($name);

                return [
                    'name' => $name,
                    'userId' => $account?->id,
                    'isYou' => $account !== null && $request->user()->is($account),
                    'email' => $account?->email,
                    'role' => $account?->role,
                    'joinedAt' => $account?->created_at?->toDateString(),
                    'draft' => (int) ($load->draft ?? 0),
                    'review' => (int) ($load->review ?? 0),
                    'approved' => (int) ($load->approved ?? 0),
                    'active' => (int) (($load->draft ?? 0) + ($load->review ?? 0) + ($load->approved ?? 0)),
                    'late' => (int) ($load->late ?? 0),
                    'week' => (int) ($load->this_week ?? 0),
                    'publishedMonth' => (int) ($load->published_month ?? 0),
                ];
            })
            ->sortBy([['active', 'desc'], ['name', 'asc']])
            ->values()
            ->all();

        $unassigned = $loads->get('');

        return Inertia::render('team', [
            'members' => $members,
            'totals' => [
                'members' => $names->count(),
                'accounts' => $accounts->count(),
                'active' => (int) $loads->sum(fn (object $load) => $load->draft + $load->review + $load->approved),
                'late' => (int) $loads->sum('late'),
                'week' => (int) $loads->sum('this_week'),
                'publishedMonth' => (int) $loads->sum('published_month'),
                'unassigned' => $unassigned === null
                    ? 0
                    : (int) ($unassigned->draft + $unassigned->review + $unassigned->approved),
            ],
            'week' => [
                'start' => $weekStart->toDateString(),
                'end' => $weekEnd->toDateString(),
                'label' => $weekStart->month === $weekEnd->month
                    ? $weekStart->day.'–'.$weekEnd->day.' '.self::MONTHS[$weekEnd->month - 1]
                    : $weekStart->day.' '.self::MONTHS[$weekStart->month - 1].' – '.$weekEnd->day.' '.self::MONTHS[$weekEnd->month - 1],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:users,name'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['nullable', 'string', 'max:60'],
        ], [
            'name.required' => 'Nama anggota wajib diisi.',
            'name.unique' => 'Sudah ada anggota dengan nama ini.',
            'email.required' => 'Email untuk masuk wajib diisi.',
            'email.unique' => 'Email ini sudah dipakai akun lain.',
            'password.min' => 'Sandi minimal 8 karakter.',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
        ]);

        /*
         | Set apart from create: role sits outside mass-assignment defaults
         | of the auth flows, and a teammate added by hand is vouched for, so
         | the address counts as verified from day one.
         */
        $user->forceFill([
            'role' => trim((string) ($validated['role'] ?? '')) ?: null,
            'email_verified_at' => now(),
        ])->save();

        $this->toast(
            $validated['name'].' masuk daftar anggota',
            'Akunnya bisa dipakai masuk dengan email '.$validated['email'].'.',
        );

        return to_route('team');
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'role' => ['nullable', 'string', 'max:60'],
        ], [
            'role.max' => 'Peran maksimal 60 karakter.',
        ]);

        $role = trim((string) ($validated['role'] ?? '')) ?: null;

        $user->forceFill(['role' => $role])->save();

        $this->toast(
            $role === null
                ? 'Peran '.$user->name.' dikosongkan'
                : $user->name.' tercatat sebagai '.$role,
        );

        return back();
    }
}
