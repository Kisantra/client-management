import { router } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useState } from 'react';
import {
    FieldChevron,
    FieldError,
    FieldStack,
    MenuHeading,
    fieldTrigger,
    useLanded,
} from '@/components/content/field-control';
import { STATUS_CHIP, STATUS_DOT } from '@/components/content/status-mark';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ContentStatus } from '@/data/content';
import { useContentPlan } from '@/hooks/use-content-plan';
import { cn } from '@/lib/utils';
import { store as moveStatus } from '@/routes/content/status';

/**
 * The status of a piece, and the way to change it, as one control.
 *
 * It used to be two: the status was read on this line and moved from a teal
 * button in the toolbar above it — the same fact stated twice, with the door
 * to it the loudest thing on the panel and nowhere near the thing it changes.
 * The chip is the door now. What you read is what you press.
 *
 * Status keeps its own write rather than joining the other fields: a move is a
 * step in a flow, and it is recorded in the piece's history and rung through
 * to everyone else. Going live is the one move that still opens a dialog — the
 * day it went out and the link to it are only known at that moment and a menu
 * item cannot ask for them, so the item says so before it is chosen.
 */
export function StatusSelect({
    contentId,
    status,
    onPublish,
}: {
    contentId: number;
    status: ContentStatus;
    /** Published needs a date and a link, so the panel above handles it. */
    onPublish: () => void;
}) {
    const { statuses } = useContentPlan();

    const [moving, setMoving] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);
    const { landed, settled } = useLanded(status);

    const here = statuses.find((option) => option.key === status);

    const move = (next: ContentStatus) => {
        if (next === status) {
            return;
        }

        if (next === 'published') {
            onPublish();

            return;
        }

        router.post(
            moveStatus(contentId).url,
            { status: next },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => {
                    setMoving(true);
                    setFailed(null);
                },
                onFinish: () => setMoving(false),
                onError: (errors) =>
                    setFailed(
                        Object.values(errors)[0] ??
                            'Status tidak bisa dipindahkan.',
                    ),
            },
        );
    };

    return (
        <FieldStack>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={moving}
                        aria-label={`Status ${here?.label ?? status}, ubah`}
                        onAnimationEnd={settled}
                        className={cn(
                            fieldTrigger({ shape: 'chip', landed }),
                            STATUS_CHIP[status],
                        )}
                    >
                        {here?.label ?? status}
                        <FieldChevron saving={moving} />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                    className="w-[min(17rem,calc(100vw-2rem))] p-1.5"
                >
                    <MenuHeading>Pindah ke status</MenuHeading>

                    {statuses.map((option, at) => {
                        const key = option.key as ContentStatus;
                        const current = key === status;

                        return (
                            <DropdownMenuItem
                                key={key}
                                disabled={current}
                                onSelect={() => move(key)}
                                className={cn(
                                    'relative gap-2.5 rounded-md px-2.5 py-2',
                                    /* Where the piece stands is not an option
                                       that happens to be unavailable, so it
                                       keeps its weight instead of greying out
                                       like something switched off. */
                                    current &&
                                        'bg-neutral-soft data-[disabled]:opacity-100',
                                )}
                            >
                                {/* The four are a flow, not a list: the rail
                                    says which way a move goes before the words
                                    do, and how far from live the piece is. */}
                                {at > 0 ? (
                                    <span
                                        aria-hidden
                                        className="absolute top-0 left-[0.9375rem] h-[calc(50%-0.4375rem)] w-px -translate-x-1/2 bg-border"
                                    />
                                ) : null}
                                {at < statuses.length - 1 ? (
                                    <span
                                        aria-hidden
                                        className="absolute bottom-0 left-[0.9375rem] h-[calc(50%-0.4375rem)] w-px -translate-x-1/2 bg-border"
                                    />
                                ) : null}

                                <span
                                    className={cn(
                                        'size-2.5 shrink-0 rounded-full',
                                        STATUS_DOT[key],
                                    )}
                                    aria-hidden
                                />

                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 text-[0.8438rem] leading-snug font-bold">
                                        {option.label}
                                        {current ? (
                                            <Check
                                                className="size-3.5 shrink-0 text-primary-deep"
                                                strokeWidth={3}
                                                aria-hidden
                                            />
                                        ) : null}
                                    </span>
                                    <span className="mt-0.5 block text-[0.6875rem] leading-snug text-muted-foreground">
                                        {key === 'published' && !current
                                            ? 'Tanggal dan tautannya ditanya dulu.'
                                            : option.hint}
                                    </span>
                                </span>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>

            <FieldError message={failed} />
        </FieldStack>
    );
}
