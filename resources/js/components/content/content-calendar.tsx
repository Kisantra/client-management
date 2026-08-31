import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { ChannelIcon } from '@/components/leads/channel-icon';
import type { ContentMonth, ContentRow } from '@/data/content';
import { toIso } from '@/data/content';
import { CHANNEL_LABELS } from '@/data/dashboard';
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
                    className="rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-primary-deep"
                >
                    +{rest} lagi
                </Link>
            ) : null}
        </div>
    );
}

function CalendarChip({ item, href }: { item: ContentRow; href: Href }) {
    return (
        <Link
            href={href}
            only={['selected']}
            preserveState
            preserveScroll
            title={`${item.title} · ${CHANNEL_LABELS[item.channel]} · ${item.statusLabel}${item.late ? ` · telat ${item.daysLate} hari` : ''}`}
            className={cn(
                'flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[0.6875rem] font-bold transition-[filter] hover:brightness-95',
                item.late
                    ? 'bg-destructive-soft text-destructive'
                    : item.status === 'published'
                      ? CHANNEL_TONE[item.channel].filled
                      : CHANNEL_TONE[item.channel].outlined,
            )}
        >
            <ChannelIcon channel={item.channel} className="size-3 shrink-0" />
            <span className="truncate">{item.title}</span>
        </Link>
    );
}
