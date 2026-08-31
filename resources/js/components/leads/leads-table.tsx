import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { StageMark, StalledMark } from '@/components/leads/stage-mark';
import { SortHead } from '@/components/sort-head';
import { CHANNEL_LABELS } from '@/data/dashboard';
import { entryDate, relativeDays, shortRupiah } from '@/data/leads';
import type { Lead } from '@/data/leads';
import { show as leadShow } from '@/routes/leads';

export type LeadSort = 'nama' | 'lama' | 'nilai' | 'kontak' | 'masuk';

type Props = {
    rows: Lead[];
    sort: LeadSort;
    onSort: (sort: LeadSort) => void;
};

export function LeadsTable({ rows, sort, onSort }: Props) {
    return (
        <>
            {/* Table at reading width; a six-column grid is unusable on a phone. */}
            <div className="hidden lg:block">
                <table className="w-full border-collapse text-left">
                    <caption className="sr-only">
                        Daftar lead beserta tahap, asal konten, estimasi nilai,
                        dan lama berada di tahap saat ini.
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
                                Tahap
                            </th>
                            <th scope="col" className="py-3 pr-4 font-bold">
                                Asal
                            </th>
                            <SortHead
                                label="Estimasi"
                                column="nilai"
                                sort={sort}
                                onSort={onSort}
                                align="right"
                            />
                            <SortHead
                                label="Di tahap ini"
                                column="lama"
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
                            <SortHead
                                label="Masuk"
                                column="masuk"
                                sort={sort}
                                onSort={onSort}
                                align="right"
                            />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((lead) => (
                            <tr
                                key={lead.id}
                                className="border-b border-border text-[0.8438rem] transition-colors last:border-b-0 hover:bg-neutral-soft"
                            >
                                <th
                                    scope="row"
                                    className="max-w-[18rem] py-3 pr-4 text-left font-normal"
                                >
                                    <Link
                                        href={leadShow(lead.id)}
                                        prefetch
                                        className="block truncate font-bold underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                                    >
                                        {lead.company}
                                    </Link>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {lead.pic} · {lead.service}
                                    </span>
                                </th>
                                <td className="py-3 pr-4">
                                    <StageMark stage={lead.stage} />
                                    {lead.closedReason ? (
                                        <span className="mt-0.5 block text-xs whitespace-nowrap text-muted-foreground">
                                            Berhenti · {lead.closedReason}
                                        </span>
                                    ) : null}
                                </td>
                                <td className="max-w-[14rem] py-3 pr-4">
                                    <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-secondary-foreground">
                                        <ChannelIcon
                                            channel={lead.channel}
                                            className="size-3 text-muted-foreground"
                                        />
                                        <span className="truncate">
                                            {CHANNEL_LABELS[lead.channel]}
                                        </span>
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {lead.source}
                                    </span>
                                </td>
                                <td
                                    className="py-3 pr-4 text-right font-bold whitespace-nowrap"
                                    data-numeric
                                >
                                    {shortRupiah(lead.value)}
                                </td>
                                <td className="py-3 pr-4 text-right">
                                    {lead.stalled ? (
                                        <StalledMark
                                            days={lead.daysInStage}
                                            threshold={lead.threshold}
                                        />
                                    ) : (
                                        <span
                                            className="whitespace-nowrap text-muted-foreground"
                                            data-numeric
                                        >
                                            {lead.daysInStage} hari
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 pr-4 text-right text-xs whitespace-nowrap text-muted-foreground">
                                    {relativeDays(lead.daysSinceContact)}
                                </td>
                                <td
                                    className="py-3 text-right text-xs whitespace-nowrap text-muted-foreground"
                                    data-numeric
                                >
                                    {entryDate(lead.entryAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Phone and tablet: one card per lead, same facts, stacked. */}
            <ul className="flex flex-col lg:hidden">
                {rows.map((lead) => (
                    <li key={lead.id}>
                        <Link
                            href={leadShow(lead.id)}
                            prefetch
                            className="-mx-2 flex items-center gap-3 rounded-md border-b border-border px-2 py-3.5 transition-colors hover:bg-neutral-soft"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.8438rem] font-bold">
                                    {lead.company}
                                </span>
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                    <StageMark stage={lead.stage} />
                                    <span aria-hidden>·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <ChannelIcon
                                            channel={lead.channel}
                                            className="size-3"
                                        />
                                        {CHANNEL_LABELS[lead.channel]}
                                    </span>
                                    <span aria-hidden>·</span>
                                    <span data-numeric>
                                        {shortRupiah(lead.value)}
                                    </span>
                                </span>
                                {lead.stalled ? (
                                    <span className="mt-1.5 block">
                                        <StalledMark
                                            days={lead.daysInStage}
                                            threshold={lead.threshold}
                                        />
                                    </span>
                                ) : lead.closedReason ? (
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        Berhenti · {lead.closedReason} ·{' '}
                                        <span data-numeric>
                                            {lead.daysInStage} hari di tahap ini
                                        </span>
                                    </span>
                                ) : (
                                    <span
                                        className="mt-1 block text-xs text-muted-foreground"
                                        data-numeric
                                    >
                                        {lead.daysInStage} hari di tahap ini
                                    </span>
                                )}
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
