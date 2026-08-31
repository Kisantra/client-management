import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { SortHead } from '@/components/sort-head';
import type { Client } from '@/data/clients';
import { CHANNEL_LABELS } from '@/data/dashboard';
import { entryDate, relativeDays, shortRupiah } from '@/data/leads';
import { useInitials } from '@/hooks/use-initials';
import { show as leadShow } from '@/routes/leads';

export type ClientSort = 'sejak' | 'kontak' | 'nilai' | 'nama';

type Props = {
    rows: Client[];
    sort: ClientSort;
    onSort: (sort: ClientSort) => void;
};

export function ClientsTable({ rows, sort, onSort }: Props) {
    const initials = useInitials();

    return (
        <>
            {/* Table at reading width; six columns are unusable on a phone. */}
            <div className="hidden lg:block">
                <table className="w-full border-collapse text-left">
                    <caption className="sr-only">
                        Daftar client aktif beserta layanan, asal konten, nilai
                        kerja sama, sejak kapan menjadi client, dan kontak
                        terakhir.
                    </caption>
                    <thead>
                        <tr className="group/head border-b border-border text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
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
                                label="Kontak terakhir"
                                column="kontak"
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
                                className="border-b border-border text-[0.8438rem] transition-colors last:border-b-0 hover:bg-neutral-soft"
                            >
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
                                    <ContactMark client={client} />
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

            {/* Phone and tablet: one card per client, same facts, stacked. */}
            <ul className="flex flex-col lg:hidden">
                {rows.map((client) => (
                    <li key={client.id}>
                        <Link
                            href={leadShow(client.id)}
                            prefetch
                            className="-mx-2 flex items-center gap-3 rounded-md border-b border-border px-2 py-3.5 transition-colors hover:bg-neutral-soft"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.8438rem] font-bold">
                                    {client.company}
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
                                    <ContactMark client={client} withLabel />
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
 * When the client was last spoken to. Red only once that is older than the
 * stage tolerates: a breach, not a decoration.
 */
function ContactMark({
    client,
    withLabel = false,
}: {
    client: Client;
    withLabel?: boolean;
}) {
    const when = relativeDays(client.daysSinceContact);
    const text = withLabel ? `Kontak ${when}` : when;

    if (client.needsContact) {
        return (
            <span className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap text-destructive">
                <span
                    className="size-1.5 shrink-0 rounded-full bg-destructive"
                    aria-hidden
                />
                {text}
                <span className="sr-only">
                    , lebih lama dari batas {client.threshold} hari
                </span>
            </span>
        );
    }

    return (
        <span className="whitespace-nowrap text-muted-foreground">{text}</span>
    );
}
