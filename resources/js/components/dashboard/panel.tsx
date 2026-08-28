import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    meta?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    bodyClassName?: string;
};

export function Panel({
    title,
    meta,
    action,
    children,
    footer,
    className,
    bodyClassName,
}: Props) {
    return (
        <section
            className={cn(
                'flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-5 shadow-lift',
                className,
            )}
        >
            <header className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                    {title}
                </h2>
                {action ??
                    (meta ? (
                        <span className="shrink-0 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            {meta}
                        </span>
                    ) : null)}
            </header>

            <div className={cn('min-h-0', bodyClassName)}>{children}</div>

            {footer ? (
                <div className="mt-auto border-t border-border pt-3">
                    {footer}
                </div>
            ) : null}
        </section>
    );
}
