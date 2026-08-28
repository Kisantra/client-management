import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * One field, one shape: label, optional hint, control, error.
 *
 * Optional is marked rather than required, because most of this form is
 * optional — flagging the rare case is quieter than starring the common one.
 */
export function Field({
    id,
    label,
    hint,
    error,
    optional = false,
    className,
    children,
}: {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    optional?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <div className="flex items-baseline gap-2">
                <Label
                    htmlFor={id}
                    className="text-[0.8438rem] font-bold text-secondary-foreground"
                >
                    {label}
                </Label>
                {optional ? (
                    <span className="text-[0.6875rem] font-semibold text-muted-foreground">
                        opsional
                    </span>
                ) : null}
            </div>

            {children}

            {error ? (
                <p
                    id={`${id}-error`}
                    className="text-xs font-semibold text-destructive"
                >
                    {error}
                </p>
            ) : hint ? (
                <p
                    id={`${id}-hint`}
                    className="text-xs leading-relaxed text-muted-foreground"
                >
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

export function FormSection({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6">
            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                {title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {description}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
        </section>
    );
}
