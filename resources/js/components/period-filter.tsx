import { CalendarRange, Check, ChevronDown } from 'lucide-react';
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
import { cn } from '@/lib/utils';

/** The window a page is scoped to, as the server resolved it. */
export type Period = {
    key: string;
    label: string;
    from: string | null;
    to: string | null;
};

/** Every preset either page can offer, named once. */
export const PERIOD_LABELS: Record<string, string> = {
    'bulan-ini': 'Bulan ini',
    'bulan-lalu': 'Bulan lalu',
    'bulan-depan': 'Bulan depan',
    kuartal: 'Kuartal ini',
    tahun: 'Tahun ini',
    '30hari': '30 hari terakhir',
    '90hari': '90 hari terakhir',
    '6bulan': '6 bulan terakhir',
    semua: 'Semua waktu',
};

const iso = (date: Date) =>
    [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');

/**
 * How far back, or forward, a page is looking.
 *
 * One control rather than a row of chips: the presets are the answer nine
 * times out of ten, and the tenth is a range nobody could have listed in
 * advance. Both live behind the same button, so the toolbar carries one
 * thing that always says the window it is standing in.
 *
 * The custom range takes over the whole panel instead of unfolding beneath
 * the presets — a calendar squeezed under a list is a calendar nobody can
 * read, and while you are picking two dates the presets are not the question.
 */
export function PeriodFilter({
    period,
    options,
    onChange,
    className,
}: {
    period: Period;
    /** The preset keys this page offers, in the order it offers them. */
    options: string[];
    onChange: (next: {
        periode: string;
        dari?: string;
        sampai?: string;
    }) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [picking, setPicking] = useState(false);
    const [range, setRange] = useState<DateRange | undefined>(undefined);

    /* Opening always lands on the list, whatever was on screen last time. */
    const show = (next: boolean) => {
        setOpen(next);

        if (next) {
            setPicking(period.key === 'khusus');
            setRange(
                period.from && period.to
                    ? { from: asDate(period.from), to: asDate(period.to) }
                    : undefined,
            );
        }
    };

    const choose = (key: string) => {
        setOpen(false);
        onChange({ periode: key });
    };

    const apply = () => {
        if (!range?.from) {
            return;
        }

        setOpen(false);
        onChange({
            periode: 'khusus',
            dari: iso(range.from),
            sampai: iso(range.to ?? range.from),
        });
    };

    return (
        <Popover open={open} onOpenChange={show}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`Periode: ${period.label}`}
                    className={cn(
                        'inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-[0.8438rem] font-semibold text-secondary-foreground shadow-lift transition-colors hover:border-primary/35 data-[state=open]:border-primary/40',
                        className,
                    )}
                >
                    <CalendarRange
                        className="size-4 shrink-0 text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                    />
                    <span className="truncate" data-numeric>
                        {period.label}
                    </span>
                    <ChevronDown
                        className="size-4 shrink-0 text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                    />
                </button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-auto p-0">
                {picking ? (
                    <div className="p-3">
                        <p className="px-1 pb-2 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                            Rentang khusus
                        </p>

                        <Calendar
                            mode="range"
                            selected={range}
                            onSelect={setRange}
                            numberOfMonths={1}
                            defaultMonth={range?.from}
                            autoFocus
                        />

                        <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
                            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {range?.from
                                    ? range.to
                                        ? `${dayLabel(range.from)} – ${dayLabel(range.to)}`
                                        : 'Pilih tanggal akhirnya.'
                                    : 'Pilih tanggal awalnya.'}
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPicking(false)}
                            >
                                Kembali
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
                    </div>
                ) : (
                    <div className="flex w-56 flex-col p-1">
                        {options.map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => choose(key)}
                                className={cn(
                                    'flex items-center gap-2 rounded-sm px-2 py-2 text-left text-[0.8438rem] font-semibold transition-colors hover:bg-neutral-soft',
                                    period.key === key
                                        ? 'text-primary-deep'
                                        : 'text-secondary-foreground',
                                )}
                            >
                                <span className="min-w-0 flex-1 truncate">
                                    {PERIOD_LABELS[key] ?? key}
                                </span>
                                {period.key === key ? (
                                    <Check
                                        className="size-3.5 shrink-0"
                                        strokeWidth={2.5}
                                        aria-hidden
                                    />
                                ) : null}
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => setPicking(true)}
                            className={cn(
                                'mt-1 flex items-center gap-2 border-t border-border px-2 pt-2.5 pb-2 text-left text-[0.8438rem] font-semibold transition-colors hover:text-primary-deep',
                                period.key === 'khusus'
                                    ? 'text-primary-deep'
                                    : 'text-secondary-foreground',
                            )}
                        >
                            <span className="min-w-0 flex-1 truncate">
                                Rentang khusus…
                            </span>
                            {period.key === 'khusus' ? (
                                <Check
                                    className="size-3.5 shrink-0"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            ) : null}
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

const dayFormat = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

function dayLabel(date: Date): string {
    return dayFormat.format(date);
}
