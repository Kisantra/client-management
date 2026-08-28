import { channels } from '@/data/dashboard';
import { cn } from '@/lib/utils';

const rows = channels.map((channel) => ({
    ...channel,
    perPost: channel.leads / channel.published,
}));

const best = Math.max(...rows.map((row) => row.perPost));

const nf = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

export function ChannelTable() {
    return (
        <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[22rem] border-collapse text-left">
                <caption className="sr-only">
                    Jumlah konten tayang dan lead yang masuk per channel bulan
                    ini.
                </caption>
                <thead>
                    <tr className="text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                        <th scope="col" className="pr-3 pb-2.5 font-bold">
                            Channel
                        </th>
                        <th
                            scope="col"
                            className="pr-3 pb-2.5 text-right font-bold"
                        >
                            Tayang
                        </th>
                        <th
                            scope="col"
                            className="pr-3 pb-2.5 text-right font-bold"
                        >
                            Lead
                        </th>
                        <th scope="col" className="pb-2.5 text-right font-bold">
                            Per konten
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={row.key}
                            className="border-t border-border text-[0.8438rem]"
                        >
                            <th
                                scope="row"
                                className="py-3 pr-3 text-left font-bold"
                            >
                                {row.label}
                            </th>
                            <td className="py-3 pr-3 text-right text-muted-foreground">
                                {row.published}
                            </td>
                            <td className="py-3 pr-3 text-right font-bold">
                                {row.leads}
                            </td>
                            <td className="py-3 text-right">
                                <span className="inline-flex items-center justify-end gap-2.5">
                                    <span className="hidden h-2 w-16 overflow-hidden rounded-full bg-neutral-soft sm:block">
                                        <span
                                            className={cn(
                                                'block h-full rounded-full',
                                                row.perPost === best
                                                    ? 'bg-primary'
                                                    : 'bg-chart-2',
                                            )}
                                            style={{
                                                width: `${Math.round((row.perPost / best) * 100)}%`,
                                            }}
                                        />
                                    </span>
                                    <span className="w-8 font-extrabold">
                                        {nf.format(row.perPost)}
                                    </span>
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
