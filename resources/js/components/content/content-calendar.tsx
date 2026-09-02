import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { ChannelMarks, channelNames } from '@/components/content/channel-marks';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { STATUS_DOT } from '@/components/content/status-mark';
import type { ContentMonth, ContentRow } from '@/data/content';
import { toIso } from '@/data/content';
import { asDate } from '@/data/leads';
import { cn } from '@/lib/utils';

type Href = NonNullable<InertiaLinkProps['href']>;

/** Monday first: the team's week starts when the office does. */
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** Chips a cell shows before it folds the rest behind "+N". */
const SHOWN = 3;

type Props = {
    month: ContentMonth;
    items: ContentRow[];
    /** Opens the form on the day that was clicked. */
    onAdd: (date: string) => void;
    /** The list, narrowed to one day, for a cell with more than it can show. */
    moreHref: (date: string) => Href;
    /** The calendar with this piece's panel open. */
    hrefFor: (id: number) => Href;
};

/**
 * The month as a grid, one cell per day, each piece a chip in its status.
 *
 * Reading width only: seven columns of titles are unusable on a phone, where
 * the agenda takes over with the same facts stacked.
 */
export function ContentCalendar({
    month,
    items,
    onAdd,
    moreHref,
    hrefFor,
}: Props) {
    const first = asDate(month.start);
    const daysInMonth = asDate(month.end).getDate();
    // getDay() counts from Sunday; the grid counts from Monday.
    const lead = (first.getDay() + 6) % 7;

    const cells: (string | null)[] = Array<null>(lead).fill(null);

    for (let day = 1; day <= daysInMonth; day++) {
        cells.push(toIso(new Date(first.getFullYear(), first.getMonth(), day)));
    }

    while (cells.length % 7 !== 0) {
        cells.push(null);
    }

    const byDay = new Map<string, ContentRow[]>();

    for (const item of items) {
        byDay.set(item.scheduledFor, [
            ...(byDay.get(item.scheduledFor) ?? []),
            item,
        ]);
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lift">
            <div
                className="grid grid-cols-7 border-b border-border"
                aria-hidden
            >
                {WEEKDAYS.map((name, index) => (
                    <div
                        key={name}
                        className={cn(
                            'px-2 py-2 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase',
                            index >= 5 && 'bg-neutral-soft/40',
                        )}
                    >
                        {name}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7" role="list">
                {cells.map((date, index) =>
                    date === null ? (
                        <div
                            key={`pad-${index}`}
                            className="min-h-[7.5rem] border-r border-b border-border bg-neutral-soft/30 [&:nth-child(7n)]:border-r-0"
                            aria-hidden
                        />
                    ) : (
                        <DayCell
                            key={date}
                            date={date}
                            today={month.today}
                            weekend={index % 7 >= 5}
                            items={byDay.get(date) ?? []}
                            onAdd={onAdd}
                            moreHref={moreHref}
                            hrefFor={hrefFor}
                        />
                    ),
                )}
            </div>
        </div>
    );
}

function DayCell({
    date,
    today,
    weekend,
    items,
    onAdd,
    moreHref,
    hrefFor,
}: {
    date: string;
    today: string;
    weekend: boolean;
    items: ContentRow[];
    onAdd: (date: string) => void;
    moreHref: (date: string) => Href;
    hrefFor: (id: number) => Href;
}) {
    const isToday = date === today;
    const past = date < today;
    const shown = items.slice(0, SHOWN);
    const rest = items.length - shown.length;

    return (
        <div
            role="listitem"
            className={cn(
                'group/day flex min-h-[7.5rem] min-w-0 flex-col gap-1 border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0',
                weekend && 'bg-neutral-soft/40',
            )}
        >
            <div className="flex items-center justify-between">
                <span
                    className={cn(
                        'grid size-6 place-items-center rounded-full text-xs font-bold',
                        isToday
                            ? 'bg-primary text-primary-foreground'
                            : past
                              ? 'text-muted-foreground'
                              : 'text-secondary-foreground',
                    )}
                    data-numeric
                >
                    {asDate(date).getDate()}
                    {isToday ? (
                        <span className="sr-only"> (hari ini)</span>
                    ) : null}
                </span>

                {/* Quiet until the cell is pointed at; always there for a keyboard. */}
                <button
                    type="button"
                    onClick={() => onAdd(date)}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color,color] group-hover/day:opacity-100 hover:bg-primary-soft hover:text-primary-deep focus-visible:opacity-100"
                >
                    <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
                    <span className="sr-only">Tambah konten pada {date}</span>
                </button>
            </div>

            {shown.map((item) => (
                <CalendarChip
                    key={item.id}
                    item={item}
                    href={hrefFor(item.id)}
                />
            ))}

            {rest > 0 ? (
                <Link
                    href={moreHref(date)}
                    className="rounded-sm px-1.5 py-1 text-[0.6875rem] font-bold text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-primary-deep"
                >
                    +{rest} lagi
                </Link>
            ) : null}
        </div>
    );
}

/**
 * One piece in a day cell.
 *
 * A cell is 150-odd pixels wide, so everything here fights for the title: the
 * channels are marks rather than words, and the status is a dot. A piece that
 * is live settles into its channel's tint; one still owed is a dashed card,
 * which is what separates the two in grey as well as in colour — the tints
 * are too close in value to carry a state by themselves.
 *
 * A piece on several channels takes the tint of the first: a card striped
 * three ways reads as decoration, and the marks beside it already say the
 * rest.
 */
function CalendarChip({ item, href }: { item: ContentRow; href: Href }) {
    const tone = CHANNEL_TONE[item.channels[0] ?? 'instagram'];
    const published = item.status === 'published' && !item.late;

    return (
        <Link
            href={href}
            only={['selected']}
            preserveState
            preserveScroll
            title={`${item.title} · ${channelNames(item.channels)} · ${item.typeLabel} · ${item.statusLabel}${item.late ? ` · telat ${item.daysLate} hari` : ''}`}
            className={cn(
                'flex min-w-0 items-center gap-1.5 rounded-sm border px-1.5 py-1.5 text-[0.6875rem] leading-none font-bold transition-[background-color,border-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                item.late
                    ? 'border-destructive/25 bg-destructive-soft text-destructive hover:border-destructive/45'
                    : published
                      ? cn('border-transparent hover:shadow-lift', tone.filled)
                      : 'border-dashed border-muted-foreground/35 bg-card text-foreground hover:border-primary/50 hover:shadow-lift',
            )}
        >
            {/* Off its own bed the marks have to carry the channels alone, so
                they take the channel's ink rather than the card's. */}
            <span className="flex shrink-0 items-center gap-0.5">
                <ChannelMarks
                    channels={item.channels}
                    tinted={!published && !item.late}
                    max={2}
                />
            </span>

            <span className="truncate">{item.title}</span>

            {/* Only what is still owed carries a status; late says it in red.
                Full-size, because the draft tone is pale enough that a smaller
                dot disappears into the card under it. */}
            {published || item.late ? null : (
                <span
                    className={cn(
                        'ml-auto size-2 shrink-0 rounded-full',
                        STATUS_DOT[item.status],
                    )}
                    aria-hidden
                />
            )}
        </Link>
    );
}
