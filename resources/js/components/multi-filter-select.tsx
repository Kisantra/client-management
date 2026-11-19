import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type MultiFilterOption = {
    value: string;
    label: string;
    count?: number;
    icon?: ReactNode;
};

/**
 * A toolbar filter that takes more than one answer: the same outlined, lifted
 * trigger as FilterSelect, opening onto a checklist. Nothing picked means
 * everything, so the first row is the way back to that rather than a box of
 * its own to keep in sync with the rest.
 *
 * Each option can carry its count, which is what keeps the list a reading of
 * the whole while it filters: a pick narrows the page, never the numbers here.
 */
export function MultiFilterSelect({
    label,
    allLabel,
    noun,
    options,
    value,
    onChange,
    className,
}: {
    /** What the control filters, for the trigger's accessible name. */
    label: string;
    /** The first row, and the trigger while nothing is picked. */
    allLabel: string;
    /** Counted in the trigger once two or more are picked: "3 channel". */
    noun: string;
    options: MultiFilterOption[];
    value: string[];
    onChange: (value: string[]) => void;
    className?: string;
}) {
    const picked = options.filter((option) => value.includes(option.value));
    const total = options.reduce((sum, option) => sum + (option.count ?? 0), 0);
    const counted = options.some((option) => option.count !== undefined);

    const summary =
        picked.length === 0
            ? allLabel
            : picked.length === 1
              ? picked[0].label
              : `${picked.length} ${noun}`;

    /* Kept in the options' own order, whatever order they were ticked in. */
    const toggle = (key: string, on: boolean) =>
        onChange(
            options
                .map((option) => option.value)
                .filter((item) => (item === key ? on : value.includes(item))),
        );

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`${label}: ${picked.length === 0 ? allLabel : picked.map((option) => option.label).join(', ')}`}
                    className={cn(
                        'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-[0.8438rem] font-semibold whitespace-nowrap text-secondary-foreground shadow-lift transition-colors outline-none hover:border-primary/35 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:border-primary/40 sm:w-auto',
                        className,
                    )}
                >
                    <span className="min-w-0 truncate">{summary}</span>
                    <ChevronDown
                        className="size-4 shrink-0 opacity-50"
                        aria-hidden
                    />
                </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-60 p-1">
                <button
                    type="button"
                    onClick={() => onChange([])}
                    className={cn(
                        'flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-[0.8438rem] font-semibold transition-colors outline-none hover:bg-neutral-soft focus-visible:bg-neutral-soft',
                        picked.length === 0
                            ? 'text-primary-deep'
                            : 'text-secondary-foreground',
                    )}
                >
                    {/* Holds the checkbox column, so every label starts on one line. */}
                    <span className="grid size-4 shrink-0 place-items-center">
                        {picked.length === 0 ? (
                            <Check
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                        ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{allLabel}</span>
                    {counted ? <Count value={total} /> : null}
                </button>

                <div className="my-1 h-px bg-border" aria-hidden />

                {options.map((option) => {
                    const checked = value.includes(option.value);

                    return (
                        <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 text-[0.8438rem] font-semibold text-secondary-foreground transition-colors hover:bg-neutral-soft has-[:focus-visible]:bg-neutral-soft"
                        >
                            <Checkbox
                                checked={checked}
                                onCheckedChange={(state) =>
                                    toggle(option.value, state === true)
                                }
                            />
                            {option.icon ? (
                                <span className="text-muted-foreground">
                                    {option.icon}
                                </span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate">
                                {option.label}
                            </span>
                            {option.count !== undefined ? (
                                <Count value={option.count} />
                            ) : null}
                        </label>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

function Count({ value }: { value: number }) {
    return (
        <span
            className="min-w-5 text-right text-xs font-bold text-muted-foreground"
            data-numeric
        >
            {value}
        </span>
    );
}
