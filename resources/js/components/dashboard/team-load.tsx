import { cn } from '@/lib/utils';

/** One person, and what the calendar has on them this week. */
export type LoadMember = {
    name: string;
    initials: string;
    due: number;
    /** How many of those are already past their date and not out. */
    late: number;
};

export type TeamLoadData = {
    /** The days this counts, written out, because "minggu ini" is not a date. */
    window: string;
    total: number;
    /** The largest load, which is what the bars are measured against. */
    busiest: number;
    members: LoadMember[];
};

/**
 * Who is carrying what this week.
 *
 * This panel used to be five invented names against an invented capacity of
 * eight — every figure in it a literal in a front-end file, including the
 * loads. It reads the calendar now.
 *
 * There is still no capacity, and that is deliberate rather than unfinished:
 * nobody has told this app how many pieces a week is one person's fair share,
 * so it will not draw a line and call people over it. What it can say
 * truthfully is who is carrying most, so the bars are measured against the
 * busiest person and the panel says that out loud. A length has to be measured
 * against something stated; the largest load is the only denominator the data
 * itself supplies.
 *
 * Late work is called out in its own right. Six pieces due is a week; six
 * pieces due of which three have already slipped is a different week, and the
 * count alone cannot tell them apart.
 */
export function TeamLoad({ load }: { load: TeamLoadData }) {
    if (load.members.length === 0) {
        return (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                Belum ada anggota tim yang tercatat.
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-3.5">
            {load.members.map((member) => {
                const share =
                    load.busiest > 0 ? (member.due / load.busiest) * 100 : 0;

                return (
                    <li key={member.name} className="flex items-center gap-3">
                        <span
                            className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-soft text-xs font-extrabold text-secondary-foreground"
                            aria-hidden
                        >
                            {member.initials}
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">
                                {member.name}
                            </span>
                            <span
                                className={cn(
                                    'block text-xs',
                                    member.late > 0
                                        ? 'font-semibold text-destructive'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {member.due === 0 ? (
                                    'Tidak ada konten minggu ini'
                                ) : (
                                    <>
                                        <span data-numeric>{member.due}</span>{' '}
                                        konten
                                        {member.late > 0 ? (
                                            <>
                                                {' — '}
                                                <span data-numeric>
                                                    {member.late}
                                                </span>{' '}
                                                terlambat
                                            </>
                                        ) : null}
                                    </>
                                )}
                            </span>
                        </span>

                        {/* Measured against the busiest person, which the panel
                            states beside its title. */}
                        <span
                            className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-neutral-soft"
                            role="img"
                            aria-label={`${member.due} konten, terbanyak di tim ${load.busiest}`}
                        >
                            <span
                                className={cn(
                                    'block h-full rounded-full',
                                    member.late > 0
                                        ? 'bg-destructive'
                                        : 'bg-primary',
                                )}
                                style={{ width: `${share}%` }}
                            />
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
