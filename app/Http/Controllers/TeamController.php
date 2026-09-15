<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\Lead;
use App\Models\User;
use App\Support\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
            ->selectRaw('COUNT(*) as total')
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

        $leads = Lead::query()
            ->toBase()
            ->whereNotNull('owner')
            ->where('owner', '!=', '')
            ->selectRaw('owner, COUNT(*) as total')
            ->groupBy('owner')
            ->pluck('total', 'owner');

        /* Lead PJs too, the same rule Team::members reads by: a name that
           only holds leads is still somebody the team hands work to, and a
           roster without them could not be asked to rename or remove them. */
        $names = $accounts->keys()
            ->merge($loads->keys()->filter(fn (string $name) => $name !== ''))
            ->merge($leads->keys())
            ->unique()
            ->values();

        $members = $names
            ->map(function (string $name) use ($accounts, $loads, $leads, $request) {
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
                    /* Everything under the name, finished or not: what an
                       edit renames and a removal has to hand over. */
                    'contentCount' => (int) ($load->total ?? 0),
                    'leadCount' => (int) ($leads[$name] ?? 0),
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

    /**
     * An account's details. Also answers the role-only patch the roster sent
     * before the account could be edited in full, so every field is optional.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80', Rule::unique('users', 'name')->ignore($user->id)],
            'email' => ['sometimes', 'required', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['nullable', 'string', 'max:60'],
        ], [
            'name.required' => 'Nama anggota wajib diisi.',
            'name.max' => 'Nama maksimal 80 karakter.',
            'name.unique' => 'Sudah ada akun lain dengan nama ini.',
            'email.required' => 'Email untuk masuk wajib diisi.',
            'email.email' => 'Alamat email tidak valid.',
            'email.unique' => 'Email ini sudah dipakai akun lain.',
            'password.min' => 'Sandi minimal 8 karakter.',
            'role.max' => 'Peran maksimal 60 karakter.',
        ]);

        /* A role-only patch keeps its old toast, so setting a role still
           reads as setting a role. */
        if (array_keys($validated) === ['role']) {
            $role = trim((string) $validated['role']) ?: null;
            $user->forceFill(['role' => $role])->save();

            $this->toast(
                $role === null
                    ? 'Peran '.$user->name.' dikosongkan'
                    : $user->name.' tercatat sebagai '.$role,
            );

            return back();
        }

        $from = $user->name;
        $to = trim((string) ($validated['name'] ?? $from));

        $moved = DB::transaction(function () use ($user, $validated, $from, $to, $request) {
            $user->forceFill([
                'name' => $to,
                'email' => $validated['email'] ?? $user->email,
            ]);

            if ($request->has('role')) {
                $user->role = trim((string) ($validated['role'] ?? '')) ?: null;
            }

            if (filled($validated['password'] ?? null)) {
                $user->password = $validated['password'];
            }

            $user->save();

            return Team::rename($from, $to);
        });

        $this->toast('Data '.$to.' diperbarui', $this->renamed($from, $to, $moved));

        return back();
    }

    /**
     * An account, gone — and the work under its name handed to somebody,
     * cleared, or left under the name as a PJ without an account.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($request->user()->is($user)) {
            throw ValidationException::withMessages([
                'member' => 'Akun yang sedang dipakai tidak bisa dihapus dari sini.',
            ]);
        }

        $validated = $request->validate([
            'handover' => ['required', Rule::in(['keep', 'clear', 'give'])],
            'to' => ['required_if:handover,give', 'nullable', 'string', Rule::in($this->others($user->name))],
        ], $this->handoverMessages());

        $name = $user->name;

        $moved = DB::transaction(function () use ($user, $validated, $name) {
            $moved = match ($validated['handover']) {
                'give' => Team::handOver($name, $validated['to']),
                'clear' => Team::handOver($name, null),
                default => ['content' => 0, 'leads' => 0],
            };

            $user->notifications()->delete();
            $user->delete();

            return $moved;
        });

        $this->toast($name.' dihapus dari anggota', $this->handedOver($validated, $moved));

        return back();
    }

    /**
     * A name that exists only as PJ: renamed wherever it is written, and —
     * when an email and a password come with it — given an account under the
     * new name in the same step, so the work it holds is connected the moment
     * the account exists.
     */
    public function renameName(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', Rule::in($this->pjOnly())],
            'to' => ['required', 'string', 'max:80', Rule::unique('users', 'name')],
            'email' => ['nullable', 'required_with:password', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['nullable', 'required_with:email', 'string', 'min:8'],
            'role' => ['nullable', 'string', 'max:60'],
        ], [
            'name.in' => 'Nama ini tidak ada di daftar PJ.',
            'to.required' => 'Nama anggota wajib diisi.',
            'to.max' => 'Nama maksimal 80 karakter.',
            'to.unique' => 'Nama ini dipakai sebuah akun. Buatkan akun lewat baris anggotanya.',
            'email.required_with' => 'Isi email untuk membuat akunnya.',
            'email.email' => 'Alamat email tidak valid.',
            'email.unique' => 'Email ini sudah dipakai akun lain.',
            'password.required_with' => 'Isi sandi awal untuk membuat akunnya.',
            'password.min' => 'Sandi minimal 8 karakter.',
            'role.max' => 'Peran maksimal 60 karakter.',
        ]);

        $from = $validated['name'];
        $to = trim($validated['to']);
        $email = $validated['email'] ?? null;

        [$moved, $user] = DB::transaction(function () use ($from, $to, $email, $validated) {
            $moved = Team::rename($from, $to);

            if (blank($email)) {
                return [$moved, null];
            }

            $user = User::create([
                'name' => $to,
                'email' => $email,
                'password' => $validated['password'],
            ]);

            /* The same footing as an account made from "Tambah Anggota": a
               teammate vouched for in person, verified from day one. */
            $user->forceFill([
                'role' => trim((string) ($validated['role'] ?? '')) ?: null,
                'email_verified_at' => now(),
            ])->save();

            return [$moved, $user];
        });

        match (true) {
            $user !== null => $this->toast(
                $to.' kini punya akun',
                trim('Bisa masuk dengan email '.$email.'. '.($this->renamed($from, $to, $moved) ?? '')),
            ),
            $from === $to => $this->toast('Tidak ada yang berubah'),
            default => $this->toast('Nama '.$from.' diganti menjadi '.$to, $this->renamed($from, $to, $moved)),
        };

        return back();
    }

    /** A name that exists only as PJ, taken off the work it holds. */
    public function destroyName(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', Rule::in($this->pjOnly())],
            'handover' => ['required', Rule::in(['clear', 'give'])],
            'to' => ['required_if:handover,give', 'nullable', 'string', Rule::in($this->others((string) $request->input('name')))],
        ], [
            'name.in' => 'Nama ini tidak ada di daftar PJ.',
            ...$this->handoverMessages(),
        ]);

        $moved = Team::handOver($validated['name'], $validated['handover'] === 'give' ? $validated['to'] : null);

        $this->toast($validated['name'].' dihapus dari anggota', $this->handedOver($validated, $moved));

        return back();
    }

    /** @return array<int, string> Every roster name but this one. */
    private function others(string $name): array
    {
        return array_values(array_filter(Team::roster(), fn (string $other) => $other !== $name));
    }

    /** @return array<int, string> Roster names with no account behind them. */
    private function pjOnly(): array
    {
        $accounts = User::query()->pluck('name')->all();

        return array_values(array_diff(Team::roster(), $accounts));
    }

    /** @return array<string, string> */
    private function handoverMessages(): array
    {
        return [
            'handover.required' => 'Pilih apa yang terjadi pada pekerjaannya.',
            'to.required_if' => 'Pilih anggota yang menerima pekerjaannya.',
            'to.in' => 'Anggota penerima tidak ada di daftar.',
        ];
    }

    /** @param  array{content: int, leads: int}  $moved */
    private function renamed(string $from, string $to, array $moved): ?string
    {
        if ($from === $to || $moved['content'] + $moved['leads'] === 0) {
            return null;
        }

        return 'PJ di '.$moved['content'].' konten dan '.$moved['leads'].' lead ikut berganti nama.';
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  array{content: int, leads: int}  $moved
     */
    private function handedOver(array $validated, array $moved): ?string
    {
        $count = $moved['content'].' konten dan '.$moved['leads'].' lead';

        return match ($validated['handover']) {
            'give' => $count.' kini dipegang '.$validated['to'].'.',
            'clear' => $count.' kini tanpa PJ.',
            default => 'Namanya tetap tercatat sebagai PJ, tanpa akun.',
        };
    }
}
