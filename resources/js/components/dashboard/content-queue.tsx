import { CalendarPlus } from 'lucide-react';
import { ChannelMarks } from '@/components/content/channel-marks';
import { STATUS_DOT } from '@/components/content/status-mark';
import type { ContentRow, ContentStatus } from '@/data/content';
import { shortDayLabel, timeLabel } from '@/data/content';
import { cn } from '@/lib/utils';

/** One piece of the week's work, with where it sits in the order of urgency. */
export type QueueItem = ContentRow & { rank: number };

export type Queue = {
    items: QueueItem[];
    /** The month the progress line is counting, for the label. */
    weekLabel: string;
    /** How many more the week holds beyond the ones shown. */
    rest: number;
    planned: number;
    published: number;
    late: number;
    stuck: number;
};

/**
 * What the content calendar owes this week.
 *
 * The dashboard's question at nine in the morning is what is due and what has
 * slipped, and this is the half of it the app actually knows: every row here
 * is a real piece with a real date, owner and status, not a sample. Late work
 * appears whatever week it was meant for, because a piece that slipped in
 * March is still owed today.
 *
 * Ordered by urgency rather than by clock: breached, then held up, then due,
 * then already out. A schedule read top to bottom would bury the one thing
 * that needs doing under four that do not.
 */
export function ContentQueue({ queue }: { queue: Queue }) {
    if (queue.items.length === 0) {
        return <QueueEmpty planned={queue.planned} />;
    }

    const share =
        queue.planned > 0 ? (queue.published / queue.planned) * 100 : 0;

    /* The two boundaries the list crosses, each ruled off and named: work
       that belongs to next week, and work that is already out. */
    const firstNext = queue.items.findIndex((item) => item.rank === 3);
    const firstDone = queue.items.findIndex((item) => item.rank === 4);

    return (
        <div>
            <div className="mb-4">
                <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                        <span
                            className="font-bold text-foreground"
                            data-numeric
                        >
                            {queue.published}
                        </span>{' '}
                        dari <span data-numeric>{queue.planned}</span> tayang
                    </span>

                    {/* Only what is actually wrong speaks in red. */}
                    {queue.late > 0 ? (
                        <span className="font-semibold text-destructive">
                            <span data-numeric>{queue.late}</span> terlambat
                            {queue.stuck > 0 ? (
                                <>
                                    {' · '}
                                    <span data-numeric>{queue.stuck}</span>{' '}
                                    tertahan
                                </>
                            ) : null}
                        </span>
                    ) : (
                        <span className="font-semibold text-muted-foreground">
                            {queue.planned - queue.published} tersisa
                        </span>
                    )}
                </div>

                <div
                    className="h-1.5 overflow-hidden rounded-full bg-neutral-soft"
                    role="progressbar"
                    aria-valuenow={queue.published}
                    aria-valuemin={0}
                    aria-valuemax={queue.planned}
                    aria-label="Konten yang sudah tayang minggu ini"
                >
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${share}%` }}
                    />
                </div>
            </div>

            <ul className="flex flex-col gap-0.5">
                {queue.items.map((item, index) => (
                    <li key={item.id}>
                        {index === firstNext ? (
                            <Rule>Minggu depan</Rule>
                        ) : index === firstDone ? (
                            <Rule>Sudah tayang</Rule>
                        ) : null}
                        <QueueRow item={item} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** A named line across the list, where one kind of work becomes another. */
function Rule({ children }: { children: React.ReactNode }) {
    return (
        <p className="mt-3 mb-1.5 flex items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
            {children}
            <span className="h-px flex-1 bg-border" aria-hidden />
        </p>
    );
}

function QueueRow({ item }: { item: QueueItem }) {
    const done = item.rank === 4;
    const held = item.stuck && !item.late;

    return (
        <div
            className={cn(
                '-mx-2 flex items-start gap-3.5 rounded-md px-2.5 py-2.5 transition-colors',
                item.late ? 'bg-destructive-soft' : 'hover:bg-neutral-soft',
            )}
        >
            {/* The day anchors the row: a week reads as a schedule, and the
                hour only matters once you are on the day itself. */}
            <span className="w-[4.5rem] shrink-0 self-center">
                <span
                    className={cn(
                        'block text-[0.8438rem] leading-tight font-extrabold',
                        item.late
                            ? 'text-destructive'
                            : done
                              ? 'text-muted-foreground'
                              : 'text-foreground',
                    )}
                    data-numeric
                >
                    {shortDayLabel(item.scheduledFor)}
                </span>
                {item.scheduledTime ? (
                    <span
                        className="mt-0.5 block text-[0.6875rem] text-muted-foreground"
                        data-numeric
                    >
                        {timeLabel(item.scheduledTime)}
                    </span>
                ) : null}
            </span>

            <span className="min-w-0 flex-1">
                <span
                    className={cn(
                        'line-clamp-2 block text-[0.8438rem] leading-snug font-bold',
                        done && 'text-muted-foreground',
                    )}
                >
                    {item.title}
                </span>

                <span
                    className={cn(
                        'mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs',
                        item.late
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                    )}
                >
                    <ChannelMarks
                        channels={item.channels}
                        tinted={!item.late}
                        max={3}
                    />
                    <span className="truncate">
                        {item.owner ?? 'Belum ada PJ'}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <span
                            className={cn(
                                'size-1.5 shrink-0 rounded-full',
                                STATUS_DOT[item.status as ContentStatus],
                            )}
                            aria-hidden
                        />
                        {item.statusLabel}
                    </span>
                </span>
            </span>

            {item.late ? (
                <span className="mt-px shrink-0 rounded-full bg-destructive px-2.5 py-1 text-[0.6875rem] font-extrabold whitespace-nowrap text-destructive-foreground">
                    Telat {item.daysLate} hari
                </span>
            ) : held ? (
                <span className="mt-px shrink-0 rounded-full bg-destructive-soft px-2.5 py-1 text-[0.6875rem] font-extrabold whitespace-nowrap text-destructive">
                    Tertahan {item.daysInStatus} hari
                </span>
            ) : null}
        </div>
    );
}

function QueueEmpty({ planned }: { planned: number }) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary-deep">
                <CalendarPlus
                    className="size-5"
                    strokeWidth={1.75}
                    aria-hidden
                />
            </span>
            <p className="text-sm font-bold">
                {planned > 0
                    ? 'Semua konten minggu ini sudah tayang'
                    : 'Belum ada konten dijadwalkan minggu ini'}
            </p>
            <p className="max-w-[34ch] text-xs leading-relaxed text-muted-foreground">
                {planned > 0
                    ? 'Tidak ada yang terlambat dan tidak ada yang tertahan.'
                    : 'Buka kalender untuk menaruh rencana minggu ini.'}
            </p>
        </div>
    );
}
