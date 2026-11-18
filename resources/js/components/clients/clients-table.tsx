import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { SortHead } from '@/components/sort-head';
import { Checkbox } from '@/components/ui/checkbox';
import type { Client } from '@/data/clients';
import { CHANNEL_LABELS } from '@/data/dashboard';
import { contractLength, entryDate, shortRupiah } from '@/data/leads';
import { useInitials } from '@/hooks/use-initials';
import { rowLink } from '@/lib/row-link';
import { cn } from '@/lib/utils';
import { show as leadShow } from '@/routes/leads';

export type ClientSort = 'sejak' | 'kontrak' | 'nilai' | 'nama';

type Props = {
    rows: Client[];
    sort: ClientSort;
    onSort: (sort: ClientSort) => void;
    /** Days before its end that a contract reads as running out. */
    endingSoonDays: number;
    selected: Set<number>;
    onToggle: (id: number) => void;
    /** Picks or clears every row on this page that can be picked. */
    onToggleAll: (pick: boolean) => void;
};

export function ClientsTable({
    rows,
    sort,
    onSort,
    endingSoonDays,
    selected,
    onToggle,
    onToggleAll,
}: Props) {
    const initials = useInitials();

    const pickable = rows.filter((client) => client.locked === null);
    const picked = pickable.filter((client) => selected.has(client.id)).length;

    return (
        <>
            {/* Table at reading width; seven columns are unusable on a phone. */}
            <div className="hidden lg:block">
                <table className="w-full border-collapse text-left">
                    <caption className="sr-only">
                        Daftar client aktif beserta layanan, asal konten, nilai
                        kerja sama, sejak kapan menjadi client, dan masa
                        kontraknya.
                    </caption>
                    <thead>
                        <tr className="group/head border-b border-border text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                            <th scope="col" className="w-8 py-3 pr-3">
                                <Checkbox
                                    checked={
                                        picked === 0
                                            ? false
                                            : picked === pickable.length
                                              ? true
                                              : 'indeterminate'
                                    }
                                    onCheckedChange={(checked) =>
                                        onToggleAll(checked === true)
                                    }
                                    disabled={pickable.length === 0}
                                    aria-label="Pilih semua client di halaman ini"
                                />
                            </th>
                            <SortHead
                                label="Client"
                                column="nama"
                                sort={sort}
                                onSort={onSort}
                            />
                            <th scope="col" className="py-3 pr-4 font-bold">
                                Asal
                            </th>
                            <SortHead
                                label="Nilai"
                                column="nilai"
                                sort={sort}
                                onSort={onSort}
                                align="right"
                            />
                            <SortHead
                                label="Client sejak"
                                column="sejak"
                                sort={sort}
                                onSort={onSort}
                                align="right"
                            />
                            <SortHead
                                label="Kontrak"
                                column="kontrak"
                                sort={sort}
                                onSort={onSort}
                                align="right"
                            />
                            <th scope="col" className="py-3 pl-6 font-bold">
                                Penanggung jawab
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((client) => (
                            <tr
                                key={client.id}
                                {...rowLink(leadShow(client.id))}
                                className={cn(
                                    'cursor-pointer border-b border-border text-[0.8438rem] transition-colors last:border-b-0 hover:bg-neutral-soft',
                                    selected.has(client.id) &&
                                        'bg-primary-soft/50',
                                )}
                            >
                                <td className="w-8 pr-3">
                                    <PickBox
                                        client={client}
                                        checked={selected.has(client.id)}
                                        onToggle={onToggle}
                                        className="py-3"
                                    />
                                </td>
                                <th
                                    scope="row"
                                    className="max-w-[18rem] py-3 pr-4 text-left font-normal"
                                >
                                    <Link
                                        href={leadShow(client.id)}
                                        prefetch
                                        className="block truncate font-bold underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                                    >
                                        {client.company}
                                    </Link>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {client.pic} · {client.service}
                                    </span>
                                    {/* Only the exception is marked: an active
                                        client is the normal state and says
                                        nothing, a signed deal says so. */}
                                    {client.stage === 'deal' ? (
                                        <span className="mt-1 inline-flex rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                                            {client.stageLabel}
                                        </span>
                                    ) : null}
                                </th>
                                <td className="max-w-[14rem] py-3 pr-4">
                                    <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-secondary-foreground">
                                        <ChannelIcon
                                            channel={client.channel}
                                            className="size-3 text-muted-foreground"
                                        />
                                        <span className="truncate">
                                            {CHANNEL_LABELS[client.channel]}
                                        </span>
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {client.source}
                                    </span>
                                </td>
                                <td
                                    className="py-3 pr-4 text-right font-bold whitespace-nowrap"
                                    data-numeric
                                >
                                    {shortRupiah(client.value)}
                                </td>
                                <td className="py-3 pr-4 text-right whitespace-nowrap">
                                    <span className="block" data-numeric>
                                        {entryDate(client.since)}
                                    </span>
                                    <span
                                        className="block text-xs text-muted-foreground"
                                        data-numeric
                                    >
                                        {client.daysInStage} hari
                                    </span>
                                </td>
                                <td className="py-3 pr-4 text-right whitespace-nowrap">
                                    <ContractMark
                                        client={client}
                                        endingSoonDays={endingSoonDays}
                                    />
                                </td>
                                <td className="py-3 pl-6 whitespace-nowrap">
                                    {client.owner ? (
                                        <span className="inline-flex items-center gap-2 font-semibold text-secondary-foreground">
                                            <span
                                                className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.6875rem] font-extrabold text-primary-deep"
                                                aria-hidden
                                            >
                                                {initials(client.owner)}
                                            </span>
                                            {client.owner}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            Belum ditentukan
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Phone and tablet: one card per client, same facts, stacked. The
                checkbox sits outside the link, which may not hold a control. */}
            <ul className="flex flex-col lg:hidden">
                {rows.map((client) => (
                    <li
                        key={client.id}
                        className={cn(
                            'flex items-center border-b border-border',
                            selected.has(client.id) && 'bg-primary-soft/50',
                        )}
                    >
                        <PickBox
                            client={client}
                            checked={selected.has(client.id)}
                            onToggle={onToggle}
                            className="self-stretch pr-3"
                        />
                        <Link
                            href={leadShow(client.id)}
                            prefetch
                            className="-mr-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-3.5 transition-colors hover:bg-neutral-soft"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                    <span className="min-w-0 truncate text-[0.8438rem] font-bold">
                                        {client.company}
                                    </span>
                                    {client.stage === 'deal' ? (
                                        <span className="shrink-0 rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                                            {client.stageLabel}
                                        </span>
                                    ) : null}
                                </span>
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                    <span className="truncate">
                                        {client.service}
                                    </span>
                                    <span aria-hidden>·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <ChannelIcon
                                            channel={client.channel}
                                            className="size-3"
                                        />
                                        {CHANNEL_LABELS[client.channel]}
                                    </span>
                                    <span aria-hidden>·</span>
                                    <span
                                        className="font-semibold text-foreground"
                                        data-numeric
                                    >
                                        {shortRupiah(client.value)}
                                    </span>
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                    <span>
                                        Sejak{' '}
                                        <span data-numeric>
                                            {entryDate(client.since)}
                                        </span>
                                    </span>
                                    <span aria-hidden>·</span>
                                    <ContractMark
                                        client={client}
                                        endingSoonDays={endingSoonDays}
                                        inline
                                    />
                                    <span aria-hidden>·</span>
                                    <span>
                                        {client.owner ?? 'Belum ada PJ'}
                                    </span>
                                </span>
                            </span>
                            <ChevronRight
                                className="size-4 shrink-0 text-muted-foreground"
                                strokeWidth={2}
                                aria-hidden
                            />
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}

/**
 * The row's checkbox, inside a label so the whole cell takes the click
 * instead of opening the record. A client that cannot be deleted keeps the
 * box, switched off, with the reason on hover and for a screen reader.
 */
function PickBox({
    client,
    checked,
    onToggle,
    className,
}: {
    client: Client;
    checked: boolean;
    onToggle: (id: number) => void;
    className?: string;
}) {
    const locked = client.locked !== null;

    return (
        <label
            className={cn(
                'flex items-center',
                locked ? 'cursor-not-allowed' : 'cursor-pointer',
                className,
            )}
            title={client.locked ?? undefined}
        >
            <Checkbox
                checked={!locked && checked}
                onCheckedChange={() => onToggle(client.id)}
                disabled={locked}
                aria-label={
                    locked
                        ? `${client.company} tidak bisa dihapus: ${client.locked}`
                        : `Pilih ${client.company}`
                }
            />
        </label>
    );
}

/**
 * How long the contract has left. Red only once it has run out while the
 * client is still on the books: a breach, not a decoration. No term at all is
 * a client engaged on the spot.
 */
function ContractMark({
    client,
    endingSoonDays,
    inline = false,
}: {
    client: Client;
    endingSoonDays: number;
    inline?: boolean;
}) {
    const { contract } = client;

    if (contract === null) {
        return <span className="text-muted-foreground">On spot</span>;
    }

    const end = entryDate(contract.end);
    const length = contractLength(contract.months);

    if (contract.daysLeft < 0) {
        const ended = (
            <span className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap text-destructive">
                <span
                    className="size-1.5 shrink-0 rounded-full bg-destructive"
                    aria-hidden
                />
                <span>
                    Habis <span data-numeric>{end}</span>
                </span>
            </span>
        );

        if (inline) {
            return ended;
        }

        return (
            <span className="inline-flex flex-col items-end">
                {ended}
                <span className="text-xs text-muted-foreground">{length}</span>
            </span>
        );
    }

    const soon = contract.daysLeft <= endingSoonDays;
    const lead = soon ? (
        <span className="font-bold text-foreground" data-numeric>
            Sisa {contract.daysLeft} hari
        </span>
    ) : (
        <span>{length}</span>
    );

    if (inline) {
        return (
            <span className="whitespace-nowrap">
                {lead} · s/d <span data-numeric>{end}</span>
            </span>
        );
    }

    return (
        <span className="inline-flex flex-col items-end whitespace-nowrap">
            {lead}
            <span className="text-xs text-muted-foreground">
                s/d <span data-numeric>{end}</span>
            </span>
        </span>
    );
}
