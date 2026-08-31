import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { daysAgoDate, TODAY } from '@/data/leads';
import { cn } from '@/lib/utils';

export type EntryRange = DateRange | undefined;

/** Quick answers first; the calendar is there when the question is exact. */
const PRESETS: { label: string; days: number }[] = [
    { label: '7 hari terakhir', days: 7 },
    { label: '30 hari terakhir', days: 30 },
    { label: '90 hari terakhir', days: 90 },
    { label: '1 tahun terakhir', days: 365 },
];

const short = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

export function rangeLabel(range: EntryRange) {
    if (!range?.from) {
        return 'Semua waktu';
    }

    if (!range.to || range.from.getTime() === range.to.getTime()) {
        return short.format(range.from);
    }

    return `${short.format(range.from)} – ${short.format(range.to)}`;
}

export function DateRangeFilter({
    value,
    onChange,
    className,
}: {
    value: EntryRange;
    onChange: (range: EntryRange) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const active = Boolean(value?.from);

    const applyPreset = (days: number) => {
        onChange({ from: daysAgoDate(days - 1), to: TODAY });
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'flex min-w-0 items-center gap-2 rounded-md border px-3 py-2.5 text-[0.8438rem] font-semibold shadow-lift transition-colors',
                        className,
                        active
                            ? 'border-primary/40 bg-primary-soft text-primary-deep'
                            : 'border-border bg-card text-secondary-foreground hover:border-primary/35 hover:text-primary-deep',
                    )}
                >
                    <CalendarDays
                        className="size-4 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                    <span className="sr-only">Periode lead masuk: </span>
                    <span className="truncate">{rangeLabel(value)}</span>
                </button>
            </PopoverTrigger>

            {/* A phone has no room for presets beside the calendar, and often
                not for both stacked either: the presets pair up, and the sheet
                scrolls inside whatever height the viewport can give it. */}
            <PopoverContent
                align="start"
                collisionPadding={12}
                className="max-h-(--radix-popover-content-available-height) w-[calc(100vw-1.5rem)] overflow-y-auto p-0 sm:w-auto"
            >
                <div className="flex flex-col sm:flex-row">
                    <div className="flex flex-col gap-1 border-b border-border p-3 sm:w-44 sm:border-r sm:border-b-0">
                        <p className="px-2 pt-1 pb-2 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                            Periode masuk
                        </p>
                        <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-col">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.days}
                                    type="button"
                                    onClick={() => applyPreset(preset.days)}
                                    className="rounded-md px-2 py-2 text-left text-[0.8438rem] font-semibold text-secondary-foreground transition-colors hover:bg-neutral-soft hover:text-primary-deep"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        {active ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(undefined);
                                    setOpen(false);
                                }}
                                className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-left text-[0.8438rem] font-semibold text-muted-foreground transition-colors hover:text-destructive"
                            >
                                <X
                                    className="size-3.5"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                                Semua waktu
                            </button>
                        ) : null}
                    </div>

                    <div className="w-fit p-3 max-sm:mx-auto">
                        <Calendar
                            mode="range"
                            numberOfMonths={1}
                            defaultMonth={value?.from}
                            selected={value}
                            onSelect={onChange}
                            disabled={{ after: TODAY }}
                            autoFocus
                        />
                        <p className="mt-2 max-w-[15.75rem] border-t border-border px-1 pt-2.5 text-xs leading-relaxed text-muted-foreground">
                            Pilih satu tanggal, atau dua untuk rentang.
                        </p>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
