import {
    CalendarRange,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
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
    'minggu-ini': 'Minggu ini',
    'minggu-lalu': 'Minggu lalu',
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

/** Which panel the popover is showing. */
type View = 'list' | 'month' | 'range';

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
 * A page that asks for `months` gets a month grid the same way: any month by
 * name, sent as a custom range that happens to cover exactly that month.
 */
export function PeriodFilter({
    period,
    options,
    onChange,
    heading,
    months = false,
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
    /** Says which date the window is read against, above the presets. */
    heading?: string;
    /** Offers a whole month by name, besides the free range. */
    months?: boolean;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<View>('list');
    const [range, setRange] = useState<DateRange | undefined>(undefined);
    const [year, setYear] = useState(() => new Date().getFullYear());

    /* "2026-08" when the window is one whole month picked from the grid. */
    const pickedMonth =
        months &&
        period.key === 'khusus' &&
        period.from &&
        isWholeMonth(period.from, period.to)
            ? period.from.slice(0, 7)
            : null;

    /* Opening lands on whichever panel the current window was chosen in. */
    const show = (next: boolean) => {
        setOpen(next);

        if (next) {
            setView(
                period.key !== 'khusus'
                    ? 'list'
                    : pickedMonth
                      ? 'month'
                      : 'range',
            );
            setRange(
                period.from && period.to
                    ? { from: asDate(period.from), to: asDate(period.to) }
                    : undefined,
            );
            setYear(
                period.from
                    ? asDate(period.from).getFullYear()
                    : new Date().getFullYear(),
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

    const chooseMonth = (month: number) => {
        setOpen(false);
        onChange({
            periode: 'khusus',
            dari: iso(new Date(year, month, 1)),
            // Day 0 of the next month is the last day of this one.
            sampai: iso(new Date(year, month + 1, 0)),
        });
    };

    const thisMonth = iso(new Date()).slice(0, 7);

    return (
        <Popover open={open} onOpenChange={show}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`${heading ?? 'Periode'}: ${period.label}`}
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
                {view === 'range' ? (
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
                                onClick={() => setView('list')}
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
                ) : view === 'month' ? (
                    <div className="w-64 p-3">
                        <p className="px-1 pb-2 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                            Pilih bulan
                        </p>

                        <div className="flex h-8 items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setYear(year - 1)}
                                aria-label="Tahun sebelumnya"
                                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                            >
                                <ChevronLeft
                                    className="size-4"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            </button>
                            <span
                                className="text-[0.8438rem] font-bold"
                                data-numeric
                            >
                                {year}
                            </span>
                            <button
                                type="button"
                                onClick={() => setYear(year + 1)}
                                aria-label="Tahun berikutnya"
                                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                            >
                                <ChevronRight
                                    className="size-4"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            </button>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-1">
                            {MONTH_NAMES.map((name, month) => {
                                const key = `${year}-${String(month + 1).padStart(2, '0')}`;
                                const chosen = key === pickedMonth;

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => chooseMonth(month)}
                                        aria-pressed={chosen}
                                        aria-label={`${FULL_MONTH_NAMES[month]} ${year}`}
                                        className={cn(
                                            'h-9 rounded-md text-[0.8438rem] font-semibold transition-colors',
                                            chosen
                                                ? 'bg-primary text-primary-foreground'
                                                : key === thisMonth
                                                  ? 'bg-primary-soft text-primary-deep hover:bg-accent'
                                                  : 'text-secondary-foreground hover:bg-neutral-soft',
                                        )}
                                    >
                                        {name}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-3 flex border-t border-border pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setView('list')}
                            >
                                Kembali
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex w-56 flex-col p-1">
                        {heading ? (
                            <p className="px-2 pt-2 pb-1 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                {heading}
                            </p>
                        ) : null}

                        {options.map((key) => (
                            <MenuRow
                                key={key}
                                label={PERIOD_LABELS[key] ?? key}
                                active={period.key === key}
                                onClick={() => choose(key)}
                            />
                        ))}

                        <div className="mt-1 border-t border-border pt-1">
                            {months ? (
                                <MenuRow
                                    label="Pilih bulan…"
                                    active={pickedMonth !== null}
                                    onClick={() => setView('month')}
                                />
                            ) : null}
                            <MenuRow
                                label="Rentang khusus…"
                                active={
                                    period.key === 'khusus' &&
                                    pickedMonth === null
                                }
                                onClick={() => setView('range')}
                            />
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

function MenuRow({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-[0.8438rem] font-semibold transition-colors hover:bg-neutral-soft',
                active ? 'text-primary-deep' : 'text-secondary-foreground',
            )}
        >
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {active ? (
                <Check
                    className="size-3.5 shrink-0"
                    strokeWidth={2.5}
                    aria-hidden
                />
            ) : null}
        </button>
    );
}

/** True when the two dates are the first and last day of the same month. */
function isWholeMonth(from: string, to: string | null): boolean {
    if (!to || !from.endsWith('-01')) {
        return false;
    }

    const start = asDate(from);

    return to === iso(new Date(start.getFullYear(), start.getMonth() + 1, 0));
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(
        new Date(2000, month, 1),
    ),
);

const FULL_MONTH_NAMES = Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(
        new Date(2000, month, 1),
    ),
);

const dayFormat = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

function dayLabel(date: Date): string {
    return dayFormat.format(date);
}
