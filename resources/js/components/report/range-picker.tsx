import { CalendarRange } from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { asDate } from '@/data/leads';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const iso = (date: Date) =>
    [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');

const dayFormat = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

const DAY = 24 * 60 * 60 * 1000;

/** Both ends counted: 1–20 Agustus is twenty days. */
const span = (range: DateRange | undefined) =>
    range?.from
        ? Math.round(
              ((range.to ?? range.from).getTime() - range.from.getTime()) / DAY,
          ) + 1
        : 0;

/**
 * The ranges people reach for most, as a head start on the calendar. Each one
 * only fills the selection; nothing changes until "Terapkan", so a preset can
 * be nudged a day either way before it is used.
 */
function presets(): { label: string; range: DateRange }[] {
    /* Midnight, not now: a range is whole days, and a time of day left on
       "today" counts as most of an extra one. */
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const back = (days: number) =>
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    const quarter = Math.floor(today.getMonth() / 3) * 3;

    return [
        { label: '7 hari', range: { from: back(6), to: today } },
        { label: '30 hari', range: { from: back(29), to: today } },
        { label: '90 hari', range: { from: back(89), to: today } },
        {
            label: 'Kuartal ini',
            range: {
                from: new Date(today.getFullYear(), quarter, 1),
                to: new Date(today.getFullYear(), quarter + 3, 0),
            },
        },
        {
            label: 'Tahun ini',
            range: {
                from: new Date(today.getFullYear(), 0, 1),
                to: new Date(today.getFullYear(), 11, 31),
            },
        },
    ];
}

/**
 * The third way to scope a report: any two dates.
 *
 * It sits inside the Bulanan | Mingguan switch as its third option, because
 * it answers the same question — which stretch of time — and a separate
 * control somewhere else on the toolbar would read as a filter on top of the
 * period rather than as a period of its own.
 */
export function RangePicker({
    active,
    from,
    to,
    onApply,
}: {
    /** Whether the report on screen is already a custom range. */
    active: boolean;
    /** The report's own dates, so reopening lands on what is showing. */
    from: string;
    to: string;
    onApply: (range: { dari: string; sampai: string }) => void;
}) {
    const mobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const [range, setRange] = useState<DateRange | undefined>(undefined);
    /* Which month the calendar shows, kept apart from the selection so a
       preset can bring its own months into view. */
    const [month, setMonth] = useState<Date>(new Date());

    const show = (next: boolean) => {
        setOpen(next);

        if (next) {
            const current = { from: asDate(from), to: asDate(to) };
            setRange(active ? current : undefined);
            setMonth(active ? current.from : new Date());
        }
    };

    const pick = (next: DateRange) => {
        setRange(next);
        setMonth(next.from!);
    };

    const apply = () => {
        if (!range?.from) {
            return;
        }

        setOpen(false);
        onApply({ dari: iso(range.from), sampai: iso(range.to ?? range.from) });
    };

    return (
        <Popover open={open} onOpenChange={show}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-pressed={active}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[0.8438rem] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                        active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-secondary-foreground hover:text-primary-deep data-[state=open]:text-primary-deep',
                    )}
                >
                    <CalendarRange
                        className="size-3.5"
                        strokeWidth={2.25}
                        aria-hidden
                    />
                    Khusus
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                sideOffset={8}
                collisionPadding={16}
                className="w-auto max-w-[calc(100vw-2rem)] p-3"
            >
                <p className="px-1 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                    Rentang khusus
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                    {presets().map((preset) => {
                        const on =
                            range?.from &&
                            range.to &&
                            iso(range.from) === iso(preset.range.from!) &&
                            iso(range.to) === iso(preset.range.to!);

                        return (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => pick(preset.range)}
                                aria-pressed={Boolean(on)}
                                className={cn(
                                    'rounded-full border px-2.5 py-1 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                                    on
                                        ? 'border-primary bg-primary-soft text-primary-deep'
                                        : 'border-border text-secondary-foreground hover:border-primary/35 hover:text-primary-deep',
                                )}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                </div>

                <Calendar
                    mode="range"
                    selected={range}
                    onSelect={setRange}
                    month={month}
                    onMonthChange={setMonth}
                    numberOfMonths={mobile ? 1 : 2}
                    className="mt-3"
                    autoFocus
                />

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                        {range?.from ? (
                            range.to ? (
                                <>
                                    <span
                                        className="font-bold text-foreground"
                                        data-numeric
                                    >
                                        {dayFormat.format(range.from)} –{' '}
                                        {dayFormat.format(range.to)}
                                    </span>{' '}
                                    · <span data-numeric>{span(range)}</span>{' '}
                                    hari, dibandingkan dengan {span(range)} hari
                                    sebelumnya
                                </>
                            ) : (
                                'Pilih tanggal akhirnya.'
                            )
                        ) : (
                            'Pilih tanggal awal, atau mulai dari salah satu pilihan di atas.'
                        )}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="shadow-teal"
                        disabled={!range?.from}
                        onClick={apply}
                    >
                        Terapkan
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
