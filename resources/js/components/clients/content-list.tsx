import { ChannelIcon } from '@/components/leads/channel-icon';
import type { ContentShare } from '@/data/clients';
import { CHANNEL_LABELS } from '@/data/dashboard';
import { shortRupiah } from '@/data/leads';

/**
 * The content that ended in a signed client, most productive first.
 *
 * The dashboard's channel table asks which content gets leads; this one asks
 * the question the product exists for, which content gets clients.
 */
export function ContentList({ items }: { items: ContentShare[] }) {
    if (items.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-6 text-center text-xs text-muted-foreground">
                Belum ada konten yang tercatat membawa client.
            </p>
        );
    }

    const widest = Math.max(...items.map((item) => item.count), 1);

    return (
        <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[18rem] border-collapse text-left">
                <caption className="sr-only">
                    Konten yang paling banyak menghasilkan client, dengan jumlah
                    client dan nilai kerja samanya.
                </caption>
                <thead>
                    <tr className="text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                        <th scope="col" className="pr-3 pb-2.5 font-bold">
                            Konten
                        </th>
                        <th
                            scope="col"
                            className="hidden pr-3 pb-2.5 font-bold sm:table-cell"
                        >
                            Channel
                        </th>
                        <th
                            scope="col"
                            className="pr-3 pb-2.5 text-right font-bold"
                        >
                            Client
                        </th>
                        <th scope="col" className="pb-2.5 text-right font-bold">
                            Nilai
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((row) => (
                        <tr
                            key={`${row.channel}-${row.source}`}
                            className="border-t border-border text-[0.8438rem]"
                        >
                            <th
                                scope="row"
                                className="w-full max-w-0 py-3 pr-3 text-left font-bold"
                            >
                                {/* On a phone the channel folds into the name. */}
                                <span className="flex items-center gap-1.5">
                                    <ChannelIcon
                                        channel={row.channel}
                                        className="size-3 shrink-0 text-muted-foreground sm:hidden"
                                    />
                                    <span className="truncate">
                                        {row.source}
                                    </span>
                                </span>
                            </th>
                            <td className="hidden py-3 pr-3 text-xs font-semibold whitespace-nowrap text-secondary-foreground sm:table-cell">
                                <span className="inline-flex items-center gap-1.5">
                                    <ChannelIcon
                                        channel={row.channel}
                                        className="size-3 text-muted-foreground"
                                    />
                                    {CHANNEL_LABELS[row.channel]}
                                </span>
                            </td>
                            <td className="py-3 pr-3 text-right">
                                <span className="inline-flex items-center justify-end gap-2.5">
                                    <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-neutral-soft sm:block">
                                        <span
                                            className="block h-full rounded-full bg-primary"
                                            style={{
                                                width: `${Math.max(Math.round((row.count / widest) * 100), 3)}%`,
                                            }}
                                        />
                                    </span>
                                    <span
                                        className="w-6 font-extrabold"
                                        data-numeric
                                    >
                                        {row.count}
                                    </span>
                                </span>
                            </td>
                            <td
                                className="py-3 text-right text-xs whitespace-nowrap text-muted-foreground"
                                data-numeric
                            >
                                {shortRupiah(row.value)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
