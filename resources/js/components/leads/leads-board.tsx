import { Link, router } from '@inertiajs/react';
import { Check, MoreHorizontal, Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { STAGE_DOT } from '@/components/leads/stage-mark';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CHANNEL_LABELS } from '@/data/dashboard';
import { shortRupiah } from '@/data/leads';
import type { Lead } from '@/data/leads';
import { usePipeline, useStageRequirement } from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { show as leadShow } from '@/routes/leads';
import { store as moveStage } from '@/routes/leads/stage';

/** How many more cards a column asks for each time it is opened up. */
const STEP = 20;

/** Movement before a press becomes a drag, so a card is still clickable. */
const THRESHOLD = 6;

/** How close to the board's edge the pointer must get before it scrolls. */
const EDGE = 84;

export type BoardColumn = {
    key: string;
    label: string;
    /** Everything in this stage, counted in the database, not on screen. */
    count: number;
    stalled: number;
    value: number;
    rows: Lead[];
};

type Carried = {
    lead: Lead;
    from: string;
    width: number;
    height: number;
    /** Where inside the card the pointer took hold of it. */
    grabX: number;
    grabY: number;
};

type Props = {
    columns: BoardColumn[];
    loadMore: (stage: string, per: number) => void;
};

/**
 * The pipeline as columns, with cards you pick up rather than cards that fade.
 *
 * Dragging is written on pointer events instead of the HTML5 drag API: that API
 * hands the browser a translucent snapshot and gives nothing back, and it does
 * not exist on touch at all. Carrying the card ourselves means it can tilt, cast
 * its own shadow, leave a hole where it was, and work under a finger.
 */
export function LeadsBoard({ columns, loadMore }: Props) {
    const [carried, setCarried] = useState<Carried | null>(null);
    const [over, setOver] = useState<string | null>(null);

    const requirementFor = useStageRequirement();

    const scroller = useRef<HTMLDivElement>(null);
    const ghost = useRef<HTMLDivElement>(null);
    const point = useRef({ x: 0, y: 0 });
    const speed = useRef(0);
    const frame = useRef<number | null>(null);
    /** Set for the click that follows a drag, so the card does not also open. */
    const dragged = useRef(false);

    const move = (lead: Lead, toStage: string) => {
        const requirement = requirementFor(toStage);

        /*
         | A gated stage cannot be entered from here: the document that proves
         | the move belongs with the lead, not dropped into a column.
         */
        if (requirement) {
            toast.error(`${requirement.label} belum dilampirkan`, {
                description: `Buka ${lead.company} untuk melampirkannya sebelum pindah tahap.`,
                action: {
                    label: 'Buka lead',
                    onClick: () => router.visit(leadShow(lead.id)),
                },
            });

            return;
        }

        router.post(
            moveStage(lead.id).url,
            { stage: toStage },
            { preserveScroll: true },
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
            ?.closest('[data-stage]')
            ?.getAttribute('data-stage') ?? null;

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
        lead: Lead,
        from: string,
    ) => {
        if (event.button !== 0) {
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
                    lead,
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
                move(dropped.lead, target);
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
                <div className="flex min-w-max gap-4">
                    {columns.map((column) => {
                        const rest = column.count - column.rows.length;
                        const isTarget =
                            over === column.key &&
                            carried !== null &&
                            carried.from !== column.key;

                        return (
                            <section
                                key={column.key}
                                data-stage={column.key}
                                aria-label={`${column.label}, ${column.count} lead`}
                                className={cn(
                                    'flex w-[min(19rem,100vw-3.5rem)] shrink-0 snap-start flex-col rounded-xl transition-colors duration-150',
                                    isTarget
                                        ? 'bg-primary-soft'
                                        : 'bg-neutral-soft/80',
                                )}
                            >
                                {/* Quiet header: the column is named and counted, and
                                    its weight reads underneath without shouting. */}
                                <header className="px-3.5 pt-3.5 pb-2.5">
                                    <p className="flex items-center gap-2.5">
                                        <span
                                            className={cn(
                                                'h-4 w-1.5 shrink-0 rounded-full',
                                                STAGE_DOT[column.key],
                                            )}
                                            aria-hidden
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm font-extrabold tracking-[-0.01em]">
                                            {column.label}
                                        </span>
                                        <span
                                            className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[0.6875rem] font-extrabold text-secondary-foreground shadow-lift"
                                            data-numeric
                                        >
                                            {column.count}
                                        </span>
                                    </p>

                                    <p className="mt-2 flex items-center gap-2 pl-4 text-[0.6875rem]">
                                        <span
                                            className="font-semibold text-muted-foreground"
                                            data-numeric
                                        >
                                            {shortRupiah(column.value)}
                                        </span>
                                        {column.stalled > 0 ? (
                                            <span
                                                className="rounded-full bg-destructive-soft px-1.5 py-0.5 font-extrabold text-destructive"
                                                data-numeric
                                            >
                                                {column.stalled} mandek
                                            </span>
                                        ) : null}
                                    </p>
                                </header>

                                <div className="scroll-slim flex max-h-[38rem] flex-col gap-2 overflow-y-auto px-2.5 pt-1 pb-2.5">
                                    {isTarget ? (
                                        <p className="rounded-lg border border-dashed border-primary bg-card/60 px-3 py-5 text-center text-xs font-bold text-primary-deep">
                                            Lepas di sini
                                        </p>
                                    ) : null}

                                    {column.rows.length === 0 && !isTarget ? (
                                        <p className="px-1 py-8 text-center text-xs leading-relaxed text-muted-foreground">
                                            Belum ada lead di tahap ini.
                                        </p>
                                    ) : null}

                                    {column.rows.map((lead) =>
                                        carried?.lead.id === lead.id ? (
                                            /* The hole the card came out of, so
                                               the column does not close up and
                                               the drop has somewhere to return. */
                                            <div
                                                key={lead.id}
                                                style={{
                                                    height: carried.height,
                                                }}
                                                className="shrink-0 rounded-lg border border-dashed border-border bg-card/40"
                                                aria-hidden
                                            />
                                        ) : (
                                            <BoardCard
                                                key={lead.id}
                                                lead={lead}
                                                inert={carried !== null}
                                                onPointerDown={(event) =>
                                                    start(
                                                        event,
                                                        lead,
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
                                                onMove={move}
                                            />
                                        ),
                                    )}

                                    {rest > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                loadMore(
                                                    column.key,
                                                    column.rows.length + STEP,
                                                )
                                            }
                                            className="rounded-lg px-3 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-card hover:text-primary-deep"
                                        >
                                            Muat {Math.min(rest, STEP)} lagi ·{' '}
                                            {rest} tersisa
                                        </button>
                                    ) : null}
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
                              <CardBody lead={carried.lead} />
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </>
    );
}

function BoardCard({
    lead,
    inert,
    onPointerDown,
    onClickCapture,
    onMove,
}: {
    lead: Lead;
    /** True while another card is in the air. */
    inert: boolean;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onClickCapture: (event: React.MouseEvent) => void;
    onMove: (lead: Lead, toStage: string) => void;
}) {
    return (
        <article
            onPointerDown={onPointerDown}
            onClickCapture={onClickCapture}
            /* Vertical panning still scrolls the column; sideways is ours. */
            style={{ touchAction: 'pan-y' }}
            className={cn(
                'group/card shrink-0 cursor-grab rounded-lg border border-border bg-card px-3.5 py-3 shadow-lift transition-[box-shadow,border-color] duration-200 select-none hover:border-primary/35 hover:shadow-lift-lg active:cursor-grabbing',
                /* While a card is in the air the others stop reacting: the
                   column underneath is the drop target, and a link that
                   prefetches on hover must not fire once per card crossed. */
                inert && 'pointer-events-none',
            )}
        >
            <CardBody lead={lead} onMove={onMove} />
        </article>
    );
}

/**
 * The card's face, shared by the one in the column and the one in the hand, so
 * what you pick up is exactly what you were looking at.
 */
function CardBody({
    lead,
    onMove,
}: {
    lead: Lead;
    onMove?: (lead: Lead, toStage: string) => void;
}) {
    return (
        <>
            {/* A bounded chip parses faster than another run of grey text. */}
            <p className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-neutral-soft py-0.5 pr-2.5 pl-1.5 text-[0.6875rem] font-bold text-secondary-foreground">
                        <ChannelIcon channel={lead.channel} />
                        <span className="truncate">
                            {CHANNEL_LABELS[lead.channel]}
                        </span>
                    </span>
                </span>
                {onMove ? <StageMenu lead={lead} onMove={onMove} /> : null}
            </p>

            <h3 className="mt-2 text-sm leading-snug font-bold">
                {onMove ? (
                    <Link
                        href={leadShow(lead.id)}
                        prefetch
                        draggable={false}
                        className="line-clamp-2 underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                    >
                        {lead.company}
                    </Link>
                ) : (
                    <span className="line-clamp-2 block">{lead.company}</span>
                )}
            </h3>

            <p className="mt-1 truncate text-xs text-muted-foreground">
                {lead.source}
            </p>

            <p className="mt-3 flex items-center gap-2 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">
                    <span className="font-bold text-foreground" data-numeric>
                        {shortRupiah(lead.value)}
                    </span>{' '}
                    · {lead.pic}
                </span>

                {lead.stalled ? (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-bold text-destructive">
                        <span
                            className="size-1.5 rounded-full bg-destructive"
                            aria-hidden
                        />
                        <span data-numeric>{lead.daysInStage} hari</span>
                    </span>
                ) : (
                    <span
                        className="ml-auto shrink-0 text-muted-foreground"
                        data-numeric
                    >
                        {lead.daysInStage} hari
                    </span>
                )}
            </p>
        </>
    );
}

/**
 * Moving a card without dragging it. A menu rather than a pair of arrows: one
 * quiet control instead of two heavy ones, it reaches any stage instead of only
 * the neighbours, and it works by touch and keyboard where dragging cannot.
 * Radix portals it out, so the column's own scroll never clips it.
 */
function StageMenu({
    lead,
    onMove,
}: {
    lead: Lead;
    onMove: (lead: Lead, toStage: string) => void;
}) {
    const { stages } = usePipeline();
    const requirementFor = useStageRequirement();

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
                        Pindahkan {lead.company} ke tahap lain
                    </span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">
                    Pindah ke tahap
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {stages.map((stage) => {
                    const current = stage.key === lead.stage;
                    const requirement = requirementFor(stage.key);

                    return (
                        <DropdownMenuItem
                            key={stage.key}
                            disabled={current}
                            onSelect={() => onMove(lead, stage.key)}
                            className="gap-2"
                        >
                            <span
                                className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    STAGE_DOT[stage.key],
                                )}
                                aria-hidden
                            />
                            {stage.label}
                            {current ? (
                                <Check
                                    className="ml-auto size-3.5"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            ) : requirement ? (
                                <Paperclip
                                    className="ml-auto size-3.5 text-muted-foreground"
                                    strokeWidth={2}
                                    aria-label="butuh dokumen"
                                />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
