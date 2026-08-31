import { cn } from '@/lib/utils';

/**
 * A filter chip that carries its own count, so a row of them doubles as a
 * reading of the whole: stages on the Leads page, channels on the Client page.
 */
export function CountChip({
    label,
    count,
    active,
    onClick,
    tone = 'stage',
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
    /** 'closed' reads in ink rather than teal: it is an exit, not a step. */
    tone?: 'stage' | 'closed';
}) {
    const closed = tone === 'closed';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-[0.8438rem] font-bold whitespace-nowrap transition-colors',
                active
                    ? closed
                        ? 'border-ink-panel bg-ink-panel text-white'
                        : 'border-primary bg-primary text-primary-foreground'
                    : cn(
                          'border-border bg-card text-secondary-foreground shadow-lift',
                          closed
                              ? 'hover:border-ink-panel/35 hover:text-foreground'
                              : 'hover:border-primary/35 hover:text-primary-deep',
                      ),
            )}
        >
            {label}
            <span
                className={cn(
                    'rounded-full px-1.5 py-px text-[0.6875rem] font-extrabold',
                    active
                        ? 'bg-white/20 text-white'
                        : 'bg-neutral-soft text-muted-foreground',
                )}
                data-numeric
            >
                {count}
            </span>
        </button>
    );
}
