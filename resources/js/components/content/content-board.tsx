import { Link, router } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { Check, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { ChannelMarks } from '@/components/content/channel-marks';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { STATUS_DOT } from '@/components/content/status-mark';
import { ChannelIcon } from '@/components/leads/channel-icon';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ContentRow, ContentStatus } from '@/data/content';
import { shortDayLabel, timeLabel } from '@/data/content';
import type { ChannelKey } from '@/data/dashboard';
import { useContentPlan } from '@/hooks/use-content-plan';
import { cn } from '@/lib/utils';
import { show as contentShow } from '@/routes/content';
import { store as setField } from '@/routes/content/field';
import { store as moveStatus } from '@/routes/content/status';

type Href = NonNullable<InertiaLinkProps['href']>;

/** Movement before a press becomes a drag, so a card is still clickable. */
const THRESHOLD = 6;

/** How close to the board's edge the pointer must get before it scrolls. */
const EDGE = 84;

/** The column a piece falls into when its field is empty. */
const NONE = '__belum__';

export type GroupKey = 'status' | 'channel' | 'pillar' | 'type' | 'pj';

/** What each grouping is called, as the toolbar's control reads it. */
export const GROUPS: { key: GroupKey; label: string }[] = [
    { key: 'status', label: 'Per status' },
    { key: 'channel', label: 'Per channel' },
    { key: 'pillar', label: 'Per pillar' },
    { key: 'type', label: 'Per jenis' },
    { key: 'pj', label: 'Per submitted by' },
];

type Column = {
    key: string;
    label: string;
    rows: ContentRow[];
    /** A channel's own tint, so its column is recognisable at a glance. */
    channel?: ChannelKey;
    status?: ContentStatus;
};

type Carried = {
    item: ContentRow;
    from: string;
    width: number;
    height: number;
    /** Where inside the card the pointer took hold of it. */
    grabX: number;
    grabY: number;
};

/**
 * The month as columns, stacked by whichever field is being asked about.
 *
 * The calendar answers "when"; this answers "how much of what". Grouping by
 * status makes it the production flow, by channel it is the spread across
 * platforms, by pillar it is the editorial mix — the same month, sorted by
 * the question in hand.
 *
 * A card is picked up and carried, on pointer events rather than the HTML5
 * drag API, the way the leads board does it: what you drop is what you were
 * looking at, and it works under a finger.
 *
 * Channel is the one grouping that cannot be dropped into. A piece goes out
 * on several channels at once and so stands in several columns; moving it to
 * one more would say nothing about the rest. Those columns read only, and the
 * form edits the set.
 */
export function ContentBoard({
    items,
    group,
    owners,
    hrefFor,
}: {
    items: ContentRow[];
    group: GroupKey;
    /** Everyone who has a piece to their name, for the Submitted by columns. */
    owners: string[];
    hrefFor: (id: number) => Href;
}) {
    const plan = useContentPlan();
    const [carried, setCarried] = useState<Carried | null>(null);
    const [over, setOver] = useState<string | null>(null);

    const scroller = useRef<HTMLDivElement>(null);
    const ghost = useRef<HTMLDivElement>(null);
    const point = useRef({ x: 0, y: 0 });
    const speed = useRef(0);
    const frame = useRef<number | null>(null);
    /** Set for the click that follows a drag, so the card does not also open. */
    const dragged = useRef(false);

    const columns = buildColumns(items, group, plan, owners);
    const movable = group !== 'channel';

    const move = (item: ContentRow, to: string) => {
        if (group === 'status') {
            /*
             | Going live records a date and a link. Both belong with the
             | piece, so publishing is done from it and not by dropping a card
             | into a column.
             */
            if (to === 'published') {
                toast.error('Tayangkan dari kontennya', {
                    description: `Buka ${item.title} untuk mencatat tanggal dan tautannya.`,
                    action: {
                        label: 'Buka konten',
                        onClick: () => router.visit(contentShow(item.id)),
                    },
                });

                return;
            }

            router.post(
                moveStatus(item.id).url,
                { status: to },
                { preserveScroll: true, preserveState: true },
            );

            return;
        }

        router.post(
            setField(item.id).url,
            {
                field: group === 'pj' ? 'owner' : group,
                value: to === NONE ? '' : to,
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    /** Follows the pointer without a re-render: the board holds many cards. */
    const place = (node: HTMLDivElement | null, held: Carried) => {
        if (!node) {
            return;
        }

        node.style.transform = `translate3d(${point.current.x - held.grabX}px, ${point.current.y - held.grabY}px, 0)`;
    };

    const columnAt = (x: number, y: number) =>
        document
            .elementFromPoint(x, y)
            ?.closest('[data-column]')
            ?.getAttribute('data-column') ?? null;

    /** Reaching the far columns means the board has to come to the pointer. */
    const scrollTick = () => {
        const el = scroller.current;

        if (el && speed.current !== 0) {
            el.scrollLeft += speed.current;
        }

        frame.current = requestAnimationFrame(scrollTick);
    };

    const start = (
        event: React.PointerEvent<HTMLElement>,
        item: ContentRow,
        from: string,
    ) => {
        if (event.button !== 0 || !movable) {
            return;
        }

        const card = event.currentTarget;
        const box = card.getBoundingClientRect();
        const origin = { x: event.clientX, y: event.clientY };

        let held: Carried | null = null;

        const onMove = (moved: PointerEvent) => {
            point.current = { x: moved.clientX, y: moved.clientY };

            if (!held) {
                const travelled = Math.hypot(
                    moved.clientX - origin.x,
                    moved.clientY - origin.y,
                );

                if (travelled < THRESHOLD) {
                    return;
                }

                held = {
                    item,
                    from,
                    width: box.width,
                    height: box.height,
                    grabX: origin.x - box.left,
                    grabY: origin.y - box.top,
                };

                dragged.current = true;
                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
                setCarried(held);
                frame.current = requestAnimationFrame(scrollTick);
            }

            place(ghost.current, held);
            setOver(columnAt(moved.clientX, moved.clientY));

            const board = scroller.current?.getBoundingClientRect();

            speed.current = !board
                ? 0
                : moved.clientX < board.left + EDGE
                  ? -Math.ceil((board.left + EDGE - moved.clientX) / 5)
                  : moved.clientX > board.right - EDGE
                    ? Math.ceil((moved.clientX - board.right + EDGE) / 5)
                    : 0;
        };

        const stop = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            window.removeEventListener('keydown', onKey);

            if (frame.current !== null) {
                cancelAnimationFrame(frame.current);
                frame.current = null;
            }

            speed.current = 0;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setCarried(null);
            setOver(null);

            /*
             | The click that follows a release is swallowed, but only that one:
             | a drag ending nowhere must not disarm the next card's link.
             */
            setTimeout(() => {
                dragged.current = false;
            }, 0);
        };

        const onUp = (up: PointerEvent) => {
            const target = held ? columnAt(up.clientX, up.clientY) : null;
            const dropped = held;

            stop();

            if (dropped && target && target !== dropped.from) {
                move(dropped.item, target);
            }
        };

        const onCancel = () => stop();

        const onKey = (key: KeyboardEvent) => {
            if (key.key === 'Escape') {
                held = null;
                stop();
            }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        window.addEventListener('keydown', onKey);
    };

    return (
        <>
            <div
                ref={scroller}
                className={cn(
                    'scroll-slim -mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6',
                    /* A finger swipes column to column on a phone; the edge
                       auto-scroll during a drag must not be snapped back. */
                    carried
                        ? 'snap-none'
                        : 'snap-x snap-mandatory scroll-pl-4 md:snap-none',
                )}
            >
                <div className="flex min-w-max gap-3.5">
                    {columns.map((column) => {
                        const isTarget =
                            over === column.key &&
                            carried !== null &&
                            carried.from !== column.key;

                        return (
                            <section
                                key={column.key}
                                data-column={movable ? column.key : undefined}
                                aria-label={`${column.label}, ${column.rows.length} konten`}
                                className={cn(
                                    'flex w-[min(17.5rem,100vw-3.5rem)] shrink-0 snap-start flex-col rounded-xl transition-colors duration-150',
                                    isTarget
                                        ? 'bg-primary-soft'
                                        : 'bg-neutral-soft/80',
                                )}
                            >
                                {/* Quiet header: the column is named and counted,
                                    and its own mark says which vocabulary it is
                                    a word from. */}
                                <header className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
                                    {column.status ? (
                                        <span
                                            className={cn(
                                                'h-4 w-1.5 shrink-0 rounded-full',
                                                STATUS_DOT[column.status],
                                            )}
                                            aria-hidden
                                        />
                                    ) : column.channel ? (
                                        <ChannelIcon
                                            channel={column.channel}
                                            className={cn(
                                                'size-3.5 shrink-0',
                                                CHANNEL_TONE[column.channel]
                                                    .text,
                                            )}
                                        />
                                    ) : null}

                                    <span className="min-w-0 flex-1 truncate text-sm font-extrabold tracking-[-0.01em]">
                                        {column.label}
                                    </span>

                                    <span
                                        className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[0.6875rem] font-extrabold text-secondary-foreground shadow-lift"
                                        data-numeric
                                    >
                                        {column.rows.length}
                                    </span>
                                </header>

                                <div className="scroll-slim flex max-h-[36rem] flex-col gap-2 overflow-y-auto px-2.5 pt-1 pb-2.5">
                                    {isTarget ? (
                                        <p className="rounded-lg border border-dashed border-primary bg-card/60 px-3 py-5 text-center text-xs font-bold text-primary-deep">
                                            Lepas di sini
                                        </p>
                                    ) : null}

                                    {column.rows.length === 0 && !isTarget ? (
                                        <p className="px-1 py-7 text-center text-xs leading-relaxed text-muted-foreground">
                                            Belum ada konten di sini.
                                        </p>
                                    ) : null}

                                    {column.rows.map((item) =>
                                        carried?.item.id === item.id &&
                                        carried.from === column.key ? (
                                            /* The hole the card came out of, so
                                               the column does not close up and
                                               the drop has somewhere to return. */
                                            <div
                                                key={item.id}
                                                style={{
                                                    height: carried.height,
                                                }}
                                                className="shrink-0 rounded-lg border border-dashed border-border bg-card/40"
                                                aria-hidden
                                            />
                                        ) : (
                                            <BoardCard
                                                key={item.id}
                                                item={item}
                                                group={group}
                                                movable={movable}
                                                inert={carried !== null}
                                                href={hrefFor(item.id)}
                                                onPointerDown={(event) =>
                                                    start(
                                                        event,
                                                        item,
                                                        column.key,
                                                    )
                                                }
                                                onClickCapture={(event) => {
                                                    if (dragged.current) {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        dragged.current = false;
                                                    }
                                                }}
                                                columns={columns}
                                                onMove={move}
                                            />
                                        ),
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            {/* Carried above everything, out of the column's own scroll box. */}
            {carried
                ? createPortal(
                      <div
                          ref={(node) => {
                              ghost.current = node;
                              place(node, carried);
                          }}
                          style={{ width: carried.width }}
                          className="pointer-events-none fixed top-0 left-0 z-50 will-change-transform"
                          aria-hidden
                      >
                          <div
                              style={{
                                  transform: 'rotate(2.5deg) scale(1.03)',
                              }}
                              className="animate-pick-up rounded-lg border border-primary/40 bg-card px-3.5 py-3 shadow-carry"
                          >
                              <CardBody item={carried.item} group={group} />
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </>
    );
}

/**
 * The month sorted into columns.
 *
 * Every column the vocabulary defines is drawn, empty or not: a month with no
 * Testimonial and no Story is a fact about the month, and a column that only
 * appears once something lands in it can never be dropped into.
 */
function buildColumns(
    items: ContentRow[],
    group: GroupKey,
    plan: ReturnType<typeof useContentPlan>,
    owners: string[],
): Column[] {
    if (group === 'status') {
        return plan.statuses.map((status) => ({
            key: status.key,
            label: status.label,
            status: status.key as ContentStatus,
            rows: items.filter((item) => item.status === status.key),
        }));
    }

    if (group === 'channel') {
        return Object.entries(plan.channels).map(([key, label]) => ({
            key,
            label,
            channel: key as ChannelKey,
            /* One piece, several columns: it really is in all of them. */
            rows: items.filter((item) =>
                item.channels.includes(key as ChannelKey),
            ),
        }));
    }

    if (group === 'type') {
        return Object.entries(plan.types).map(([key, label]) => ({
            key,
            label,
            rows: items.filter((item) => item.type === key),
        }));
    }

    const [defined, valueOf] =
        group === 'pillar'
            ? [Object.entries(plan.pillars), (item: ContentRow) => item.pillar]
            : [
                  owners.map((name) => [name, name] as [string, string]),
                  (item: ContentRow) => item.owner,
              ];

    return [
        ...defined.map(([key, label]) => ({
            key,
            label,
            rows: items.filter((item) => valueOf(item) === key),
        })),
        {
            key: NONE,
            label: 'Belum ditentukan',
            rows: items.filter((item) => !valueOf(item)),
        },
    ];
}

function BoardCard({
    item,
    group,
    movable,
    inert,
    href,
    columns,
    onPointerDown,
    onClickCapture,
    onMove,
}: {
    item: ContentRow;
    group: GroupKey;
    movable: boolean;
    /** True while another card is in the air. */
    inert: boolean;
    href: Href;
    columns: Column[];
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onClickCapture: (event: React.MouseEvent) => void;
    onMove: (item: ContentRow, to: string) => void;
}) {
    return (
        <article
            onPointerDown={onPointerDown}
            onClickCapture={onClickCapture}
            /* Vertical panning still scrolls the column; sideways is ours. */
            style={{ touchAction: 'pan-y' }}
            className={cn(
                'group/card shrink-0 rounded-lg border bg-card px-3.5 py-3 shadow-lift transition-[box-shadow,border-color] duration-200 select-none hover:shadow-lift-lg',
                movable
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-default',
                item.late
                    ? 'border-destructive/30 hover:border-destructive/50'
                    : 'border-border hover:border-primary/35',
                /* While a card is in the air the others stop reacting: the
                   column underneath is the drop target, and a link that
                   prefetches on hover must not fire once per card crossed. */
                inert && 'pointer-events-none',
            )}
        >
            <CardBody
                item={item}
                group={group}
                href={href}
                columns={movable ? columns : undefined}
                onMove={onMove}
            />
        </article>
    );
}

/**
 * The card's face, shared by the one in the column and the one in the hand, so
 * what you pick up is exactly what you were looking at.
 *
 * It never repeats the column it is standing in: grouped by channel the marks
 * would say what the header already said, and the room goes to what the column
 * cannot tell you.
 */
function CardBody({
    item,
    group,
    href,
    columns,
    onMove,
}: {
    item: ContentRow;
    group: GroupKey;
    href?: Href;
    columns?: Column[];
    onMove?: (item: ContentRow, to: string) => void;
}) {
    return (
        <>
            <p className="flex items-start gap-2">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
                    {group === 'channel' ? null : (
                        <ChannelMarks channels={item.channels} max={3} />
                    )}
                    <span className="truncate rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold text-secondary-foreground">
                        {group === 'type' ? item.statusLabel : item.typeLabel}
                    </span>
                </span>

                {columns && onMove ? (
                    <MoveMenu item={item} columns={columns} onMove={onMove} />
                ) : null}
            </p>

            <h3 className="mt-2 text-sm leading-snug font-bold">
                {href ? (
                    <Link
                        href={href}
                        only={['selected']}
                        preserveState
                        preserveScroll
                        draggable={false}
                        className="line-clamp-2 underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                    >
                        {item.title}
                    </Link>
                ) : (
                    <span className="line-clamp-2 block">{item.title}</span>
                )}
            </h3>

            <p className="mt-2.5 flex items-center gap-2 text-xs">
                {/* The column already says one of these; the dot fills in the
                    status wherever the column is not about status. */}
                {group === 'status' ? null : (
                    <span
                        className={cn(
                            'size-2 shrink-0 rounded-full',
                            STATUS_DOT[item.status],
                        )}
                        title={item.statusLabel}
                        aria-hidden
                    />
                )}

                <span className="min-w-0 truncate text-muted-foreground">
                    <span className="font-bold text-foreground" data-numeric>
                        {shortDayLabel(item.scheduledFor)}
                        {item.scheduledTime
                            ? `, ${timeLabel(item.scheduledTime)}`
                            : ''}
                    </span>
                    {group === 'pj' ? '' : ` · ${item.owner ?? 'Belum ada PJ'}`}
                </span>

                {item.late ? (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-bold text-destructive">
                        <span
                            className="size-1.5 rounded-full bg-destructive"
                            aria-hidden
                        />
                        <span data-numeric>{item.daysLate} hari</span>
                    </span>
                ) : item.stuck ? (
                    <span className="ml-auto shrink-0 font-bold text-destructive">
                        Tertahan
                    </span>
                ) : null}
            </p>
        </>
    );
}

/**
 * Moving a card without dragging it. A menu rather than a pair of arrows: one
 * quiet control instead of two heavy ones, it reaches any column instead of
 * only the neighbours, and it works by touch and keyboard where dragging
 * cannot. Radix portals it out, so the column's own scroll never clips it.
 */
function MoveMenu({
    item,
    columns,
    onMove,
}: {
    item: ContentRow;
    columns: Column[];
    onMove: (item: ContentRow, to: string) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    // The menu is not a handle: pressing it must not pick the card up.
                    onPointerDown={(event) => event.stopPropagation()}
                    className="-mt-0.5 -mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-60 transition-[opacity,background-color,color] group-hover/card:opacity-100 hover:bg-neutral-soft hover:text-foreground focus-visible:opacity-100"
                >
                    <MoreHorizontal className="size-4" strokeWidth={2.5} />
                    <span className="sr-only">
                        Pindahkan {item.title} ke kolom lain
                    </span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">
                    Pindah ke kolom
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((column) => {
                    const current = column.rows.some(
                        (row) => row.id === item.id,
                    );

                    return (
                        <DropdownMenuItem
                            key={column.key}
                            disabled={current}
                            onSelect={() => onMove(item, column.key)}
                            className="gap-2"
                        >
                            {column.status ? (
                                <span
                                    className={cn(
                                        'size-2 shrink-0 rounded-full',
                                        STATUS_DOT[column.status],
                                    )}
                                    aria-hidden
                                />
                            ) : null}
                            {column.label}
                            {current ? (
                                <Check
                                    className="ml-auto size-3.5"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
