import { Link } from '@inertiajs/react';
import {
    CalendarCheck,
    MessageCircle,
    Phone,
    Mail,
    MapPin,
} from 'lucide-react';
import { STAGE_DOT } from '@/components/leads/stage-mark';
import { entryDate } from '@/data/leads';
import { cn } from '@/lib/utils';
import { show as leadShow } from '@/routes/leads';

/** One conversation the team owes, and how late it already is. */
export type FollowUp = {
    id: number;
    company: string;
    leadId: number;
    stage: string;
    stageLabel: string;
    owner: string | null;
    via: string;
    note: string | null;
    on: string;
    /** Zero on the day it is due; anything more is a promise already broken. */
    daysLate: number;
};

export type FollowUpQueue = {
    items: FollowUp[];
    overdue: number;
    today: number;
    /** How many more are owed beyond the ones shown. */
    rest: number;
};

/** The four ways this team reaches somebody, each with its own mark. */
const VIA = {
    WhatsApp: MessageCircle,
    Telepon: Phone,
    Email: Mail,
    Kunjungan: MapPin,
} as const;

/**
 * The conversations the team owes.
 *
 * This slot held a table of channels and the leads each brought in, and every
 * figure in it was invented — while the report now works the same table out
 * from real data, so the two pages had begun to contradict each other. Rather
 * than print the true version twice, the dashboard takes the question it was
 * not answering at all.
 *
 * The page's premise is what is due this morning, and it answered that for
 * content alone. Half a day here is not content: two hundred and thirty-one
 * follow-ups are already past their date, and nothing on this page said so —
 * you found out by opening a lead and seeing you were late to it.
 *
 * Only what is owed, soonest first. A follow-up booked for next Tuesday is not
 * a thing to do today, and listing it would bury the ones that are.
 */
export function FollowUps({ queue }: { queue: FollowUpQueue }) {
    if (queue.items.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary-deep">
                    <CalendarCheck
                        className="size-5"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                </span>
                <p className="text-sm font-bold">
                    Tidak ada follow-up yang jatuh tempo
                </p>
                <p className="max-w-[36ch] text-xs leading-relaxed text-muted-foreground">
                    Semua janji hubungi sudah dikerjakan atau masih di depan.
                </p>
            </div>
        );
    }

    return (
        <div>
            <p className="mb-3 flex flex-wrap items-center gap-x-1.5 text-xs">
                {queue.overdue > 0 ? (
                    <span className="font-semibold text-destructive">
                        <span data-numeric>{queue.overdue}</span> terlambat
                    </span>
                ) : null}
                {queue.overdue > 0 && queue.today > 0 ? (
                    <span aria-hidden className="text-muted-foreground">
                        ·
                    </span>
                ) : null}
                {queue.today > 0 ? (
                    <span className="text-muted-foreground">
                        <span
                            className="font-bold text-foreground"
                            data-numeric
                        >
                            {queue.today}
                        </span>{' '}
                        jatuh tempo hari ini
                    </span>
                ) : null}
            </p>

            <ul className="flex flex-col gap-0.5">
                {queue.items.map((item) => (
                    <li key={item.id}>
                        <Row item={item} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * One row, and the way to the lead it belongs to.
 *
 * A real link rather than a click handler on a div, so it keeps middle-click,
 * open-in-a-new-tab, the app's focus ring, and an announced destination.
 */
function Row({ item }: { item: FollowUp }) {
    const Icon = VIA[item.via as keyof typeof VIA] ?? MessageCircle;
    const late = item.daysLate > 0;

    return (
        <Link
            href={leadShow(item.leadId)}
            className={cn(
                '-mx-2 flex items-start gap-3.5 rounded-md px-2.5 py-2.5 transition-colors',
                /* A breached row already carries the alarm wash, so its hover
                   has to deepen that rather than replace it. */
                late
                    ? 'bg-destructive-soft hover:bg-destructive/15'
                    : 'hover:bg-neutral-soft',
            )}
        >
            <span className="w-[4.5rem] shrink-0 self-center">
                <span
                    className={cn(
                        'block text-[0.8438rem] leading-tight font-extrabold',
                        late ? 'text-destructive' : 'text-foreground',
                    )}
                    data-numeric
                >
                    {entryDate(item.on)}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                    <Icon
                        className="size-3 shrink-0"
                        strokeWidth={2.5}
                        aria-hidden
                    />
                    {item.via}
                </span>
            </span>

            <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8438rem] leading-snug font-bold">
                    {item.company}
                </span>

                {item.note ? (
                    <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                        {item.note}
                    </span>
                ) : null}

                <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                    {/* The dot map is a plain constant; StageMark itself
                        reads the pipeline out of shared props the dashboard is
                        not given, and took the page down with it. The label is
                        on the row already. */}
                    <span
                        className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            STAGE_DOT[item.stage] ?? 'bg-neutral-soft',
                        )}
                        aria-hidden
                    />
                    <span>{item.stageLabel}</span>
                    {item.owner ? (
                        <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{item.owner}</span>
                        </>
                    ) : null}
                </span>
            </span>

            {late ? (
                <span className="mt-px shrink-0 rounded-full bg-destructive px-2.5 py-1 text-[0.6875rem] font-extrabold whitespace-nowrap text-destructive-foreground">
                    Telat {item.daysLate} hari
                </span>
            ) : (
                <span className="mt-px shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[0.6875rem] font-extrabold whitespace-nowrap text-primary-deep">
                    Hari ini
                </span>
            )}
        </Link>
    );
}
