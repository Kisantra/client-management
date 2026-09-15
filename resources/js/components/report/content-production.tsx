import { Layers } from 'lucide-react';
import { useState } from 'react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import {
    ReportEmpty,
    ReportSection,
    Segmented,
    nf,
} from '@/components/report/report-section';
import { CHANNEL_LABELS } from '@/data/dashboard';
import type { ChannelKey } from '@/data/dashboard';
import { cn } from '@/lib/utils';

export type ProductionRow = {
    planned: number;
    published: number;
    late: number;
};

type View = 'channel' | 'owner';

type Line = ProductionRow & {
    key: string;
    label: string;
    /** Scheduled, not out yet, and not yet past its date. */
    upcoming: number;
};

const isChannel = (key: string): key is ChannelKey => key in CHANNEL_LABELS;

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join('');

/**
 * What the calendar asked for in the period, and what became of it.
 *
 * Every piece ends the period in one of three states — out, still ahead of
 * its date, or past its date and not out — so each bar is those three laid
 * end to end. The bar's length is the volume, measured against the busiest
 * row; its colours are the outcome. Two tables of the same three columns
 * became one card read two ways.
 *
 * Pointing at a row writes its numbers into the line above the bars, the way
 * the dashboard's lead chart does, so the bars never need a label of their
 * own crowding them.
 */
export function ContentProduction({
    channels,
    owners,
}: {
    channels: (ProductionRow & { key: string; label: string })[];
    owners: (ProductionRow & { name: string })[];
}) {
    const [view, setView] = useState<View>('channel');
    const [active, setActive] = useState<string | null>(null);

    const lines: Line[] = (
        view === 'channel'
            ? channels.map((row) => ({ ...row }))
            : owners.map((row) => ({ ...row, key: row.name, label: row.name }))
    ).map((row) => ({
        ...row,
        upcoming: Math.max(row.planned - row.published - row.late, 0),
    }));

    const busiest = Math.max(...lines.map((line) => line.planned), 1);
    const focused = lines.find((line) => line.key === active) ?? null;
    const shown = focused ?? {
        label: view === 'channel' ? 'Semua channel' : 'Semua orang',
        planned: lines.reduce((sum, line) => sum + line.planned, 0),
        published: lines.reduce((sum, line) => sum + line.published, 0),
        late: lines.reduce((sum, line) => sum + line.late, 0),
        upcoming: lines.reduce((sum, line) => sum + line.upcoming, 0),
    };
    const done =
        shown.planned > 0
            ? Math.round((shown.published / shown.planned) * 100)
            : 0;

    const empty = channels.length === 0 && owners.length === 0;

    return (
        <ReportSection
            title="Produksi konten"
            description={
                view === 'channel'
                    ? 'Satu konten di dua channel dihitung di keduanya: dibuat sekali, tayang dua kali.'
                    : 'Dihitung dari tanggal tayang yang dijadwalkan pada periode ini.'
            }
            action={
                empty ? undefined : (
                    <Segmented
                        label="Kelompokkan produksi konten menurut"
                        value={view}
                        onChange={(next) => {
                            setView(next);
                            setActive(null);
                        }}
                        options={[
                            { value: 'channel', label: 'Channel' },
                            { value: 'owner', label: 'Penanggung jawab' },
                        ]}
                    />
                )
            }
        >
            {empty ? (
                <ReportEmpty
                    icon={Layers}
                    title="Belum ada konten di periode ini"
                >
                    Konten yang dijadwalkan pada rentang ini akan terhitung per
                    channel dan per orang di sini.
                </ReportEmpty>
            ) : (
                <>
                    {/* The reading line: the whole, or the row pointed at. */}
                    <div
                        className="flex min-h-12 flex-wrap items-end justify-between gap-x-5 gap-y-2 rounded-lg bg-neutral-soft/70 px-3.5 py-2.5"
                        aria-live="polite"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-muted-foreground">
                                {shown.label}
                            </p>
                            <p className="mt-0.5 text-sm font-extrabold">
                                <span data-numeric>
                                    {nf.format(shown.published)}
                                </span>
                                <span className="font-semibold text-muted-foreground">
                                    {' '}
                                    dari{' '}
                                </span>
                                <span data-numeric>
                                    {nf.format(shown.planned)}
                                </span>{' '}
                                tayang
                                <span
                                    className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-extrabold text-primary-deep"
                                    data-numeric
                                >
                                    {done}%
                                </span>
                            </p>
                        </div>

                        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                            <Key tone="bg-primary" label="Tayang">
                                {shown.published}
                            </Key>
                            <Key tone="bg-chart-2" label="Terjadwal">
                                {shown.upcoming}
                            </Key>
                            <Key
                                tone="bg-destructive"
                                label="Telat"
                                alarm={shown.late > 0}
                            >
                                {shown.late}
                            </Key>
                        </dl>
                    </div>

                    <ul
                        className="my-auto flex flex-col gap-0.5 pt-3"
                        onPointerLeave={() => setActive(null)}
                    >
                        {lines.map((line, at) => {
                            const lit = active === line.key;
                            const part = (value: number) =>
                                line.planned > 0
                                    ? `${(value / line.planned) * 100}%`
                                    : '0%';

                            return (
                                <li key={`${view}-${line.key}`}>
                                    <button
                                        type="button"
                                        onPointerEnter={() =>
                                            setActive(line.key)
                                        }
                                        onFocus={() => setActive(line.key)}
                                        onBlur={() => setActive(null)}
                                        aria-label={`${line.label}: ${line.published} tayang, ${line.upcoming} terjadwal, ${line.late} telat, dari ${line.planned}`}
                                        className={cn(
                                            'grid w-full grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.25rem] items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem]',
                                            lit
                                                ? 'bg-neutral-soft'
                                                : 'hover:bg-neutral-soft',
                                        )}
                                    >
                                        <span className="flex min-w-0 items-center gap-2 text-[0.8438rem] font-bold">
                                            {view === 'channel' ? (
                                                isChannel(line.key) ? (
                                                    <ChannelIcon
                                                        channel={line.key}
                                                        className="text-muted-foreground"
                                                    />
                                                ) : null
                                            ) : (
                                                <span
                                                    className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-soft text-[0.6875rem] font-extrabold text-secondary-foreground"
                                                    aria-hidden
                                                >
                                                    {initials(line.label)}
                                                </span>
                                            )}
                                            <span className="truncate">
                                                {line.label}
                                            </span>
                                        </span>

                                        {/* Length is volume against the
                                            busiest row; the fill is outcome. */}
                                        <span
                                            className="block h-3 rounded-full bg-neutral-soft"
                                            aria-hidden
                                        >
                                            <span
                                                className="animate-draw-across flex h-full gap-px overflow-hidden rounded-full"
                                                style={{
                                                    width: `${(line.planned / busiest) * 100}%`,
                                                    animationDelay: `${at * 55}ms`,
                                                }}
                                            >
                                                <span
                                                    className="h-full bg-primary"
                                                    style={{
                                                        width: part(
                                                            line.published,
                                                        ),
                                                    }}
                                                />
                                                <span
                                                    className="h-full bg-chart-2"
                                                    style={{
                                                        width: part(
                                                            line.upcoming,
                                                        ),
                                                    }}
                                                />
                                                <span
                                                    className="h-full bg-destructive"
                                                    style={{
                                                        width: part(line.late),
                                                    }}
                                                />
                                            </span>
                                        </span>

                                        <span className="text-right text-sm font-extrabold">
                                            <span data-numeric>
                                                {nf.format(line.published)}
                                            </span>
                                            <span
                                                className="font-semibold text-muted-foreground"
                                                data-numeric
                                            >
                                                /{nf.format(line.planned)}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </ReportSection>
    );
}

function Key({
    tone,
    label,
    alarm = false,
    children,
}: {
    tone: string;
    label: string;
    alarm?: boolean;
    children: number;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', tone)} aria-hidden />
            <dt className="text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    'font-extrabold',
                    alarm ? 'text-destructive' : 'text-foreground',
                )}
                data-numeric
            >
                {nf.format(children)}
            </dd>
        </div>
    );
}
