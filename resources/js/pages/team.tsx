import { Head, Link } from '@inertiajs/react';
import {
    CalendarDays,
    PencilLine,
    Plus,
    UserRoundPlus,
    UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { AddMemberDialog } from '@/components/team/add-member-dialog';
import type { Invite } from '@/components/team/add-member-dialog';
import { RoleDialog } from '@/components/team/role-dialog';
import { Button } from '@/components/ui/button';
import { LOAD_SEGMENTS } from '@/data/team';
import type { TeamMember, TeamTotals, TeamWeek } from '@/data/team';
import { useContentStatusLabels } from '@/hooks/use-content-plan';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { content, team } from '@/routes';

type Props = {
    members: TeamMember[];
    totals: TeamTotals;
    week: TeamWeek;
};

export default function Anggota({ members, totals, week }: Props) {
    const [invite, setInvite] = useState<Invite | null>(null);
    const [roleFor, setRoleFor] = useState<TeamMember | null>(null);

    /* Every bar is drawn against the busiest member, so length compares. */
    const heaviest = Math.max(0, ...members.map((member) => member.active));

    return (
        <>
            <Head title="Anggota" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Anggota
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {totals.members}
                            </span>{' '}
                            anggota ·{' '}
                            <span data-numeric>{totals.accounts}</span> punya
                            akun
                        </p>
                    </div>

                    <Button
                        size="lg"
                        className="shadow-teal"
                        onClick={() => setInvite({ stamp: Date.now() })}
                    >
                        <Plus strokeWidth={2} aria-hidden />
                        Tambah Anggota
                    </Button>
                </div>

                <section
                    aria-label="Ringkasan beban tim"
                    className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-lift xl:grid-cols-4"
                >
                    <Figure
                        label="Konten aktif"
                        value={totals.active}
                        caption="belum tayang, semua status"
                    />
                    <Figure
                        label="Jadwal minggu ini"
                        value={totals.week}
                        caption={week.label}
                    />
                    <Figure
                        label="Telat"
                        value={totals.late}
                        tone={totals.late > 0 ? 'text-destructive' : undefined}
                        caption="lewat tanggal, belum tayang"
                        href={content({ query: { telat: '1' } }).url}
                    />
                    <Figure
                        label="Belum ada PJ"
                        value={totals.unassigned}
                        caption="konten aktif tanpa penanggung jawab"
                        href={content({ query: { pj: 'tanpa' } }).url}
                    />
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-card shadow-lift">
                    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
                        <div>
                            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                Sebaran beban kerja
                            </h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Konten aktif per anggota; panjang bar dibanding
                                anggota tersibuk.
                            </p>
                        </div>
                        <Legend />
                    </header>

                    {members.length === 0 ? (
                        <EmptyRoster
                            onAdd={() => setInvite({ stamp: Date.now() })}
                        />
                    ) : (
                        <ul className="divide-y divide-border">
                            {members.map((member) => (
                                <MemberRow
                                    key={member.name}
                                    member={member}
                                    heaviest={heaviest}
                                    onRole={() => setRoleFor(member)}
                                    onInvite={() =>
                                        setInvite({
                                            name: member.name,
                                            stamp: Date.now(),
                                        })
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </section>

                <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
                    Akun dan kolom PJ di kalender tersambung lewat nama yang
                    persis sama. Pembagian hak akses belum dibedakan — semua
                    anggota melihat dan mengubah hal yang sama.
                </p>
            </div>

            <AddMemberDialog invite={invite} onClose={() => setInvite(null)} />
            <RoleDialog member={roleFor} onClose={() => setRoleFor(null)} />
        </>
    );
}

function Figure({
    label,
    value,
    caption,
    tone,
    href,
}: {
    label: string;
    value: number;
    caption: string;
    tone?: string;
    href?: string;
}) {
    const body = (
        <>
            <span className="text-[0.6875rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {label}
            </span>
            <span
                className={cn(
                    'text-2xl font-extrabold tracking-[-0.02em]',
                    tone,
                )}
                data-numeric
            >
                {value}
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground">
                {caption}
            </span>
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                className="flex flex-col gap-1 bg-card p-4 transition-colors hover:bg-accent/50 sm:p-5"
            >
                {body}
            </Link>
        );
    }

    return <div className="flex flex-col gap-1 bg-card p-4 sm:p-5">{body}</div>;
}

function Legend() {
    const labels = useContentStatusLabels();

    return (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            {LOAD_SEGMENTS.map((segment) => (
                <span
                    key={segment.key}
                    className="inline-flex items-center gap-1.5 text-[0.6875rem] font-bold text-muted-foreground"
                >
                    <span
                        className={cn(
                            'size-2 rounded-full',
                            segment.className,
                            segment.key === 'draft' &&
                                'ring-1 ring-black/10 ring-inset',
                        )}
                        aria-hidden
                    />
                    {labels[segment.key] ?? segment.key}
                </span>
            ))}
        </div>
    );
}

function MemberRow({
    member,
    heaviest,
    onRole,
    onInvite,
}: {
    member: TeamMember;
    heaviest: number;
    onRole: () => void;
    onInvite: () => void;
}) {
    const initials = useInitials();

    const calendarFor = content({ query: { pj: member.name } }).url;

    return (
        <li className="grid gap-x-6 gap-y-3 p-4 sm:p-5 lg:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.8438rem] font-extrabold text-primary-deep">
                    {initials(member.name)}
                </span>
                <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold">
                        <span className="truncate">{member.name}</span>
                        {member.isYou ? (
                            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-bold text-primary-deep">
                                Kamu
                            </span>
                        ) : null}
                    </p>
                    {member.userId ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {member.role ?? 'Peran belum diatur'} ·{' '}
                            {member.email}
                        </p>
                    ) : (
                        <p
                            className="mt-0.5 text-xs text-muted-foreground"
                            title="Namanya tercatat sebagai PJ konten. Buatkan akun dengan nama persis sama supaya tersambung."
                        >
                            <span className="rounded-full bg-neutral-soft px-2 py-0.5 font-semibold text-secondary-foreground">
                                Belum punya akun
                            </span>
                        </p>
                    )}
                </div>
            </div>

            <div className="min-w-0">
                <div className="flex items-center gap-3">
                    <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        {heaviest > 0
                            ? LOAD_SEGMENTS.map((segment) => (
                                  <span
                                      key={segment.key}
                                      className={segment.className}
                                      style={{
                                          width: `${(member[segment.key] / heaviest) * 100}%`,
                                      }}
                                      aria-hidden
                                  />
                              ))
                            : null}
                    </div>
                    <span
                        className="w-14 shrink-0 text-right text-xs font-bold whitespace-nowrap"
                        data-numeric
                    >
                        {member.active} aktif
                    </span>
                </div>

                <p className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                    <Stat value={member.week} label="minggu ini" />
                    {member.late > 0 ? (
                        <span className="font-bold text-destructive">
                            <span data-numeric>{member.late}</span> telat
                        </span>
                    ) : null}
                    <Stat
                        value={member.publishedMonth}
                        label="tayang bulan ini"
                    />
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {member.userId ? (
                    <Button variant="ghost" size="sm" onClick={onRole}>
                        <PencilLine strokeWidth={1.75} aria-hidden />
                        Peran
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" onClick={onInvite}>
                        <UserRoundPlus strokeWidth={1.75} aria-hidden />
                        Buatkan akun
                    </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                    <Link href={calendarFor}>
                        <CalendarDays strokeWidth={1.75} aria-hidden />
                        Kalender
                    </Link>
                </Button>
            </div>
        </li>
    );
}

function Stat({ value, label }: { value: number; label: ReactNode }) {
    return (
        <span className={cn(value > 0 && 'font-semibold text-foreground')}>
            <span data-numeric>{value}</span> {label}
        </span>
    );
}

function EmptyRoster({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                <UsersRound className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm font-bold">Belum ada anggota tercatat</p>
            <p className="max-w-[40ch] text-xs leading-relaxed text-muted-foreground">
                Anggota muncul dari akun yang dibuat di sini atau dari nama PJ
                yang dipakai di kalender konten.
            </p>
            <Button className="mt-1 shadow-teal" onClick={onAdd}>
                <Plus strokeWidth={2} aria-hidden />
                Tambah Anggota
            </Button>
        </div>
    );
}

Anggota.layout = {
    breadcrumbs: [
        {
            title: 'Anggota',
            href: team(),
        },
    ],
};
