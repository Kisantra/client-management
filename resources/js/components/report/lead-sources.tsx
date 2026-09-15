import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import {
    ReportEmpty,
    ReportSection,
    Segmented,
    money,
    nf,
} from '@/components/report/report-section';
import { CHANNEL_LABELS } from '@/data/dashboard';
import type { ChannelKey } from '@/data/dashboard';
import { cn } from '@/lib/utils';

export type LeadSource = {
    key: string;
    label: string;
    leads: number;
    value: number;
    clients: number;
};

type Metric = 'leads' | 'value';

/*
 | One hue in steps, largest share darkest. The palette works in teal and
 | keeps red for lateness, so a channel is told apart by its mark and its place
 | in the legend, not by a colour of its own. The steps are chosen so that the
 | dark theme's ramp — which reverses light and dark — never lands two slices
 | on the same token.
 */
const RAMP = [
    { fill: 'bg-primary-deep', stroke: 'stroke-primary-deep' },
    { fill: 'bg-chart-1', stroke: 'stroke-chart-1' },
    { fill: 'bg-chart-2', stroke: 'stroke-chart-2' },
    { fill: 'bg-chart-3', stroke: 'stroke-chart-3' },
    { fill: 'bg-muted-foreground/45', stroke: 'stroke-muted-foreground/45' },
];

const tone = (at: number) => RAMP[Math.min(at, RAMP.length - 1)];

const isChannel = (key: string): key is ChannelKey => key in CHANNEL_LABELS;

const SIZE = 184;
const STROKE = 24;
/* Room at the edge for the pointed-at slice to swell into. */
const LIFT = 6;
const RADIUS = (SIZE - STROKE - LIFT) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Where the period's leads came from, as a share of the whole.
 *
 * A table put four channels in rows and left the reader to do the division.
 * The ring does it: the slices are the shares, the legend carries the counts,
 * and the two answer each other — point at a slice and its row lights, point
 * at a row and its slice stands out, with the centre saying which one it is.
 *
 * Counted two ways because the answers differ. Web/SEO can bring the most
 * leads while LinkedIn brings the most money, and a card that only counts
 * heads would hide the channel worth the most.
 */
export function LeadSources({ sources }: { sources: LeadSource[] }) {
    const [metric, setMetric] = useState<Metric>('leads');
    const [active, setActive] = useState<string | null>(null);

    /* The ring draws itself once, on arrival. Set on the next frame so the
       first paint has the empty ring to transition from. */
    const [drawn, setDrawn] = useState(false);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setDrawn(true));

        return () => cancelAnimationFrame(frame);
    }, []);

    const read = (row: LeadSource) =>
        metric === 'leads' ? row.leads : row.value;
    const format = (value: number) =>
        metric === 'leads' ? nf.format(value) : money(value);

    const rows = [...sources].sort((a, b) => read(b) - read(a));
    const total = rows.reduce((sum, row) => sum + read(row), 0);
    const leads = sources.reduce((sum, row) => sum + row.leads, 0);
    const clients = sources.reduce((sum, row) => sum + row.clients, 0);
    const worth = sources.reduce((sum, row) => sum + row.value, 0);
    const focused = rows.find((row) => row.key === active) ?? null;

    const share = (value: number) =>
        total > 0 ? Math.round((value / total) * 100) : 0;

    /* A hair of card between neighbouring slices, and none when one channel
       has the whole ring — a gap there would read as a missing sliver. */
    const gap = rows.filter((row) => read(row) > 0).length > 1 ? 2.5 : 0;
    const lengths = rows.map((row) =>
        total > 0 ? (read(row) / total) * CIRCUMFERENCE : 0,
    );
    const starts = lengths.map((_, at) =>
        lengths.slice(0, at).reduce((sum, length) => sum + length, 0),
    );

    const toggle = (
        <Segmented
            label="Hitung asal lead menurut"
            value={metric}
            onChange={setMetric}
            options={[
                { value: 'leads', label: 'Jumlah' },
                { value: 'value', label: 'Nilai' },
            ]}
        />
    );

    return (
        <ReportSection
            title="Asal lead"
            description="Lead yang masuk pada periode ini, menurut channel asalnya."
            action={sources.length > 0 ? toggle : undefined}
        >
            {sources.length === 0 ? (
                <ReportEmpty icon={Users} title="Belum ada lead masuk">
                    Lead yang tercatat pada periode ini akan terbagi menurut
                    channel asalnya di sini.
                </ReportEmpty>
            ) : (
                <>
                    <div className="my-auto flex flex-col items-center gap-6 py-2 sm:flex-row sm:items-center sm:gap-7">
                        <figure
                            className="relative m-0 shrink-0"
                            style={{ width: SIZE, height: SIZE }}
                            role="img"
                            aria-label={rows
                                .map(
                                    (row) =>
                                        `${row.label} ${format(read(row))} (${share(read(row))}%)`,
                                )
                                .join(', ')}
                            onPointerLeave={() => setActive(null)}
                        >
                            <svg
                                width={SIZE}
                                height={SIZE}
                                viewBox={`0 0 ${SIZE} ${SIZE}`}
                                className="-rotate-90"
                                aria-hidden
                            >
                                <circle
                                    cx={SIZE / 2}
                                    cy={SIZE / 2}
                                    r={RADIUS}
                                    strokeWidth={STROKE}
                                    className="stroke-neutral-soft"
                                    fill="none"
                                />
                                {rows.map((row, at) => {
                                    const length = lengths[at];

                                    if (length <= 0) {
                                        return null;
                                    }

                                    const dimmed =
                                        active !== null && active !== row.key;

                                    return (
                                        <circle
                                            key={row.key}
                                            cx={SIZE / 2}
                                            cy={SIZE / 2}
                                            r={RADIUS}
                                            fill="none"
                                            pointerEvents="stroke"
                                            strokeWidth={
                                                active === row.key
                                                    ? STROKE + LIFT
                                                    : STROKE
                                            }
                                            strokeDasharray={`${drawn ? Math.max(length - gap, 0.5) : 0} ${CIRCUMFERENCE}`}
                                            strokeDashoffset={-starts[at]}
                                            onPointerEnter={() =>
                                                setActive(row.key)
                                            }
                                            className={cn(
                                                'cursor-pointer transition-[stroke-dasharray,stroke-dashoffset,stroke-width,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
                                                tone(at).stroke,
                                                dimmed && 'opacity-30',
                                            )}
                                        />
                                    );
                                })}
                            </svg>

                            {/* The centre names what the ring is showing:
                                the whole, or the slice being pointed at. */}
                            <figcaption className="pointer-events-none absolute inset-0 grid place-content-center px-9 text-center">
                                <span className="block truncate text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                                    {focused ? focused.label : 'Total'}
                                </span>
                                <span
                                    className="mt-0.5 block text-2xl leading-none font-extrabold tracking-[-0.03em]"
                                    data-numeric
                                >
                                    {format(focused ? read(focused) : total)}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                    {focused ? (
                                        <>
                                            <span data-numeric>
                                                {share(read(focused))}%
                                            </span>{' '}
                                            dari total
                                        </>
                                    ) : metric === 'leads' ? (
                                        'lead masuk'
                                    ) : (
                                        'estimasi nilai'
                                    )}
                                </span>
                            </figcaption>
                        </figure>

                        <ul
                            className="flex w-full min-w-0 flex-1 flex-col gap-0.5"
                            onPointerLeave={() => setActive(null)}
                        >
                            {rows.map((row, at) => {
                                const lit = active === row.key;

                                return (
                                    <li key={row.key}>
                                        <button
                                            type="button"
                                            onPointerEnter={() =>
                                                setActive(row.key)
                                            }
                                            onFocus={() => setActive(row.key)}
                                            onBlur={() => setActive(null)}
                                            className={cn(
                                                'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                                                lit
                                                    ? 'bg-neutral-soft'
                                                    : 'hover:bg-neutral-soft',
                                                active !== null &&
                                                    !lit &&
                                                    'opacity-60',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'size-2.5 rounded-full',
                                                    tone(at).fill,
                                                )}
                                                aria-hidden
                                            />
                                            <span className="min-w-0">
                                                <span className="flex items-center gap-1.5 text-[0.8438rem] font-bold">
                                                    {isChannel(row.key) ? (
                                                        <ChannelIcon
                                                            channel={row.key}
                                                            className="text-muted-foreground"
                                                        />
                                                    ) : null}
                                                    <span className="truncate">
                                                        {row.label}
                                                    </span>
                                                </span>
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                    {metric === 'leads'
                                                        ? money(row.value)
                                                        : `${nf.format(row.leads)} lead`}
                                                    {row.clients > 0
                                                        ? ` · ${nf.format(row.clients)} kini client`
                                                        : null}
                                                </span>
                                            </span>
                                            <span className="text-right">
                                                <span
                                                    className="block text-sm font-extrabold"
                                                    data-numeric
                                                >
                                                    {format(read(row))}
                                                </span>
                                                <span
                                                    className="block text-[0.6875rem] font-semibold text-muted-foreground"
                                                    data-numeric
                                                >
                                                    {share(read(row))}%
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* The three sums a reader reaches for next, so nobody
                        adds up the legend by hand. */}
                    <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                        <Fact label="Lead" value={nf.format(leads)} />
                        <Fact label="Estimasi" value={money(worth)} />
                        <Fact
                            label="Kini client"
                            value={nf.format(clients)}
                            hint="Dihitung per hari ini, bukan per periode."
                        />
                    </dl>
                </>
            )}
        </ReportSection>
    );
}

function Fact({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className="min-w-0" title={hint}>
            <dt className="truncate text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                {label}
            </dt>
            <dd
                className="mt-1 truncate text-base font-extrabold tracking-[-0.02em]"
                data-numeric
            >
                {value}
            </dd>
        </div>
    );
}
