import { Head, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Instagram, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ContentList } from '@/components/performance/content-list';
import type { Sort } from '@/components/performance/content-list';
import { PerformanceHeader } from '@/components/performance/performance-header';
import { PostSheet } from '@/components/performance/post-sheet';
import type { Period } from '@/components/period-filter';
import {
    Select as SelectRoot,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { nf } from '@/data/instagram';
import type {
    InstagramAccount,
    PostDetail,
    PostRow,
    Platform as PlatformOption,
    PlatformKey,
} from '@/data/instagram';
import { cn } from '@/lib/utils';
import { performance } from '@/routes';
import { content as performanceContent } from '@/routes/performance';

const SORTS: { key: Sort; label: string }[] = [
    { key: 'terbaru', label: 'Terbaru tayang' },
    { key: 'terlama', label: 'Terlama tayang' },
    { key: 'interaksi', label: 'Interaksi terbanyak' },
    { key: 'pemutaran', label: 'Pemutaran terbanyak' },
    { key: 'suka', label: 'Suka terbanyak' },
];

type Props = {
    connected: boolean;
    platform: PlatformKey;
    platforms: PlatformOption[];
    /** The shapes this account's posts come in, key to label. */
    formatLabels: Record<string, string>;
    handle: string;
    account: InstagramAccount | null;
    filters: { q: string; format: string; urut: Sort };
    /** The stretch these rows are read over. */
    period: Period;
    formatCounts: Record<string, number>;
    rows: PostRow[];
    totals: {
        stored: number;
        onAccount: number;
        matched: number;
        from: number;
        to: number;
        current: number;
        last: number;
    } | null;
    selected: PostDetail | null;
};

/** Only what differs from the default rides in the URL. */
const DEFAULTS: Record<string, string> = {
    format: 'semua',
    urut: 'terbaru',
    periode: 'semua',
};

export default function PerformanceContent({
    connected,
    platform,
    platforms,
    formatLabels,
    handle,
    account,
    filters,
    period,
    formatCounts,
    rows,
    totals,
    selected,
}: Props) {
    const [query, setQuery] = useState(filters.q);
    const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

    const params = () => ({
        ...(platform === 'instagram' ? {} : { platform }),
        q: query,
        format: filters.format,
        urut: filters.urut,
        periode: period.key,
        ...(period.key === 'khusus'
            ? { dari: period.from ?? '', sampai: period.to ?? '' }
            : { dari: '', sampai: '' }),
    });

    const go = (patch: Record<string, string | number | null>) => {
        const next: Record<string, string> = { ...params() };

        for (const [key, value] of Object.entries(patch)) {
            next[key] = value === null ? '' : String(value);
        }

        if (!('page' in patch)) {
            delete next.page;
        }

        for (const key of Object.keys(next)) {
            if (next[key] === '' || next[key] === DEFAULTS[key]) {
                delete next[key];
            }
        }

        router.get(performanceContent.url(), next, {
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

    /* The panel is open exactly when the URL names a post that has not just
       been dismissed. Closing shuts it at once, then clears the parameter. */
    const [dismissed, setDismissed] = useState<PostDetail | null>(null);
    const sheetOpen = selected !== null && selected !== dismissed;

    const closeSheet = () => {
        setDismissed(selected);
        router.get(
            performanceContent.url(),
            Object.fromEntries(
                Object.entries(params()).filter(
                    ([key, value]) => value !== '' && value !== DEFAULTS[key],
                ),
            ),
            {
                only: ['selected'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const open = (code: string) =>
        router.get(
            performanceContent.url(),
            { ...params(), konten: code },
            {
                only: ['selected'],
                preserveState: true,
                preserveScroll: true,
            },
        );

    const hasFilters = filters.q !== '' || filters.format !== 'semua';

    const reset = () => {
        setQuery('');
        router.get(
            performanceContent.url(),
            {},
            { preserveScroll: true, replace: true },
        );
    };

    return (
        <>
            <Head title="Konten Instagram" />

            <div className="animate-settle flex flex-1 flex-col gap-5 p-4 sm:p-6">
                <PerformanceHeader
                    handle={handle}
                    account={account}
                    connected={connected}
                    view="konten"
                    platform={platform}
                    platforms={platforms}
                    period={period}
                    onPeriodChange={(next) =>
                        go({
                            periode: next.periode,
                            dari: next.dari ?? null,
                            sampai: next.sampai ?? null,
                        })
                    }
                />

                {account && totals ? (
                    <>
                        {/*
                         | One row of controls: which shapes, which words,
                         | which order. The format chips lead because they are
                         | also the count read, and the search takes whatever
                         | width is left over rather than a line of its own.
                         */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="-mx-1 -my-1 max-w-full min-w-0 overflow-x-auto px-1 py-1">
                                <div className="flex min-w-max gap-2.5">
                                    {/* The shapes this account actually posts:
                                        Instagram has four, TikTok has two. */}
                                    {['semua', ...Object.keys(formatLabels)]
                                        .filter(
                                            (format) =>
                                                format === 'semua' ||
                                                (formatCounts[format] ?? 0) > 0,
                                        )
                                        .map((format) => (
                                            <FormatChip
                                                key={format}
                                                label={
                                                    format === 'semua'
                                                        ? 'Semua'
                                                        : (formatLabels[
                                                              format
                                                          ] ?? format)
                                                }
                                                count={
                                                    formatCounts[format] ?? 0
                                                }
                                                active={
                                                    filters.format === format
                                                }
                                                onClick={() => go({ format })}
                                            />
                                        ))}
                                </div>
                            </div>

                            <label className="flex w-full min-w-[11rem] flex-1 basis-full items-center gap-2.5 rounded-md border border-border bg-card px-3.5 py-2.5 text-muted-foreground shadow-lift transition-[box-shadow,border-color] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/40 sm:w-auto sm:max-w-sm sm:basis-auto">
                                <Search
                                    className="size-4 shrink-0"
                                    strokeWidth={1.75}
                                    aria-hidden
                                />
                                <span className="sr-only">Cari konten</span>
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) =>
                                        search(event.target.value)
                                    }
                                    placeholder="Cari keterangan, hashtag, lokasi…"
                                    className="min-w-0 flex-1 bg-transparent text-[0.8438rem] text-foreground outline-none placeholder:text-muted-foreground"
                                />
                            </label>

                            <SelectRoot
                                value={filters.urut}
                                onValueChange={(value) => go({ urut: value })}
                            >
                                <SelectTrigger
                                    aria-label="Urutkan"
                                    className="h-auto w-auto rounded-md border-border bg-card py-2.5 text-[0.8438rem] font-semibold text-secondary-foreground shadow-lift transition-colors hover:border-primary/35 focus-visible:ring-[3px] data-[state=open]:border-primary/40"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORTS.map((item) => (
                                        <SelectItem
                                            key={item.key}
                                            value={item.key}
                                            className="text-[0.8438rem]"
                                        >
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </SelectRoot>

                            {hasFilters ? (
                                <button
                                    type="button"
                                    onClick={reset}
                                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-2.5 text-[0.8438rem] font-bold text-muted-foreground underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
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

                        <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {nf.format(totals.stored)}
                            </span>{' '}
                            konten tersimpan dari{' '}
                            <span data-numeric>
                                {nf.format(totals.onAccount)}
                            </span>{' '}
                            yang ada di akun. Setiap kali data diperbarui,
                            konten baru ditambahkan ke daftar ini dan yang lama
                            tetap tersimpan.
                        </p>

                        {rows.length === 0 ? (
                            <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
                                <EmptyResult onReset={reset} />
                            </section>
                        ) : (
                            <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lift">
                                <div className="min-w-0 px-3.5 sm:px-4">
                                    <ContentList
                                        rows={rows}
                                        sort={filters.urut}
                                        onOpen={open}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3.5 text-xs sm:p-4">
                                    <p className="text-muted-foreground">
                                        Menampilkan{' '}
                                        <span
                                            className="font-bold text-foreground"
                                            data-numeric
                                        >
                                            {totals.from}–{totals.to}
                                        </span>{' '}
                                        dari{' '}
                                        <span
                                            className="font-bold text-foreground"
                                            data-numeric
                                        >
                                            {totals.matched}
                                        </span>{' '}
                                        konten
                                    </p>

                                    <div className="flex items-center gap-1.5">
                                        <PageButton
                                            onClick={() =>
                                                go({ page: totals.current - 1 })
                                            }
                                            disabled={totals.current === 1}
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
                                            {totals.current} / {totals.last}
                                        </span>
                                        <PageButton
                                            onClick={() =>
                                                go({ page: totals.current + 1 })
                                            }
                                            disabled={
                                                totals.current === totals.last
                                            }
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
                        )}
                    </>
                ) : (
                    <NothingYet connected={connected} />
                )}
            </div>

            <PostSheet
                post={selected}
                open={sheetOpen}
                onOpenChange={(next) => {
                    if (!next) {
                        closeSheet();
                    }
                }}
            />
        </>
    );
}

function FormatChip({
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
                'flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-[0.8438rem] font-bold whitespace-nowrap transition-colors',
                active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-secondary-foreground shadow-lift hover:border-primary/35 hover:text-primary-deep',
            )}
        >
            {label}
            <span
                className={cn(
                    'rounded-full px-1.5 py-px text-[0.6875rem] font-extrabold',
                    active
                        ? 'bg-white/20 text-primary-foreground'
                        : 'bg-neutral-soft text-muted-foreground',
                )}
                data-numeric
            >
                {count}
            </span>
        </button>
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
            <p className="text-sm font-bold">Tidak ada konten yang cocok</p>
            <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
                Coba longgarkan pencarian atau pilih format lain.
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

function NothingYet({ connected }: { connected: boolean }) {
    return (
        <section className="flex min-w-0 flex-col items-center gap-3 rounded-xl border border-border bg-card py-14 text-center shadow-lift">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                <Instagram className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm font-bold">Belum ada konten tersimpan</p>
            <p className="max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
                {connected
                    ? 'Tekan Perbarui data di atas untuk menarik konten terakhir dari Instagram.'
                    : 'Isi APIFY_TOKEN di berkas .env dulu, lalu tekan Perbarui data.'}
            </p>
        </section>
    );
}

PerformanceContent.layout = {
    breadcrumbs: [
        { title: 'Performa', href: performance() },
        { title: 'Konten', href: performanceContent() },
    ],
};
