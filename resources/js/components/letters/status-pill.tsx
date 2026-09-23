import { STATUS_TONE } from '@/data/letters';
import type { LetterStatus } from '@/data/letters';
import { cn } from '@/lib/utils';

export function StatusPill({
    status,
    label,
    className,
}: {
    status: LetterStatus;
    label: string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap',
                STATUS_TONE[status],
                className,
            )}
        >
            {label}
        </span>
    );
}
