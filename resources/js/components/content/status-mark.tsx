import { Check } from 'lucide-react';
import type { ContentStatus } from '@/data/content';
import { useContentStatusLabels } from '@/hooks/use-content-plan';
import { cn } from '@/lib/utils';

/**
 * How a piece's status reads, everywhere it appears.
 *
 * One ramp, not four colours: draft is quiet, review borrows the settled
 * slate, approved is teal at the edge, published is teal filled. Red never
 * marks a status; it marks the breach of being past the date, elsewhere.
 */
export const STATUS_DOT: Record<ContentStatus, string> = {
    draft: 'bg-chart-4 ring-1 ring-black/10 ring-inset',
    review: 'bg-info',
    approved: 'bg-primary-bright',
    published: 'bg-primary-deep',
};

export const STATUS_CHIP: Record<ContentStatus, string> = {
    draft: 'bg-neutral-soft text-secondary-foreground',
    review: 'bg-info-soft text-info',
    approved: 'border border-primary/40 bg-card text-primary-deep',
    published: 'bg-primary-soft text-primary-deep',
};

export function StatusMark({
    status,
    className,
}: {
    status: ContentStatus;
    className?: string;
}) {
    const labels = useContentStatusLabels();

    return (
        <span
            className={cn(
                'inline-flex items-center gap-2 text-xs font-semibold whitespace-nowrap',
                className,
            )}
        >
            <span
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    STATUS_DOT[status],
                )}
                aria-hidden
            />
            {labels[status] ?? status}
        </span>
    );
}

export function StatusPill({
    status,
    className,
}: {
    status: ContentStatus;
    className?: string;
}) {
    const labels = useContentStatusLabels();

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap',
                STATUS_CHIP[status],
                className,
            )}
        >
            {status === 'published' ? (
                <Check className="size-3" strokeWidth={3} aria-hidden />
            ) : null}
            {labels[status] ?? status}
        </span>
    );
}

/** Past the date and still not live: a breach, so it is the only red. */
export function LateMark({ days }: { days: number }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap text-destructive">
            <span
                className="size-1.5 shrink-0 rounded-full bg-destructive"
                aria-hidden
            />
            <span data-numeric>Telat {days} hari</span>
        </span>
    );
}
