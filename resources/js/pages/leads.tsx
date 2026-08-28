import { Head, Link, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Columns3,
    Plus,
    Rows3,
    Search,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { DateRangeFilter } from '@/components/leads/date-range-filter';
import type { EntryRange } from '@/components/leads/date-range-filter';
import { LeadsBoard } from '@/components/leads/leads-board';
import type { BoardColumn } from '@/components/leads/leads-board';
import { LeadsTable } from '@/components/leads/leads-table';
import type { LeadSort } from '@/components/leads/leads-table';
import { Button } from '@/components/ui/button';
import {
    Select as SelectRoot,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CHANNEL_LABELS } from '@/data/dashboard';
import { asDate, rupiah } from '@/data/leads';
import type { Lead } from '@/data/leads';
import { cn } from '@/lib/utils';
import { leads } from '@/routes';
import { create as leadsCreate } from '@/routes/leads';

const SORTS: { key: LeadSort; label: string }[] = [
    { key: 'lama', label: 'Paling lama di tahap' },
    { key: 'nilai', label: 'Estimasi terbesar' },
    { key: 'kontak', label: 'Paling lama tak dihubungi' },
    { key: 'nama', label: 'Nama A–Z' },
    { key: 'masuk', label: 'Paling baru masuk' },
];

type Filters = {
    tahap: string;
    status: string;
    channel: string;
    dari: string | null;
    sampai: string | null;
    q: string;
    urut: LeadSort;
    view: 'tabel' | 'papan';
    /** Leads still being worked, the ones that stopped, or both. */
    tampil: 'aktif' | 'tutup' | 'semua';
    kolom: string | null;
    per: number;
};

type Props = {
    filters: Filters;
    stages: { key: string; label: string; count: number }[];
    /** How many match the filters but have stopped, whatever is being shown. */
    closedCount: number;
    totals: { count: number; value: number; stalled: number };
    rows: {
        data: Lead[];
        from: number;
        to: number;
        total: number;
        current: number;
        last: number;
    } | null;
    columns: BoardColumn[] | null;
};

/** Only the parameters that differ from the default ride in the URL. */
const DEFAULTS: Record<string, string> = {
    tahap: 'semua',
    status: 'semua',
    channel: 'semua',
    urut: 'lama',
    view: 'tabel',
    tampil: 'aktif',
};

export default function Leads({
    filters,
    stages,
    closedCount,
    totals,
    rows,
    columns,
}: Props) {
    /** The one control that types faster than the server can answer. */
    const [query, setQuery] = useState(filters.q);
    const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

    const boardView = filters.view === 'papan';

    const go = (patch: Record<string, string | number | null>) => {
        const next: Record<string, string> = {
            tahap: filters.tahap,
            status: filters.status,
            channel: filters.channel,
            dari: filters.dari ?? '',
            sampai: filters.sampai ?? '',
            q: query,
            urut: filters.urut,
            view: filters.view,
            tampil: filters.tampil,
        };

        for (const [key, value] of Object.entries(patch)) {
            next[key] = value === null ? '' : String(value);
        }

        // A filter change restarts paging: page 4 of a 2-page result is a dead end.
        if (!('page' in patch)) {
            delete next.page;
        }

        for (const key of Object.keys(next)) {
            if (next[key] === '' || next[key] === DEFAULTS[key]) {
                delete next[key];
            }
        }

        router.get(leads.url(), next, {
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

    const entryRange: EntryRange = filters.dari
        ? {
              from: asDate(filters.dari),
              to: filters.sampai ? asDate(filters.sampai) : undefined,
          }
        : undefined;

    const closedView = filters.tampil === 'tutup';

    const hasFilters =
        filters.tahap !== 'semua' ||
        filters.status === 'mandek' ||
        filters.channel !== 'semua' ||
        Boolean(filters.dari) ||
        filters.q !== '' ||
        closedView;

    const reset = () => {
        setQuery('');
        router.get(
            leads.url(),
            filters.view === 'papan' ? { view: 'papan' } : {},
            { preserveScroll: true, replace: true },
        );
    };

    const total = stages.reduce((sum, stage) => sum + stage.count, 0);

    return (
        <>
            <Head title="Leads" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Leads
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {totals.count}
                                </span>{' '}
                                lead{' '}
                                {closedView
                                    ? 'tidak lanjut'
                                    : hasFilters
                                      ? 'cocok'
                                      : 'di papan'}
                            </span>
                            {totals.stalled > 0 ? (
                                <span className="font-semibold text-destructive">
                                    · <span data-numeric>{totals.stalled}</span>{' '}
                                    mandek
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

                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex rounded-md border border-border bg-card p-1 shadow-lift">
                            <ViewButton
                                active={!boardView}
                                onClick={() => go({ view: 'tabel' })}
                                label="Tabel"
                            >
                                <Rows3 className="size-4" strokeWidth={2} />
                            </ViewButton>
                            <ViewButton
                                active={boardView}
                                onClick={() =>
                                    go({ view: 'papan', tampil: 'aktif' })
                                }
                                label="Papan"
                            >
                                <Columns3 className="size-4" strokeWidth={2} />
                            </ViewButton>
                        </div>
                        <Button size="lg" className="shadow-teal" asChild>
                            <Link href={leadsCreate()}>
                                <Plus strokeWidth={2} aria-hidden />
                                Tambah Lead
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Stage filter doubles as the pipeline read: counts stay visible. */}
                <div
                    className={cn(
                        '-mx-1 overflow-x-auto px-1 pb-1',
                        boardView && 'hidden',
                    )}
                >
                    <div className="flex min-w-max gap-2.5">
                        <StageChip
                            label="Semua"
                            count={total}
                            active={filters.tahap === 'semua'}
                            onClick={() => go({ tahap: 'semua' })}
                        />
                        {stages.map((item) => (
                            <StageChip
                                key={item.key}
                                label={item.label}
                                count={item.count}
                                active={filters.tahap === item.key}
                                onClick={() => go({ tahap: item.key })}
                            />
                        ))}

                        {/* Set apart, because stopping is not a step forward.
                            The stage chips keep working inside it, which is how
                            you ask where leads are being lost. */}
                        <span
                            className="mx-1 w-px shrink-0 self-stretch bg-border"
                            aria-hidden
                        />

                        <StageChip
                            label="Tidak lanjut"
                            count={closedCount}
                            active={closedView}
                            tone="closed"
                            onClick={() =>
                                go(
                                    closedView
                                        ? { tampil: 'aktif' }
                                        : { tampil: 'tutup', view: 'tabel' },
                                )
                            }
                        />
                    </div>
                </div>

                {/* Container-less: every control carries its own edge, so the
                    row needs no panel to hold it together. */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-border bg-card px-3.5 py-2.5 text-muted-foreground shadow-lift transition-[box-shadow,border-color] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/40 sm:max-w-xs">
                        <Search
                            className="size-4 shrink-0"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                        <span className="sr-only">Cari lead</span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => search(event.target.value)}
                            placeholder="Cari nama, PIC, layanan…"
                            className="min-w-0 flex-1 bg-transparent text-[0.8438rem] text-foreground outline-none placeholder:text-muted-foreground"
                        />
                    </label>

                    <Select
                        label="Channel"
                        value={filters.channel}
                        onChange={(value) => go({ channel: value })}
                        options={[
                            { value: 'semua', label: 'Semua channel' },
                            ...Object.entries(CHANNEL_LABELS).map(
                                ([value, label]) => ({ value, label }),
                            ),
                        ]}
                    />

                    <DateRangeFilter
                        value={entryRange}
                        onChange={(range) =>
                            go({
                                dari: range?.from ? toIso(range.from) : null,
                                sampai: range?.to ? toIso(range.to) : null,
                            })
                        }
                    />

                    <Select
                        label="Urutkan"
                        value={filters.urut}
                        onChange={(value) => go({ urut: value })}
                        options={SORTS.map((item) => ({
                            value: item.key,
                            label: item.label,
                        }))}
                    />

                    {/* Nothing that has stopped can be late, so the filter
                        and its legend only belong to the live pipeline. */}
                    {closedView ? null : (
                        <button
                            type="button"
                            onClick={() =>
                                go({
                                    status:
                                        filters.status === 'mandek'
                                            ? 'semua'
                                            : 'mandek',
                                })
                            }
                            aria-pressed={filters.status === 'mandek'}
                            className={cn(
                                'rounded-md border px-3 py-2.5 text-[0.8438rem] font-bold shadow-lift transition-colors',
                                filters.status === 'mandek'
                                    ? 'border-destructive bg-destructive text-destructive-foreground'
                                    : 'border-border bg-card text-secondary-foreground hover:border-destructive/40 hover:text-destructive',
                            )}
                        >
                            Hanya mandek
                        </button>
                    )}

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

                <p className="-mt-1 text-xs text-muted-foreground">
                    {closedView ? (
                        <>
                            Lead yang berhenti tetap tercatat di tahap
                            terakhirnya, supaya terlihat di tahap mana lead
                            biasanya gugur. Buka salah satunya untuk
                            menjalankannya lagi.
                        </>
                    ) : (
                        <>
                            <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
                                <span
                                    className="size-1.5 rounded-full bg-destructive"
                                    aria-hidden
                                />
                                Angka merah
                            </span>{' '}
                            = lead mandek, sudah melewati batas wajar tahapnya.
                        </>
                    )}
                </p>

                {boardView && columns ? (
                    <>
                        <LeadsBoard
                            columns={columns}
                            loadMore={(stage, per) => go({ kolom: stage, per })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Seret kartu antar kolom, atau pakai menu di tiap
                            kartu.{' '}
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {totals.count}
                            </span>{' '}
                            lead · estimasi{' '}
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {rupiah.format(totals.value)}
                            </span>
                        </p>
                    </>
                ) : totals.count === 0 ? (
                    <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
                        <EmptyResult onReset={reset} />
                    </section>
                ) : rows ? (
                    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lift">
                        <div className="min-w-0 px-3.5 sm:px-4">
                            <LeadsTable
                                rows={rows.data}
                                sort={filters.urut}
                                onSort={(urut) => go({ urut })}
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3.5 text-xs sm:p-4">
                            <p className="text-muted-foreground">
                                Menampilkan{' '}
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {rows.from}–{rows.to}
                                </span>{' '}
                                dari{' '}
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {rows.total}
                                </span>{' '}
                                lead · estimasi{' '}
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {rupiah.format(totals.value)}
                                </span>
                            </p>

                            <div className="flex items-center gap-1.5">
                                <PageButton
                                    onClick={() =>
                                        go({ page: rows.current - 1 })
                                    }
                                    disabled={rows.current === 1}
                                    label="Halaman sebelumnya"
                                >
                                    <ChevronLeft
                                        className="size-4"
                                        strokeWidth={2.5}
                                    />
                                </PageButton>
                                <span
                                    className="px-1 font-semibold"
                                    data-numeric
                                >
                                    {rows.current} / {rows.last}
                                </span>
                                <PageButton
                                    onClick={() =>
                                        go({ page: rows.current + 1 })
                                    }
                                    disabled={rows.current === rows.last}
                                    label="Halaman berikutnya"
                                >
                                    <ChevronRight
                                        className="size-4"
                                        strokeWidth={2.5}
                                    />
                                </PageButton>
                            </div>
                        </div>
                    </section>
                ) : null}
            </div>
        </>
    );
}

/** Dates travel as plain calendar days; the server never sees a timezone. */
function toIso(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
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

function StageChip({
    label,
    count,
    active,
    onClick,
    tone = 'stage',
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
    /** 'closed' reads in ink rather than teal: it is an exit, not a step. */
    tone?: 'stage' | 'closed';
}) {
    const closed = tone === 'closed';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-[0.8438rem] font-bold whitespace-nowrap transition-colors',
                active
                    ? closed
                        ? 'border-ink-panel bg-ink-panel text-white'
                        : 'border-primary bg-primary text-primary-foreground'
                    : cn(
                          'border-border bg-card text-secondary-foreground shadow-lift',
                          closed
                              ? 'hover:border-ink-panel/35 hover:text-foreground'
                              : 'hover:border-primary/35 hover:text-primary-deep',
                      ),
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

/** Wraps the project's shadcn Select so the toolbar keeps one call shape. */
function Select({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <SelectRoot value={value} onValueChange={onChange}>
            <SelectTrigger
                aria-label={label}
                className="h-auto rounded-md border-border bg-card py-2.5 text-[0.8438rem] font-semibold text-secondary-foreground shadow-lift transition-colors hover:border-primary/35 focus-visible:ring-[3px] data-[state=open]:border-primary/40"
            >
                <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-[0.8438rem]"
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </SelectRoot>
    );
}

function PageButton({
    children,
    onClick,
    disabled,
    label,
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled: boolean;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="grid size-8 place-items-center rounded-md bg-neutral-soft text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
        >
            {children}
            <span className="sr-only">{label}</span>
        </button>
    );
}

function EmptyResult({ onReset }: { onReset: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                <Search className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm font-bold">Tidak ada lead yang cocok</p>
            <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
                Coba longgarkan salah satu filter, atau bersihkan semuanya untuk
                melihat seluruh lead.
            </p>
            <button
                type="button"
                onClick={onReset}
                className="mt-1 rounded-md bg-primary-soft px-3 py-2 text-[0.8438rem] font-bold text-primary-deep transition-colors hover:bg-accent"
            >
                Bersihkan filter
            </button>
        </div>
    );
}

Leads.layout = {
    breadcrumbs: [
        {
            title: 'Leads',
            href: leads(),
        },
    ],
};
