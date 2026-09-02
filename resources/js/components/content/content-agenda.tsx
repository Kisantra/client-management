import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { ChannelMarks } from '@/components/content/channel-marks';
import {
    LateMark,
    STATUS_DOT,
    StatusPill,
} from '@/components/content/status-mark';
import type { ContentRow } from '@/data/content';
import { dayLabel, timeLabel } from '@/data/content';
import { CHANNEL_LABELS } from '@/data/dashboard';
import { cn } from '@/lib/utils';

/**
 * The month as a list, grouped by day: what the calendar shows in cells,
 * stacked. The phone's only view, and the desktop's "Daftar".
 */
type Href = NonNullable<InertiaLinkProps['href']>;

export function ContentAgenda({
    items,
    today,
    hrefFor,
}: {
    items: ContentRow[];
    today: string;
    /** The calendar with this piece's panel open. */
    hrefFor: (id: number) => Href;
}) {
    const days = new Map<string, ContentRow[]>();

    for (const item of items) {
        days.set(item.scheduledFor, [
            ...(days.get(item.scheduledFor) ?? []),
            item,
        ]);
    }

    return (
        <ol className="flex flex-col gap-5">
            {Array.from(days.entries()).map(([date, rows]) => {
                const isToday = date === today;

                return (
                    <li key={date}>
                        <h3 className="mb-1 flex items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                            <span
                                className={cn(isToday && 'text-primary-deep')}
                            >
                                {dayLabel(date)}
                            </span>
                            {isToday ? (
                                <span className="rounded-full bg-primary px-1.5 py-px text-[0.6875rem] font-extrabold text-primary-foreground">
                                    Hari ini
                                </span>
                            ) : null}
                            <span
                                className="h-px flex-1 bg-border"
                                aria-hidden
                            />
                        </h3>

                        <ul className="flex flex-col">
                            {rows.map((item) => (
                                <li key={item.id}>
                                    <AgendaRow
                                        item={item}
                                        href={hrefFor(item.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    </li>
                );
            })}
        </ol>
    );
}

function AgendaRow({ item, href }: { item: ContentRow; href: Href }) {
    return (
        <Link
            href={href}
            only={['selected']}
            preserveState
            preserveScroll
            className={cn(
                '-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-neutral-soft',
                item.late && 'bg-destructive-soft/60 hover:bg-destructive-soft',
            )}
        >
            <span
                className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    STATUS_DOT[item.status],
                )}
                aria-hidden
            />

            {/* A day read as a list is a running order, so the hour leads it.
                The slot holds its width either way, so titles stay aligned. */}
            <span
                className={cn(
                    'w-11 shrink-0 text-xs font-bold tabular-nums',
                    item.scheduledTime
                        ? 'text-secondary-foreground'
                        : 'text-muted-foreground',
                )}
                data-numeric
            >
                {timeLabel(item.scheduledTime) ?? '—'}
            </span>

            <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8438rem] font-bold">
                    {item.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {/* One channel is worth naming; a set of them is already
                        said by its marks, and the words would crowd the row. */}
                    <span className="inline-flex items-center gap-1">
                        <ChannelMarks channels={item.channels} />
                        {item.channels.length === 1
                            ? CHANNEL_LABELS[item.channels[0]]
                            : null}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{item.typeLabel}</span>
                    <span aria-hidden>·</span>
                    <span>{item.owner ?? 'Belum ada PJ'}</span>
                    {item.leads ? (
                        <>
                            <span aria-hidden>·</span>
                            <span
                                className="font-semibold text-secondary-foreground"
                                data-numeric
                            >
                                {item.leads} lead
                            </span>
                        </>
                    ) : null}
                    {item.stuck && !item.late ? (
                        <>
                            <span aria-hidden>·</span>
                            <span className="font-semibold text-destructive">
                                tertahan {item.daysInStatus} hari
                            </span>
                        </>
                    ) : null}
                </span>
            </span>

            <span className="hidden shrink-0 sm:block">
                {item.late ? (
                    <LateMark days={item.daysLate} />
                ) : (
                    <StatusPill status={item.status} />
                )}
            </span>
            {item.late ? (
                <span className="shrink-0 sm:hidden">
                    <LateMark days={item.daysLate} />
                </span>
            ) : null}

            <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={2}
                aria-hidden
            />
        </Link>
    );
}
