import { Head, Link, router } from '@inertiajs/react';
import { Briefcase, Plus, Search, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ClientLedger } from '@/components/clients/client-ledger';
import { ClientsTable } from '@/components/clients/clients-table';
import type { ClientSort } from '@/components/clients/clients-table';
import { ContentList } from '@/components/clients/content-list';
import { ShareList } from '@/components/clients/share-list';
import { Panel } from '@/components/dashboard/panel';
import { FilterSelect } from '@/components/filter-select';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { ConfirmDialog } from '@/components/letters/confirm-dialog';
import { ListPager } from '@/components/list-pager';
import { MultiFilterSelect } from '@/components/multi-filter-select';
import { PeriodFilter } from '@/components/period-filter';
import type { Period } from '@/components/period-filter';
import { Button } from '@/components/ui/button';
import type {
    Client,
    ClientSummary,
    ContentShare,
    Share,
} from '@/data/clients';
import type { ChannelKey } from '@/data/dashboard';
import { rupiah } from '@/data/leads';
import { clients } from '@/routes';
import { destroy as clientsDestroy } from '@/routes/clients';
import { create as leadsCreate } from '@/routes/leads';

const SORTS: { key: ClientSort; label: string }[] = [
    { key: 'sejak', label: 'Paling baru jadi client' },
    { key: 'kontrak', label: 'Kontrak paling dekat habis' },
    { key: 'nilai', label: 'Nilai terbesar' },
    { key: 'nama', label: 'Nama A–Z' },
];

/** Read against the day each became a client; the server holds the same list. */
const PERIODS = [
    'minggu-ini',
    'minggu-lalu',
    'bulan-ini',
    'bulan-lalu',
    'kuartal',
    'tahun',
    '30hari',
    '90hari',
    'semua',
];

type Filters = {
    q: string;
    layanan: string;
    /** The channels picked; empty means every channel. */
    channel: string[];
    /** A person's name, 'tanpa' for the unassigned, or 'semua'. */
    pj: string;
    urut: ClientSort;
    periode: string;
    /** Set only for a custom range: YYYY-MM-DD. */
    dari: string;
    sampai: string;
};

type Props = {
    filters: Filters;
    period: Period;
    /** Active clients before any filter: decides which empty state shows. */
    total: number;
    /** Days before its end that a contract counts as running out. */
    endingSoonDays: number;
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
    pj: 'semua',
    urut: 'sejak',
    periode: 'semua',
};

/** The form opens on the last stage: a client that predates the tool. */
const addClient = leadsCreate({ query: { tahap: 'client' } });

export default function Clients({
    filters,
    period,
    total,
    endingSoonDays,
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
    /* Ticked ahead of the server too: a second box ticked before the first
       answer lands must add to the pick, not replace it. */
    const [channelPick, setChannelPick] = useState(filters.channel);

    /*
     | Picked for deletion, on this page only: a filter or page change starts
     | the pick again, so nothing out of sight is ever deleted by surprise.
     */
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    /* What the dialog asks about, fixed when it opens: clearing the pick on
       success must not rewrite it to "0 client" while it fades out. */
    const [doomed, setDoomed] = useState<Client[]>([]);
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const pickable = rows.data.filter((client) => client.locked === null);
    const picked = pickable.filter((client) => selected.has(client.id));

    const toggle = (id: number) =>
        setSelected((current) => {
            const next = new Set(current);

            if (!next.delete(id)) {
                next.add(id);
            }

            return next;
        });

    const toggleAll = (pick: boolean) =>
        setSelected(
            pick ? new Set(pickable.map((client) => client.id)) : new Set(),
        );

    const remove = () => {
        router.delete(clientsDestroy().url, {
            data: { ids: doomed.map((client) => client.id) },
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => {
                setSelected(new Set());
                setConfirming(false);
            },
        });
    };

    const go = (patch: Record<string, string | number | null>) => {
        setSelected(new Set());

        const next: Record<string, string> = {
            q: query,
            layanan: filters.layanan,
            // One comma-joined parameter rather than `channel[0]=…&channel[1]=…`.
            channel: channelPick.join(','),
            pj: filters.pj,
            urut: filters.urut,
            periode: filters.periode,
            dari: filters.dari,
            sampai: filters.sampai,
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
        filters.channel.length > 0 ||
        filters.pj !== 'semua' ||
        filters.periode !== 'semua';

    const reset = () => {
        setQuery('');
        setChannelPick([]);
        setSelected(new Set());
        router.get(clients.url(), {}, { preserveScroll: true, replace: true });
    };

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
                                    {summary.activeCount}
                                </span>{' '}
                                client {hasFilters ? 'cocok' : 'aktif'}
                                {summary.dealCount > 0 ? (
                                    <>
                                        {' · '}
                                        <span data-numeric>
                                            {summary.dealCount}
                                        </span>{' '}
                                        sudah deal
                                    </>
                                ) : null}
                            </span>
                            {summary.expired > 0 ? (
                                <span className="font-semibold text-destructive">
                                    ·{' '}
                                    <span data-numeric>{summary.expired}</span>{' '}
                                    kontrak sudah habis
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

                    {/* The window sits up here, not in the toolbar: it scopes
                        the figures below as well as the list. */}
                    <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
                        <PeriodFilter
                            period={period}
                            options={PERIODS}
                            heading="Menjadi client"
                            months
                            className="h-10 flex-1 sm:flex-none"
                            onChange={(next) =>
                                go({
                                    periode: next.periode,
                                    dari: next.dari ?? null,
                                    sampai: next.sampai ?? null,
                                })
                            }
                        />

                        <Button size="lg" className="shadow-teal" asChild>
                            <Link href={addClient}>
                                <Plus strokeWidth={2} aria-hidden />
                                Tambah Client
                            </Link>
                        </Button>
                    </div>
                </div>

                <ClientLedger
                    summary={summary}
                    endingSoonDays={endingSoonDays}
                    onContracts={() => go({ urut: 'kontrak' })}
                />

                {/* Container-less: every control carries its own edge. On a
                    phone the search takes the first row and the rest pair up. */}
                <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
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

                    {/* The channel list doubles as the read of where clients
                        come from: its counts stay whole whichever are picked. */}
                    <MultiFilterSelect
                        label="Channel"
                        allLabel="Semua channel"
                        noun="channel"
                        value={channelPick}
                        onChange={(picked) => {
                            setChannelPick(picked);
                            go({ channel: picked.join(',') });
                        }}
                        options={channels.map((channel) => ({
                            value: channel.key,
                            label: channel.label,
                            count: channel.count,
                            icon: (
                                <ChannelIcon
                                    channel={channel.key as ChannelKey}
                                />
                            ),
                        }))}
                    />

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
                            className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-[0.8438rem] font-bold text-muted-foreground underline decoration-transparent underline-offset-4 transition-colors hover:text-destructive hover:decoration-current sm:justify-start"
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
                        Tanda merah
                    </span>{' '}
                    = kontraknya sudah lewat tanggal berakhir. Client tanpa
                    durasi kontrak tercatat sebagai on spot.
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
                                endingSoonDays={endingSoonDays}
                                selected={selected}
                                onToggle={toggle}
                                onToggleAll={toggleAll}
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

                {/* Below the list, held to the bottom of the screen while the
                    list scrolls under it: placed above, it would push the rows
                    down the moment the first one is picked. */}
                {picked.length > 0 ? (
                    <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 -mt-2 flex justify-center">
                        <div
                            role="region"
                            aria-label="Client terpilih"
                            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card py-2.5 pr-2.5 pl-4 shadow-lift"
                        >
                            <p className="text-[0.8438rem] font-bold">
                                <span data-numeric>{picked.length}</span> client
                                dipilih
                                {picked.length < pickable.length ? (
                                    <button
                                        type="button"
                                        onClick={() => toggleAll(true)}
                                        className="ml-3 font-semibold text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                                    >
                                        Pilih semua di halaman ini
                                    </button>
                                ) : null}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleAll(false)}
                                >
                                    Batal pilih
                                </Button>
                                {/* Ink to start it; red waits in the dialog,
                                    on the step that destroys. */}
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        setDoomed(picked);
                                        setConfirming(true);
                                    }}
                                    className="bg-ink-panel text-white hover:bg-ink-panel/90"
                                >
                                    <Trash2 strokeWidth={2} aria-hidden />
                                    Hapus
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}

                <ConfirmDialog
                    open={confirming}
                    onOpenChange={setConfirming}
                    title={`Hapus ${doomed.length} client?`}
                    description="Beserta catatan, lampiran, follow-up, riwayat tahap, dan draft suratnya. Penghapusan ini permanen dan tidak bisa dibatalkan."
                    action={`Hapus ${doomed.length} client`}
                    busy={deleting}
                    destructive
                    onConfirm={remove}
                >
                    <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg bg-neutral-soft p-3 text-[0.8438rem] font-semibold">
                        {doomed.map((client) => (
                            <li key={client.id} className="truncate">
                                {client.company}
                            </li>
                        ))}
                    </ul>
                </ConfirmDialog>

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
