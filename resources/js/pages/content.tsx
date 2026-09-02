import { Head, router } from '@inertiajs/react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Columns3,
    Plus,
    Search,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { ContentAgenda } from '@/components/content/content-agenda';
import { ContentBoard, GROUPS } from '@/components/content/content-board';
import type { GroupKey } from '@/components/content/content-board';
import { ContentCalendar } from '@/components/content/content-calendar';
import { ContentDialog } from '@/components/content/content-dialog';
import type { Compose } from '@/components/content/content-dialog';
import { ContentSheet } from '@/components/content/content-sheet';
import type { SelectedContent } from '@/components/content/content-sheet';
import { FilterSelect } from '@/components/filter-select';
import { PeriodFilter } from '@/components/period-filter';
import type { Period } from '@/components/period-filter';
import { Button } from '@/components/ui/button';
import type { ContentMonth, ContentRow, StatusCount } from '@/data/content';
import { dayLabel } from '@/data/content';
import type { ChannelKey } from '@/data/dashboard';
import { useContentPlan } from '@/hooks/use-content-plan';
import { cn } from '@/lib/utils';
import { content as contentIndex } from '@/routes';

type Filters = {
    bulan: string;
    view: 'kalender' | 'papan';
    /** Which field the board stacks its columns by. */
    grup: GroupKey;
    channel: string;
    status: string;
    pj: string;
    q: string;
    telat: string;
    hari: string;
    /** '1' when the URL asks for the form to be open on `tanggal`. */
    tambah: string;
    tanggal: string;
    /** '1' when the URL asks for the open piece's form, not just its record. */
    ubah: string;
    /** The stretch the board covers, and the dates a custom one needs. */
    periode: string;
    dari: string;
    sampai: string;
};

/** The presets the board offers, in the order it offers them. */
const PERIODS = [
    'bulan-ini',
    'bulan-lalu',
    'bulan-depan',
    'kuartal',
    'tahun',
    'semua',
];

type Props = {
    filters: Filters;
    month: ContentMonth;
    statuses: StatusCount[];
    totals: { count: number; late: number; published: number };
    owners: string[];
    items: ContentRow[];
    /** The piece whose panel is open, when the URL names one. */
    selected: SelectedContent | null;
    /** The board's window. Null on the calendar, where the month is it. */
    period: Period | null;
};

/** Only the parameters that differ from the default ride in the URL. */
const DEFAULTS: Record<string, string> = {
    view: 'kalender',
    grup: 'status',
    periode: 'bulan-ini',
    channel: 'semua',
    status: 'semua',
    pj: 'semua',
};

export default function ContentPage({
    filters,
    month,
    statuses,
    totals,
    owners,
    items,
    selected,
    period,
}: Props) {
    const { channels } = useContentPlan();

    /** The one control that types faster than the server can answer. */
    const [query, setQuery] = useState(filters.q);
    const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** The filters in force, as URL parameters: only what differs from the default. */
    const currentQuery = (patch: Record<string, string | null> = {}) => {
        const next: Record<string, string> = {
            bulan: filters.bulan,
            view: filters.view,
            grup: filters.grup,
            channel: filters.channel,
            status: filters.status,
            pj: filters.pj,
            q: query,
            telat: filters.telat,
            hari: filters.hari,
            periode: filters.periode,
            dari: filters.dari,
            sampai: filters.sampai,
        };

        for (const [key, value] of Object.entries(patch)) {
            next[key] = value === null ? '' : value;
        }

        // The month is the default when it is this one.
        if (next.bulan === month.current) {
            delete next.bulan;
        }

        for (const key of Object.keys(next)) {
            if (next[key] === '' || next[key] === DEFAULTS[key]) {
                delete next[key];
            }
        }

        return next;
    };

    const go = (patch: Record<string, string | null>) => {
        const next = currentQuery(patch);

        router.get(contentIndex.url(), next, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const search = (value: string) => {
        setQuery(value);

        if (typing.current) {
            clearTimeout(typing.current);
        }

        typing.current = setTimeout(() => go({ q: value }), 350);
    };

    const boardView = filters.view === 'papan';
    const lateOnly = filters.telat === '1';

    const hasFilters =
        filters.channel !== 'semua' ||
        filters.status !== 'semua' ||
        filters.pj !== 'semua' ||
        filters.q !== '' ||
        lateOnly ||
        filters.hari !== '';

    const reset = () => {
        setQuery('');
        router.get(
            contentIndex.url(),
            {
                ...(filters.bulan !== month.current
                    ? { bulan: filters.bulan }
                    : {}),
                ...(boardView
                    ? {
                          view: 'papan',
                          grup: filters.grup,
                          periode: filters.periode,
                          dari: filters.dari,
                          sampai: filters.sampai,
                      }
                    : {}),
            },
            { preserveScroll: true, replace: true },
        );
    };

    const acrossStatuses = statuses.reduce((sum, item) => sum + item.count, 0);

    /* The panel is open exactly when the URL names a piece that has not
       just been dismissed. Closing shuts it at once and then clears the
       parameter without touching the calendar underneath. */
    const [dismissed, setDismissed] = useState<SelectedContent | null>(null);
    const sheetOpen = selected !== null && selected !== dismissed;

    const closeSheet = () => {
        setDismissed(selected);
        router.get(
            contentIndex.url({ query: currentQuery() }),
            {},
            {
                only: ['selected'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    /** The channel a new piece starts on: the one filtered for, else IG. */
    const seedChannel =
        filters.channel !== 'semua'
            ? (filters.channel as ChannelKey)
            : 'instagram';

    /* The dialog for a new piece. Local state, seeded once from the URL so a
       link to /content/create still lands on an open form. An existing piece
       is changed inside its own panel instead. */
    const [compose, setCompose] = useState<Compose | null>(() =>
        filters.tambah === '1'
            ? {
                  scheduledFor: filters.tanggal || month.today,
                  channel: seedChannel,
              }
            : null,
    );

    const openAdd = (date: string) =>
        setCompose({ scheduledFor: date, channel: seedChannel });

    /** Drops a parameter that asked for a form, once the form is closed. */
    const tidyUrl = () =>
        router.get(
            contentIndex.url({
                query: {
                    ...currentQuery(),
                    ...(selected
                        ? { konten: String(selected.content.id) }
                        : {}),
                },
            }),
            {},
            {
                only: ['filters'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );

    const closeCompose = (next: boolean) => {
        if (next) {
            return;
        }

        setCompose(null);

        if (filters.tambah === '1') {
            tidyUrl();
        }
    };

    /** The day a new piece starts on: today if it is in view, else the 1st. */
    const defaultDay =
        filters.bulan === month.current ? month.today : month.start;

    /** The calendar as it is, with one piece's panel out. */
    const hrefFor = (id: number) =>
        contentIndex({ query: { ...currentQuery(), konten: String(id) } });

    const moreHref = (date: string) =>
        contentIndex({
            query: {
                ...(filters.bulan !== month.current
                    ? { bulan: filters.bulan }
                    : {}),
                view: 'papan',
                hari: date,
                ...(filters.channel !== 'semua'
                    ? { channel: filters.channel }
                    : {}),
            },
        });

    return (
        <>
            <Head title="Konten" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Konten
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {totals.count}
                                </span>{' '}
                                konten{hasFilters ? ' cocok' : ''}
                                {boardView ? '' : ` di ${month.label}`}
                            </span>
                            {boardView && period ? (
                                <span>· {period.label}</span>
                            ) : null}
                            <span>
                                ·{' '}
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {totals.published}
                                </span>{' '}
                                tayang
                            </span>
                            {totals.late > 0 ? (
                                <span className="font-semibold text-destructive">
                                    · <span data-numeric>{totals.late}</span>{' '}
                                    terlambat
                                </span>
                            ) : null}
                            <span
                                className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-secondary-foreground uppercase"
                                title="Isi awalnya data contoh hasil seeding. Tambah, ubah, dan hapus sudah tersimpan sungguhan."
                            >
                                Data contoh
                            </span>
                        </p>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
                        <div className="flex rounded-md border border-border bg-card p-1 shadow-lift">
                            <ViewButton
                                active={!boardView}
                                onClick={() => go({ view: 'kalender' })}
                                label="Kalender"
                            >
                                <CalendarDays
                                    className="size-4"
                                    strokeWidth={2}
                                />
                            </ViewButton>
                            <ViewButton
                                active={boardView}
                                onClick={() => go({ view: 'papan' })}
                                label="Papan"
                            >
                                <Columns3 className="size-4" strokeWidth={2} />
                            </ViewButton>
                        </div>

                        {/* A calendar can only ever draw one month, so it
                            steps months; a board can cover any stretch, so it
                            asks for one. One window control at a time, and it
                            is the view that decides which. */}
                        {boardView && period ? (
                            <PeriodFilter
                                period={period}
                                options={PERIODS}
                                className="flex-1 sm:flex-none"
                                onChange={(next) =>
                                    go({
                                        periode: next.periode,
                                        dari: next.dari ?? null,
                                        sampai: next.sampai ?? null,
                                        hari: null,
                                    })
                                }
                            />
                        ) : (
                            <div className="flex flex-1 items-center gap-1 rounded-md border border-border bg-card p-1 shadow-lift sm:flex-none">
                                <MonthButton
                                    onClick={() =>
                                        go({ bulan: month.prev, hari: null })
                                    }
                                    label="Bulan sebelumnya"
                                >
                                    <ChevronLeft
                                        className="size-4"
                                        strokeWidth={2.5}
                                    />
                                </MonthButton>
                                <span className="min-w-0 flex-1 truncate px-2 text-center text-[0.8438rem] font-bold sm:min-w-[9rem]">
                                    {month.label}
                                </span>
                                <MonthButton
                                    onClick={() =>
                                        go({ bulan: month.next, hari: null })
                                    }
                                    label="Bulan berikutnya"
                                >
                                    <ChevronRight
                                        className="size-4"
                                        strokeWidth={2.5}
                                    />
                                </MonthButton>
                                {filters.bulan !== month.current ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            go({
                                                bulan: month.current,
                                                hari: null,
                                            })
                                        }
                                        className="rounded-sm px-2 py-1.5 text-xs font-bold text-primary-deep transition-colors hover:bg-primary-soft"
                                    >
                                        Bulan ini
                                    </button>
                                ) : null}
                            </div>
                        )}

                        <Button
                            size="lg"
                            className="w-full shadow-teal sm:w-auto"
                            onClick={() => openAdd(defaultDay)}
                        >
                            <Plus strokeWidth={2} aria-hidden />
                            Tambah Konten
                        </Button>
                    </div>
                </div>

                {/* One line of controls. The status segments double as the
                    production read: how much is still in draft, waiting on
                    review, or ready. They scroll sideways where the row is
                    narrow; on a phone the search takes a row of its own. */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <label className="order-first flex w-full min-w-0 items-center gap-2.5 rounded-md border border-border bg-card px-3.5 py-2.5 text-muted-foreground shadow-lift transition-[box-shadow,border-color] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/40 sm:order-none sm:w-48">
                        <Search
                            className="size-4 shrink-0"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                        <span className="sr-only">Cari konten</span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => search(event.target.value)}
                            placeholder="Cari konten…"
                            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-[0.8438rem]"
                        />
                    </label>

                    <div
                        role="group"
                        aria-label="Status"
                        className="flex max-w-full overflow-x-auto rounded-md border border-border bg-card p-1 shadow-lift"
                    >
                        <Segment
                            label="Semua"
                            count={acrossStatuses}
                            active={filters.status === 'semua'}
                            onClick={() => go({ status: 'semua' })}
                        />
                        {statuses.map((item) => (
                            <Segment
                                key={item.key}
                                label={item.label}
                                count={item.count}
                                active={filters.status === item.key}
                                onClick={() => go({ status: item.key })}
                            />
                        ))}
                    </div>

                    {/* The board's own control, so it only appears with it. */}
                    {boardView ? (
                        <FilterSelect
                            label="Kelompokkan"
                            className="w-auto flex-1 sm:flex-none"
                            value={filters.grup}
                            onChange={(value) => go({ grup: value })}
                            options={GROUPS.map((option) => ({
                                value: option.key,
                                label: option.label,
                            }))}
                        />
                    ) : null}

                    <FilterSelect
                        label="Channel"
                        className="w-auto flex-1 sm:flex-none"
                        value={filters.channel}
                        onChange={(value) => go({ channel: value })}
                        options={[
                            { value: 'semua', label: 'Semua channel' },
                            ...Object.entries(channels).map(
                                ([value, label]) => ({ value, label }),
                            ),
                        ]}
                    />

                    <FilterSelect
                        label="Penanggung jawab"
                        className="w-auto flex-1 sm:flex-none"
                        value={filters.pj}
                        onChange={(value) => go({ pj: value })}
                        options={[
                            { value: 'semua', label: 'Semua PJ' },
                            ...owners.map((name) => ({
                                value: name,
                                label: name,
                            })),
                            { value: 'tanpa', label: 'Belum ditentukan' },
                        ]}
                    />

                    <button
                        type="button"
                        onClick={() => go({ telat: lateOnly ? null : '1' })}
                        aria-pressed={lateOnly}
                        className={cn(
                            'flex-1 rounded-md border px-3 py-2.5 text-[0.8438rem] font-bold whitespace-nowrap shadow-lift transition-colors sm:flex-none',
                            lateOnly
                                ? 'border-destructive bg-destructive text-destructive-foreground'
                                : 'border-border bg-card text-secondary-foreground hover:border-destructive/40 hover:text-destructive',
                        )}
                    >
                        Hanya terlambat
                    </button>

                    {filters.hari ? (
                        <button
                            type="button"
                            onClick={() => go({ hari: null })}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary-soft px-3 py-2.5 text-[0.8438rem] font-bold whitespace-nowrap text-primary-deep shadow-lift transition-colors hover:bg-accent"
                        >
                            {dayLabel(filters.hari)}
                            <X
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            <span className="sr-only">
                                Tampilkan seluruh bulan
                            </span>
                        </button>
                    ) : null}

                    {hasFilters ? (
                        <button
                            type="button"
                            onClick={reset}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-2.5 text-[0.8438rem] font-bold text-muted-foreground underline decoration-transparent underline-offset-4 transition-colors hover:text-destructive hover:decoration-current"
                        >
                            <X
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            Bersihkan
                        </button>
                    ) : null}
                </div>

                <p className="-mt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
                        <span
                            className="size-1.5 rounded-full bg-destructive"
                            aria-hidden
                        />
                        Merah
                    </span>{' '}
                    = lewat tanggal tayang dan belum published.{' '}
                    {boardView
                        ? 'Seret kartu untuk memindahkannya. Kolom channel hanya bisa dibaca karena satu konten bisa tayang di beberapa channel sekaligus, dan untuk menayangkan buka kontennya.'
                        : 'Chip berwarna channel berarti sudah tayang; chip bergaris putus berarti belum, dan titik di ujungnya menunjukkan statusnya. Klik tanggal di kalender untuk menambah konten di hari itu.'}
                </p>

                {items.length === 0 && (hasFilters || boardView) ? (
                    <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
                        <EmptyResult
                            filtered={hasFilters}
                            month={month.label}
                            onReset={reset}
                            onAdd={() => openAdd(defaultDay)}
                        />
                    </section>
                ) : boardView ? (
                    <ContentBoard
                        items={items}
                        group={filters.grup}
                        owners={owners}
                        hrefFor={hrefFor}
                    />
                ) : (
                    <>
                        <div className="hidden md:block">
                            <ContentCalendar
                                month={month}
                                items={items}
                                onAdd={openAdd}
                                moreHref={moreHref}
                                hrefFor={hrefFor}
                            />
                        </div>

                        {/* The phone reads the same month as a list. */}
                        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-lift md:hidden">
                            {items.length === 0 ? (
                                <EmptyResult
                                    filtered={false}
                                    month={month.label}
                                    onReset={reset}
                                    onAdd={() => openAdd(defaultDay)}
                                />
                            ) : (
                                <ContentAgenda
                                    items={items}
                                    today={month.today}
                                    hrefFor={hrefFor}
                                />
                            )}
                        </section>
                    </>
                )}
            </div>

            <ContentSheet
                selected={selected}
                open={sheetOpen}
                onClose={closeSheet}
                startInEdit={filters.ubah === '1'}
                onStopEditing={() => {
                    if (filters.ubah === '1') {
                        tidyUrl();
                    }
                }}
            />

            <ContentDialog
                compose={compose}
                open={compose !== null}
                onOpenChange={closeCompose}
            />
        </>
    );
}

/** One status in the segmented control, carrying its own count. */
function Segment({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[0.8438rem] font-bold whitespace-nowrap transition-colors',
                active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-secondary-foreground hover:text-primary-deep',
            )}
        >
            {label}
            <span
                className={cn(
                    'rounded-full px-1.5 py-px text-[0.6875rem] font-extrabold',
                    active
                        ? 'bg-white/20 text-white'
                        : 'bg-neutral-soft text-muted-foreground',
                )}
                data-numeric
            >
                {count}
            </span>
        </button>
    );
}

function ViewButton({
    children,
    active,
    onClick,
    label,
}: {
    children: React.ReactNode;
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[0.8438rem] font-bold transition-colors',
                active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-secondary-foreground hover:text-primary-deep',
            )}
        >
            {children}
            {label}
        </button>
    );
}

function MonthButton({
    children,
    onClick,
    label,
}: {
    children: React.ReactNode;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="grid size-8 shrink-0 place-items-center rounded-sm text-secondary-foreground transition-colors hover:bg-neutral-soft hover:text-primary-deep"
        >
            {children}
            <span className="sr-only">{label}</span>
        </button>
    );
}

function EmptyResult({
    filtered,
    month,
    onReset,
    onAdd,
}: {
    filtered: boolean;
    month: string;
    onReset: () => void;
    onAdd: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                {filtered ? (
                    <Search className="size-5" strokeWidth={1.75} aria-hidden />
                ) : (
                    <CalendarDays
                        className="size-5"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                )}
            </span>
            <p className="text-sm font-bold">
                {filtered
                    ? 'Tidak ada konten yang cocok'
                    : `Belum ada konten di ${month}`}
            </p>
            <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
                {filtered
                    ? 'Coba longgarkan salah satu filter, atau bersihkan semuanya untuk melihat seluruh bulan.'
                    : 'Rencanakan yang mau tayang bulan ini. Konten yang tersimpan langsung muncul di kalender pada tanggalnya.'}
            </p>
            {filtered ? (
                <button
                    type="button"
                    onClick={onReset}
                    className="mt-1 rounded-md bg-primary-soft px-3 py-2 text-[0.8438rem] font-bold text-primary-deep transition-colors hover:bg-accent"
                >
                    Bersihkan filter
                </button>
            ) : (
                <Button className="mt-1 shadow-teal" onClick={onAdd}>
                    <Plus strokeWidth={2} aria-hidden />
                    Tambah Konten
                </Button>
            )}
        </div>
    );
}

ContentPage.layout = {
    breadcrumbs: [
        {
            title: 'Konten',
            href: contentIndex(),
        },
    ],
};
