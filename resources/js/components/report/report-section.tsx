import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const nf = new Intl.NumberFormat('id-ID');
export const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/** A multiple of usual: 1,4× — and 2.239×, not 2.239,3×, once it is large. */
export function times(lift: number): string {
    return `${lift >= 10 ? nf.format(Math.round(lift)) : nf1.format(lift)}×`;
}

/** Rupiah at report scale: 47.500.000 reads as Rp 48 jt. */
export function money(value: number): string {
    if (value === 0) {
        return 'Rp 0';
    }

    if (value >= 1_000_000_000) {
        return `Rp ${nf1.format(value / 1_000_000_000)} M`;
    }

    return `Rp ${nf.format(Math.round(value / 1_000_000))} jt`;
}

/**
 * The report's card: the dashboard panel's surface, with room in the header
 * for the control that changes what the card shows.
 *
 * The body is a flex column that takes whatever height the row gives it, so
 * a card set beside a taller neighbour spends the difference inside its own
 * content — centred, or on a chart that grows — rather than as an empty band
 * under its last row.
 */
export function ReportSection({
    title,
    description,
    action,
    children,
    className,
    bodyClassName,
}: {
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section
            className={cn(
                'flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-lift',
                className,
            )}
        >
            {/* The control keeps its place beside the title whatever the
                description says, so switching views never moves it. */}
            <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                <div className="min-w-0 sm:flex-1">
                    <h2 className="text-base font-extrabold tracking-[-0.02em]">
                        {title}
                    </h2>
                    {description ? (
                        <p className="mt-0.5 max-w-[60ch] text-xs leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
                {action}
            </header>

            <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>
                {children}
            </div>
        </section>
    );
}

/** Two or three ways to read the same card, one of them on. */
export function Segmented<T extends string>({
    value,
    options,
    onChange,
    label,
}: {
    value: T;
    options: { value: T; label: string; count?: number }[];
    onChange: (next: T) => void;
    label: string;
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className="flex shrink-0 rounded-md bg-neutral-soft p-0.5"
        >
            {options.map((option) => {
                const on = option.value === value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-[0.3125rem] px-2.5 py-1 text-xs font-bold transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                            on
                                ? 'bg-card text-foreground shadow-lift'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {option.label}
                        {option.count !== undefined ? (
                            <span
                                className={cn(
                                    'text-[0.6875rem]',
                                    on
                                        ? 'text-primary-deep'
                                        : 'text-muted-foreground',
                                )}
                                data-numeric
                            >
                                {nf.format(option.count)}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}

/** What an empty card says, set in the middle of the space it was given. */
export function ReportEmpty({
    icon: Icon,
    title,
    children,
    compact = false,
}: {
    icon: LucideIcon;
    title: string;
    children: ReactNode;
    /** For a card with no neighbour to match: no more height than the words. */
    compact?: boolean;
}) {
    return (
        <div
            className={cn(
                'my-auto flex flex-col items-center gap-2 px-4 text-center',
                compact ? 'py-3' : 'py-8',
            )}
        >
            <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary-deep">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm font-bold">{title}</p>
            <div className="max-w-[40ch] text-xs leading-relaxed text-muted-foreground">
                {children}
            </div>
        </div>
    );
}
