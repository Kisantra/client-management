import { Head, Link, router } from '@inertiajs/react';
import { Briefcase, Plus, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ClientLedger } from '@/components/clients/client-ledger';
import { ClientsTable } from '@/components/clients/clients-table';
import type { ClientSort } from '@/components/clients/clients-table';
import { ContentList } from '@/components/clients/content-list';
import { ShareList } from '@/components/clients/share-list';
import { CountChip } from '@/components/count-chip';
import { Panel } from '@/components/dashboard/panel';
import { FilterSelect } from '@/components/filter-select';
import { ListPager } from '@/components/list-pager';
import { Button } from '@/components/ui/button';
import type {
    Client,
    ClientSummary,
    ContentShare,
    Share,
} from '@/data/clients';
import { rupiah } from '@/data/leads';
import { clients } from '@/routes';
import { create as leadsCreate } from '@/routes/leads';

const SORTS: { key: ClientSort; label: string }[] = [
    { key: 'sejak', label: 'Paling baru jadi client' },
    { key: 'kontak', label: 'Paling lama tak dihubungi' },
    { key: 'nilai', label: 'Nilai terbesar' },
    { key: 'nama', label: 'Nama A–Z' },
];

type Filters = {
    q: string;
    layanan: string;
    channel: string;
    /** A person's name, 'tanpa' for the unassigned, or 'semua'. */
    pj: string;
    urut: ClientSort;
};

type Props = {
    filters: Filters;
    /** Active clients before any filter: decides which empty state shows. */
    total: number;
    /** Days without contact after which a client counts as due a call. */
    contactThreshold: number;
    summary: ClientSummary;
    channels: Share[];
    owners: Share[];
    sources: ContentShare[];
    services: string[];
    rows: {
        data: Client[];
        from: number;
        to: number;
        total: number;
        current: number;
        last: number;
    };
};

/** Only the parameters that differ from the default ride in the URL. */
const DEFAULTS: Record<string, string> = {
    layanan: 'semua',
    channel: 'semua',
    pj: 'semua',
    urut: 'sejak',
};

/** The form opens on the last stage: a client that predates the tool. */
const addClient = leadsCreate({ query: { tahap: 'client' } });

export default function Clients({
    filters,
    total,
    contactThreshold,
    summary,
    channels,
    owners,
    sources,
    services,
    rows,
}: Props) {
    /** The one control that types faster than the server can answer. */
    const [query, setQuery] = useState(filters.q);
    const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

    const go = (patch: Record<string, string | number | null>) => {
        const next: Record<string, string> = {
            q: query,
            layanan: filters.layanan,
            channel: filters.channel,
            pj: filters.pj,
            urut: filters.urut,
        };

        for (const [key, value] of Object.entries(patch)) {
            next[key] = value === null ? '' : String(value);
        }

        // A filter change restarts paging: page 3 of a 1-page result is a dead end.
        if (!('page' in patch)) {
            delete next.page;
        }

        for (const key of Object.keys(next)) {
            if (next[key] === '' || next[key] === DEFAULTS[key]) {
                delete next[key];
            }
        }

        router.get(clients.url(), next, {
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

    const hasFilters =
        filters.q !== '' ||
        filters.layanan !== 'semua' ||
        filters.channel !== 'semua' ||
        filters.pj !== 'semua';

    const reset = () => {
        setQuery('');
        router.get(clients.url(), {}, { preserveScroll: true, replace: true });
    };

    const acrossChannels = channels.reduce((sum, item) => sum + item.count, 0);

    return (
        <>
            <Head title="Client" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Client
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {summary.count}
                                </span>{' '}
                                client {hasFilters ? 'cocok' : 'aktif'}
                            </span>
                            {summary.needsContact > 0 ? (
                                <span className="font-semibold text-destructive">
                                    ·{' '}
                                    <span data-numeric>
                                        {summary.needsContact}
                                    </span>{' '}
                                    perlu disapa
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

                    <Button size="lg" className="shadow-teal" asChild>
                        <Link href={addClient}>
                            <Plus strokeWidth={2} aria-hidden />
                            Tambah Client
                        </Link>
                    </Button>
                </div>

                <ClientLedger
                    summary={summary}
                    threshold={contactThreshold}
                    onNeedsContact={() => go({ urut: 'kontak' })}
                />

                {/* Channel chips double as the read of where clients come from:
                    the counts stay visible whichever one is chosen. */}
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                    <div className="flex min-w-max gap-2.5">
                        <CountChip
                            label="Semua channel"
                            count={acrossChannels}
                            active={filters.channel === 'semua'}
                            onClick={() => go({ channel: 'semua' })}
                        />
                        {channels.map((channel) => (
                            <CountChip
                                key={channel.key}
                                label={channel.label}
                                count={channel.count}
                                active={filters.channel === channel.key}
                                onClick={() => go({ channel: channel.key })}
                            />
                        ))}
                    </div>
                </div>

                {/* Container-less: every control carries its own edge. On a
                    phone the search takes the first row and the rest pair up. */}
                <div className="-mt-2 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
                    <label className="col-span-2 flex min-w-0 items-center gap-2.5 rounded-md border border-border bg-card px-3.5 py-2.5 text-muted-foreground shadow-lift transition-[box-shadow,border-color] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/40 sm:col-span-1 sm:max-w-xs sm:flex-1">
                        <Search
                            className="size-4 shrink-0"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                        <span className="sr-only">Cari client</span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => search(event.target.value)}
                            placeholder="Cari nama, PIC, layanan, PJ…"
                            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-[0.8438rem]"
                        />
                    </label>

                    <FilterSelect
                        label="Layanan"
                        value={filters.layanan}
                        onChange={(value) => go({ layanan: value })}
                        options={[
                            { value: 'semua', label: 'Semua layanan' },
                            ...services.map((service) => ({
                                value: service,
                                label: service,
                            })),
                        ]}
                    />

                    <FilterSelect
                        label="Penanggung jawab"
                        value={filters.pj}
                        onChange={(value) => go({ pj: value })}
                        options={[
                            { value: 'semua', label: 'Semua PJ' },
                            ...owners.map((owner) => ({
                                value: owner.key,
                                label: owner.label,
                            })),
                        ]}
                    />

                    <FilterSelect
                        label="Urutkan"
                        value={filters.urut}
                        onChange={(value) => go({ urut: value })}
                        options={SORTS.map((item) => ({
                            value: item.key,
                            label: item.label,
                        }))}
                    />

                    {hasFilters ? (
                        <button
                            type="button"
                            onClick={reset}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-[0.8438rem] font-bold text-muted-foreground underline decoration-transparent underline-offset-4 transition-colors hover:text-destructive hover:decoration-current sm:justify-start"
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
                        Angka merah
                    </span>{' '}
                    = client yang belum dihubungi lebih dari{' '}
                    <span data-numeric>{contactThreshold}</span> hari.
                </p>

                {total === 0 ? (
                    <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
                        <NoClients />
                    </section>
                ) : rows.total === 0 ? (
                    <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
                        <EmptyResult onReset={reset} />
                    </section>
                ) : (
                    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lift">
                        <div className="min-w-0 px-3.5 sm:px-4">
                            <ClientsTable
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
                                client · nilai{' '}
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {rupiah.format(summary.value)}
                                </span>
                            </p>

                            <ListPager
                                current={rows.current}
                                last={rows.last}
                                onPage={(page) => go({ page })}
                            />
                        </div>
                    </section>
                )}

                {/* The evaluation lens, after the day's work: which content
                    ended in a client, and who is holding them. */}
                <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                    <Panel
                        title="Konten yang menghasilkan client"
                        meta={hasFilters ? 'sesuai filter' : '5 teratas'}
                    >
                        <ContentList items={sources} />
                    </Panel>

                    <Panel
                        title="Per penanggung jawab"
                        action={
                            filters.pj !== 'semua' ? (
                                <button
                                    type="button"
                                    onClick={() => go({ pj: 'semua' })}
                                    className="shrink-0 rounded-md bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-deep transition-colors hover:bg-accent"
                                >
                                    Semua PJ
                                </button>
                            ) : undefined
                        }
                    >
                        <ShareList
                            items={owners}
                            active={filters.pj === 'semua' ? null : filters.pj}
                            onPick={(key) => go({ pj: key ?? 'semua' })}
                            columnLabel="Nama"
                        />
                    </Panel>
                </div>
            </div>
        </>
    );
}

function NoClients() {
    return (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                <Briefcase className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm font-bold">Belum ada client aktif</p>
            <p className="max-w-[40ch] text-xs leading-relaxed text-muted-foreground">
                Client muncul di sini begitu sebuah lead mencapai tahap Client
                aktif. Client yang sudah berjalan sebelum sistem ini dipakai
                bisa ditambahkan langsung.
            </p>
            <Button className="mt-1 shadow-teal" asChild>
                <Link href={addClient}>
                    <Plus strokeWidth={2} aria-hidden />
                    Tambah Client
                </Link>
            </Button>
        </div>
    );
}

function EmptyResult({ onReset }: { onReset: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                <Search className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm font-bold">Tidak ada client yang cocok</p>
            <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
                Coba longgarkan salah satu filter, atau bersihkan semuanya untuk
                melihat seluruh client.
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

Clients.layout = {
    breadcrumbs: [
        {
            title: 'Client',
            href: clients(),
        },
    ],
};
