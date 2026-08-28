import { useStageLabels } from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';

/**
 * The stage a lead stands in, as a dot on a progression ramp plus its name.
 *
 * A dot rather than a filled badge: at table density a row of tinted pills
 * fights the data for attention, and light tints cannot carry small text at
 * 4.5:1. The dot is a mark, so the ramp can be as fine as it needs to be while
 * the label keeps the row's own ink.
 */

export const STAGE_DOT: Record<string, string> = {
    lead: 'bg-chart-4',
    kontak: 'bg-chart-3',
    konsultasi: 'bg-chart-2',
    proposal: 'bg-primary-bright',
    deal: 'bg-primary',
    client: 'bg-primary-deep',
};

export function StageMark({
    stage,
    className,
}: {
    stage: string;
    className?: string;
}) {
    const labels = useStageLabels();

    return (
        <span
            className={cn(
                'inline-flex items-center gap-2 text-xs font-semibold whitespace-nowrap',
                className,
            )}
        >
            <span
                className={cn(
                    'size-2 shrink-0 rounded-full ring-2 ring-black/5 ring-inset',
                    STAGE_DOT[stage] ?? 'bg-neutral-soft',
                )}
                aria-hidden
            />
            {labels[stage] ?? stage}
        </span>
    );
}

export function StalledMark({
    days,
    threshold,
}: {
    days: number;
    threshold: number;
}) {
    return (
        <span className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap text-destructive">
            <span
                className="size-1.5 shrink-0 rounded-full bg-destructive"
                aria-hidden
            />
            <span data-numeric>{days} hari</span>
            <span className="sr-only">
                mandek, melewati batas {threshold} hari untuk tahap ini
            </span>
        </span>
    );
}
