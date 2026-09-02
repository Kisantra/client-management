import { Link } from '@inertiajs/react';
import { ArrowRight, Info } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

type Tone = 'anchor' | 'plain';

type Props = {
    label: string;
    /** Explains what the figure counts, for anyone meeting it for the first time. */
    hint: string;
    /** The figure itself, counted up on mount. */
    value: number;
    /** Reads beside the figure, e.g. "/ 40". Never counted. */
    valueSuffix?: ReactNode;
    /** What the figure is measured against, e.g. "vs Juli". */
    compare: string;
    delta?: { text: string; direction: 'up' | 'down' | 'flat' };
    /** The figure's own shape, drawn from real series data. */
    viz: ReactNode;
    /**
     * Where the tile leads. On the dashboard every figure is a way in; on a
     * page that is already the detail there is nowhere further to go, and the
     * tile renders as a plain card without the footer.
     */
    href?: ComponentProps<typeof Link>['href'];
    /** How the figure reads once counted — thousands, a rate, a duration. */
    format?: (value: number) => string;
    /** Decimals the count-up keeps, for figures below 1. */
    precision?: number;
    tone?: Tone;
    /** Staggers the count-up so the row reads left to right. */
    delay?: number;
    className?: string;
};

export function StatTile({
    label,
    hint,
    value,
    valueSuffix,
    compare,
    delta,
    viz,
    href,
    format,
    precision = 0,
    tone = 'plain',
    delay = 0,
    className,
}: Props) {
    const isAnchor = tone === 'anchor';
    const counted = useCountUp(value, delay, 900, precision);
    const Shell = href ? Link : 'div';

    return (
        <Shell
            {...(href ? { href, prefetch: true } : {})}
            className={cn(
                'group/tile flex min-w-0 flex-col rounded-xl border transition-[box-shadow,border-color,transform] duration-200',
                href && 'active:scale-[0.99]',
                isAnchor
                    ? 'border-transparent bg-[linear-gradient(150deg,var(--primary),var(--primary-deep))] text-white shadow-teal hover:shadow-teal-lg'
                    : cn(
                          'border-border bg-card text-card-foreground shadow-lift',
                          /* Nothing to click, so nothing reacts to a pointer. */
                          href &&
                              'hover:border-primary/35 hover:shadow-lift-lg',
                      ),
                className,
            )}
        >
            <span className="flex flex-1 flex-col p-4 pb-3.5 sm:p-[1.125rem] sm:pb-3.5">
                <span
                    className={cn(
                        'mb-2.5 flex items-center gap-1.5 text-[0.8438rem] leading-tight font-semibold',
                        isAnchor ? 'text-white' : 'text-muted-foreground',
                    )}
                    title={hint}
                >
                    <span className="truncate">{label}</span>
                    <Info
                        className={cn(
                            'size-3.5 shrink-0',
                            isAnchor
                                ? 'text-white/70'
                                : 'text-muted-foreground',
                        )}
                        strokeWidth={2}
                        aria-hidden
                    />
                </span>

                <span className="flex items-end justify-between gap-3">
                    <span className="min-w-0">
                        <span
                            className="block text-[1.875rem] leading-none font-extrabold tracking-[-0.035em]"
                            data-numeric
                        >
                            {format ? format(counted) : counted}
                            {valueSuffix}
                        </span>

                        <span className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                            <span
                                className={
                                    isAnchor
                                        ? 'text-white'
                                        : 'text-muted-foreground'
                                }
                            >
                                {compare}
                            </span>
                            {delta ? (
                                <DeltaPill
                                    direction={delta.direction}
                                    isAnchor={isAnchor}
                                >
                                    {delta.text}
                                </DeltaPill>
                            ) : null}
                        </span>
                    </span>

                    <span className="shrink-0">{viz}</span>
                </span>
            </span>

            {href ? (
                <span
                    className={cn(
                        'flex items-center gap-1.5 border-t px-4 py-2.5 text-xs font-bold transition-colors sm:px-[1.125rem]',
                        isAnchor
                            ? 'border-white/20 text-white'
                            : 'border-border text-secondary-foreground group-hover/tile:text-primary-deep',
                    )}
                >
                    Lihat detail
                    <ArrowRight
                        className="size-3.5 transition-transform duration-200 group-hover/tile:translate-x-0.5"
                        strokeWidth={2.5}
                        aria-hidden
                    />
                </span>
            ) : null}
        </Shell>
    );
}

function DeltaPill({
    children,
    direction,
    isAnchor,
}: {
    children: ReactNode;
    direction: 'up' | 'down' | 'flat';
    isAnchor: boolean;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-extrabold',
                isAnchor && 'bg-white text-primary',
                !isAnchor &&
                    direction === 'up' &&
                    'bg-primary-soft text-primary-deep',
                !isAnchor &&
                    direction === 'down' &&
                    'bg-destructive-soft text-destructive',
                !isAnchor &&
                    direction === 'flat' &&
                    'bg-neutral-soft text-secondary-foreground',
            )}
            data-numeric
        >
            {children}
        </span>
    );
}
