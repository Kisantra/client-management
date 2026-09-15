import { Head, Link } from '@inertiajs/react';
import {
    CalendarDays,
    Ellipsis,
    PencilLine,
    Plus,
    Trash2,
    UserRoundPlus,
    UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { AddMemberDialog } from '@/components/team/add-member-dialog';
import type { Invite } from '@/components/team/add-member-dialog';
import { EditMemberDialog } from '@/components/team/edit-member-dialog';
import { RemoveMemberDialog } from '@/components/team/remove-member-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    const [editing, setEditing] = useState<TeamMember | null>(null);
    const [removing, setRemoving] = useState<TeamMember | null>(null);

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
                                    onEdit={() => setEditing(member)}
                                    onRemove={() => setRemoving(member)}
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
            <EditMemberDialog
                member={editing}
                onClose={() => setEditing(null)}
            />
            <RemoveMemberDialog
                member={removing}
                members={members}
                onClose={() => setRemoving(null)}
            />
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

/**
 * One person on the roster.
 *
 * The actions sit in a column of fixed width, identical on every row, so the
 * load bars start and end at the same place down the whole list. They used to
 * be sized by their own labels — "Buatkan akun" on one row, "Peran" on the
 * next — and every bar ran to a different length for a reason that had
 * nothing to do with the work.
 */
function MemberRow({
    member,
    heaviest,
    onEdit,
    onRemove,
    onInvite,
}: {
    member: TeamMember;
    heaviest: number;
    onEdit: () => void;
    onRemove: () => void;
    onInvite: () => void;
}) {
    const initials = useInitials();

    const calendarFor = content({ query: { pj: member.name } }).url;

    return (
        /*
         | Two lines, shared across the row: the name and the bar on the
         | first, what they are and how the week sits on the second. The
         | avatar and the actions each span both lines, centred, so the row
         | is mirrored left to right. Every line is a fixed 1.25rem, so a row
         | with an email under the name and a row with the account chip stand
         | exactly as tall as each other.
         */
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 p-4 transition-colors hover:bg-neutral-soft/40 sm:p-5 xl:grid-cols-[2.5rem_minmax(10rem,15rem)_minmax(0,1fr)_8.75rem]">
            <span className="col-start-1 row-span-2 row-start-1 grid size-10 place-items-center rounded-full bg-primary-soft text-[0.8438rem] font-extrabold text-primary-deep">
                {initials(member.name)}
            </span>

            <p className="col-start-2 row-start-1 flex h-5 min-w-0 items-center gap-2 text-sm leading-5 font-bold">
                <span className="truncate">{member.name}</span>
                {member.isYou ? (
                    <span className="shrink-0 rounded-full bg-primary-soft px-2 text-[0.6875rem] leading-4 font-bold text-primary-deep">
                        Kamu
                    </span>
                ) : null}
            </p>

            <div className="col-start-2 row-start-2 flex h-5 min-w-0 items-center">
                {member.userId ? (
                    <p className="truncate text-xs leading-5 text-muted-foreground">
                        {member.role ?? 'Peran belum diatur'} · {member.email}
                    </p>
                ) : (
                    /* The gap and the way to close it, in one place. */
                    <button
                        type="button"
                        onClick={onInvite}
                        title="Namanya tercatat sebagai PJ. Buatkan akun dengan nama persis sama supaya tersambung."
                        className="inline-flex h-5 items-center gap-1 rounded-full bg-neutral-soft px-2 text-xs font-semibold whitespace-nowrap text-secondary-foreground transition-colors hover:bg-primary-soft hover:text-primary-deep focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                    >
                        Belum punya akun
                        <span className="inline-flex items-center gap-0.5 text-primary-deep">
                            <UserRoundPlus
                                className="size-3"
                                strokeWidth={2.25}
                                aria-hidden
                            />
                            Buatkan
                        </span>
                    </button>
                )}
            </div>

            {/* The bar on the name's line: length is the load, drawn against
                the busiest member. */}
            <div
                className="col-span-3 row-start-3 mt-2.5 flex h-5 items-center xl:col-span-1 xl:col-start-3 xl:row-start-1 xl:mt-0 xl:pl-4"
                role="img"
                aria-label={`${member.active} konten aktif: ${member.draft} draft, ${member.review} review, ${member.approved} approved`}
            >
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {heaviest > 0
                        ? LOAD_SEGMENTS.map((segment) => (
                              <span
                                  key={segment.key}
                                  className={segment.className}
                                  style={{
                                      width: `${(member[segment.key] / heaviest) * 100}%`,
                                  }}
                              />
                          ))
                        : null}
                </div>
            </div>

            <p className="col-span-3 row-start-4 flex min-h-5 flex-wrap items-center gap-x-3.5 text-xs leading-5 text-muted-foreground xl:col-span-1 xl:col-start-3 xl:row-start-2 xl:pl-4">
                <span className="font-bold text-foreground">
                    <span data-numeric>{member.active}</span> aktif
                </span>
                <Stat value={member.week} label="minggu ini" />
                {member.late > 0 ? (
                    <span className="font-bold text-destructive">
                        <span data-numeric>{member.late}</span> telat
                    </span>
                ) : null}
                <Stat value={member.publishedMonth} label="tayang bulan ini" />
            </p>

            {/* Pulled out by the icon button's own inset, so the dots end
                where the avatar begins on the other side: the same distance
                from the card's edge. */}
            <div className="col-start-3 row-span-2 row-start-1 -mr-2 flex items-center justify-end gap-1 xl:col-start-4 xl:pl-4">
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-secondary-foreground hover:text-primary-deep"
                >
                    <Link href={calendarFor}>
                        <CalendarDays strokeWidth={1.75} aria-hidden />
                        {/* A label on a wide screen, an icon on a phone where
                            the name needs the room. */}
                        <span className="sr-only sm:not-sr-only">Kalender</span>
                    </Link>
                </Button>

                {/* Not modal: the menu hands off to a dialog, and a modal
                    menu closing under an opening dialog leaves the page
                    unclickable. */}
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-neutral-soft data-[state=open]:text-foreground"
                            aria-label={`Aksi untuk ${member.name}`}
                        >
                            <Ellipsis strokeWidth={2} aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        sideOffset={6}
                        className="w-56 rounded-lg p-1.5 shadow-lift-lg"
                    >
                        <DropdownMenuItem
                            className="gap-2.5 py-2 text-[0.8438rem] font-semibold"
                            onSelect={onEdit}
                        >
                            <PencilLine strokeWidth={2} aria-hidden />
                            Edit anggota
                        </DropdownMenuItem>
                        {member.userId ? null : (
                            <DropdownMenuItem
                                className="gap-2.5 py-2 text-[0.8438rem] font-semibold"
                                onSelect={onInvite}
                            >
                                <UserRoundPlus strokeWidth={2} aria-hidden />
                                Buatkan akun
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="mx-1 my-1.5" />
                        <DropdownMenuItem
                            className="gap-2.5 py-2 text-[0.8438rem] font-semibold"
                            disabled={member.isYou}
                            onSelect={onRemove}
                        >
                            <Trash2 strokeWidth={2} aria-hidden />
                            Hapus anggota
                            {member.isYou ? (
                                <span className="ml-auto text-[0.6875rem] font-semibold text-muted-foreground">
                                    akunmu
                                </span>
                            ) : null}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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
