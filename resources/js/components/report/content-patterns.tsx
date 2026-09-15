import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarDays,
    Clapperboard,
    Link2,
    Shapes,
    Sparkles,
    Tag,
    Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import {
    ReportEmpty,
    ReportSection,
    Segmented,
    nf,
    nf1,
    times,
} from '@/components/report/report-section';
import { shortDate } from '@/data/instagram';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';
import { content } from '@/routes';

type Platform = 'instagram' | 'tiktok';

type DimensionKey = 'format' | 'duration' | 'type' | 'pillar' | 'weekday';

type Example = {
    platform: Platform;
    caption: string | null;
    thumbnail: string | null;
    href: string;
    format: string;
    postedAt: string;
    interactions: number;
    lift: number;
};

type Group = {
    key: string;
    label: string;
    posts: number;
    /** Median of each post's interactions over its account's typical post. */
    lift: number;
    /** Posts in the group that beat their account's typical post. */
    above: number;
    interactions: number;
    platforms: Partial<Record<Platform, number>>;
    best: Example;
};

type Dimension = {
    key: DimensionKey;
    label: string;
    /** Read off the post itself, or off the calendar piece linked to it. */
    source: 'post' | 'calendar';
    ordered: boolean;
    posts: number;
    groups: Group[];
};

type Breakdown = { posts: number; linked: number; dimensions: Dimension[] };

export type PatternsData = {
    all: Breakdown;
    period: Breakdown;
    /** Groups smaller than this are shown, and marked as too few to judge. */
    enough: number;
    since: string | null;
    baseline: {
        key: Platform;
        label: string;
        typical: number;
        posts: number;
    }[];
};

const ICON: Record<DimensionKey, LucideIcon> = {
    format: Clapperboard,
    duration: Timer,
    type: Shapes,
    pillar: Tag,
    weekday: CalendarDays,
};

/** How the headline names the dimension: "paling tinggi di antara …". */
const NOUN: Record<DimensionKey, string> = {
    format: 'format',
    duration: 'durasi video',
    type: 'jenis konten',
    pillar: 'pillar',
    weekday: 'hari tayang',
};

/** Within a twentieth of usual reads as usual, not as a win or a loss. */
const isAbove = (lift: number) => lift >= 1.05;
const isBelow = (lift: number) => lift <= 0.95;

/**
 * What kind of content has earned more than usual.
 *
 * One question — which kinds work — asked of five categories, because the
 * team decides all five when it plans a piece: its format, its length, its
 * type and pillar in the calendar, and the day it goes out. Every group is a
 * bar against a single line marked "biasanya", so the whole card reads with
 * one rule: past the line did better than an ordinary post, short of it did
 * worse.
 *
 * It says what it cannot know. A group of two posts gets its bar, hatched and
 * labelled as too few, and never the headline. Pillar and type exist only on
 * posts somebody linked to the calendar, so those tabs say how many that is
 * and where to link more, instead of drawing a confident chart out of one.
 */
export function ContentPatterns({ data }: { data: PatternsData }) {
    const [scope, setScope] = useState<'all' | 'period'>('all');
    const [dimensionKey, setDimensionKey] = useState<DimensionKey>('format');
    const [picked, setPicked] = useState<string | null>(null);

    const breakdown = data[scope];
    const dimension =
        breakdown.dimensions.find((item) => item.key === dimensionKey) ??
        breakdown.dimensions[0];
    const groups = dimension.groups;
    const judged = groups.filter((group) => group.posts >= data.enough);
    const leader =
        [...judged].sort((a, b) => b.lift - a.lift || b.posts - a.posts)[0] ??
        null;
    const selected =
        groups.find((group) => group.key === picked) ?? leader ?? groups[0];

    /* The scale follows the groups that count. One post at 6,8× would
       otherwise flatten every other bar into a stub; it still draws, full
       length, with its exact figure beside it. */
    const scale =
        Math.ceil(
            Math.max(
                2,
                ...(judged.length ? judged : groups).map((g) => g.lift),
            ) * 2,
        ) / 2;

    /* One or two groups make a short chart, and a tall panel beside it
       would leave the chart floating in its own column. */
    const few = groups.length < 3;

    const choose = (next: DimensionKey) => {
        setDimensionKey(next);
        setPicked(null);
    };

    if (data.all.posts === 0) {
        return (
            <ReportSection
                title="Konten seperti apa yang berhasil"
                description="Format, durasi, jenis, pillar, dan hari tayang yang selama ini mendapat interaksi di atas biasanya."
            >
                <ReportEmpty
                    compact
                    icon={Sparkles}
                    title="Belum ada unggahan untuk dibaca"
                >
                    Begitu Performa menyimpan unggahan Instagram atau TikTok,
                    pola yang berhasil akan terlihat di sini.
                </ReportEmpty>
            </ReportSection>
        );
    }

    return (
        <ReportSection
            title="Konten seperti apa yang berhasil"
            description={
                <>
                    Setiap kelompok dibandingkan dengan unggahan biasa di
                    akunnya sendiri: <b className="text-foreground">1×</b>{' '}
                    berarti sama seperti biasanya,{' '}
                    <b className="text-foreground">2×</b> berarti dua kali
                    lipat.
                </>
            }
            action={
                <Segmented
                    label="Rentang yang dibaca"
                    value={scope}
                    onChange={(next) => {
                        setScope(next);
                        setPicked(null);
                    }}
                    options={[
                        {
                            value: 'all',
                            label: 'Semua waktu',
                            count: data.all.posts,
                        },
                        {
                            value: 'period',
                            label: 'Periode ini',
                            count: data.period.posts,
                        },
                    ]}
                />
            }
        >
            {/* The five ways to slice the posts. Scrolls sideways on a phone
                rather than wrapping into a second row of tabs. */}
            <div className="scroll-slim -mx-1 overflow-x-auto px-1 pb-1">
                <div className="flex w-max gap-1.5">
                    {breakdown.dimensions.map((item) => {
                        const Icon = ICON[item.key];
                        const on = item.key === dimension.key;

                        return (
                            <button
                                key={item.key}
                                type="button"
                                aria-pressed={on}
                                onClick={() => choose(item.key)}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-[color,background-color,border-color] duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                                    on
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-card text-secondary-foreground hover:border-primary/35 hover:text-primary-deep',
                                )}
                            >
                                <Icon
                                    className="size-3.5"
                                    strokeWidth={2.25}
                                    aria-hidden
                                />
                                {item.label}
                                <span
                                    className={cn(
                                        'text-[0.6875rem]',
                                        on
                                            ? 'text-primary-foreground/75'
                                            : 'text-muted-foreground',
                                    )}
                                    data-numeric
                                >
                                    {nf.format(item.posts)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {dimension.source === 'calendar' ? (
                <Coverage
                    linked={breakdown.linked}
                    posts={breakdown.posts}
                    empty={groups.length === 0}
                />
            ) : null}

            {groups.length === 0 ? (
                dimension.source === 'calendar' ? null : (
                    <ReportEmpty
                        compact
                        icon={ICON[dimension.key]}
                        title="Belum ada unggahan di rentang ini"
                    >
                        Pilih “Semua waktu” untuk membaca semua unggahan yang
                        tersimpan.
                    </ReportEmpty>
                )
            ) : (
                <div
                    className={cn(
                        'mt-4 gap-4',
                        few
                            ? 'flex flex-col'
                            : 'grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-5',
                    )}
                >
                    <div
                        key={`${scope}-${dimension.key}`}
                        className="flex min-w-0 flex-col"
                    >
                        <Headline
                            leader={leader}
                            noun={NOUN[dimension.key]}
                            enough={data.enough}
                        />

                        <div
                            className={cn(
                                'relative mt-3 flex flex-col',
                                !few && 'flex-1 justify-evenly',
                            )}
                        >
                            {/* One "biasanya" line through every row, laid
                                on the same grid the rows use so it lands on
                                the 1× mark of each bar. */}
                            <div
                                className="pointer-events-none absolute inset-0 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.25rem] gap-3 px-2.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem]"
                                aria-hidden
                            >
                                <span />
                                <span className="relative">
                                    <span
                                        className="absolute inset-y-1 border-l border-dashed border-foreground/30"
                                        style={{ left: `${100 / scale}%` }}
                                    />
                                </span>
                                <span />
                            </div>

                            {groups.map((group, at) => (
                                <Bar
                                    key={group.key}
                                    group={group}
                                    scale={scale}
                                    at={at}
                                    small={group.posts < data.enough}
                                    on={group.key === selected?.key}
                                    onPick={() => setPicked(group.key)}
                                />
                            ))}
                        </div>

                        {/* The axis, on the same grid again. */}
                        <div
                            className="mt-1 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.25rem] gap-3 px-2.5 text-[0.6875rem] font-semibold text-muted-foreground sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem]"
                            aria-hidden
                        >
                            <span />
                            <span className="relative h-4">
                                <span className="absolute left-0">0×</span>
                                <span
                                    className="absolute -translate-x-1/2 font-extrabold whitespace-nowrap text-foreground"
                                    style={{ left: `${100 / scale}%` }}
                                >
                                    1× biasanya
                                </span>
                                <span className="absolute right-0" data-numeric>
                                    {nf1.format(scale)}×
                                </span>
                            </span>
                            <span />
                        </div>
                    </div>

                    {selected ? (
                        <Insight
                            key={`${scope}-${dimension.key}-${selected.key}`}
                            group={selected}
                            dimension={dimension.label}
                            small={selected.posts < data.enough}
                            leader={selected.key === leader?.key}
                            wide={few}
                        />
                    ) : null}
                </div>
            )}

            {/* What "biasanya" is, in the account's own numbers. */}
            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3.5 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">
                    Unggahan biasa{data.since ? ` (sejak ${data.since})` : ''}
                </span>
                {data.baseline.map((account) => (
                    <span
                        key={account.key}
                        className="inline-flex items-center gap-1.5"
                    >
                        <ChannelIcon channel={account.key} className="size-3" />
                        {account.label}{' '}
                        <b className="text-foreground" data-numeric>
                            {nf1.format(account.typical)}
                        </b>{' '}
                        interaksi
                    </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="h-2 w-4 rounded-full bg-[repeating-linear-gradient(135deg,var(--chart-2)_0_2px,transparent_2px_4px)]"
                        aria-hidden
                    />
                    kurang dari {data.enough} unggahan: belum bisa disimpulkan
                </span>
            </p>
        </ReportSection>
    );
}

/** The one sentence the chart comes down to. */
function Headline({
    leader,
    noun,
    enough,
}: {
    leader: Group | null;
    noun: string;
    enough: number;
}) {
    if (!leader) {
        return (
            <p className="text-sm leading-relaxed text-muted-foreground">
                Belum cukup data: setiap {noun} di sini baru punya kurang dari{' '}
                {enough} unggahan.
            </p>
        );
    }

    if (!isAbove(leader.lift)) {
        return (
            <p className="text-sm leading-relaxed">
                Belum ada {noun} yang jelas di atas biasanya. Yang tertinggi{' '}
                <b>{leader.label}</b>, di{' '}
                <b data-numeric>{times(leader.lift)}</b>.
            </p>
        );
    }

    return (
        <p className="text-sm leading-relaxed">
            <b>{leader.label}</b> mendapat{' '}
            <b
                className="rounded-md bg-primary-soft px-1.5 py-0.5 text-primary-deep"
                data-numeric
            >
                {times(leader.lift)}
            </b>{' '}
            interaksi unggahan biasa, paling tinggi di antara {noun}.
        </p>
    );
}

function Bar({
    group,
    scale,
    at,
    small,
    on,
    onPick,
}: {
    group: Group;
    scale: number;
    at: number;
    small: boolean;
    on: boolean;
    onPick: () => void;
}) {
    const width = Math.min(group.lift / scale, 1) * 100;
    const past = group.lift > scale;

    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onPick}
            aria-label={`${group.label}: ${times(group.lift)} biasanya, dari ${group.posts} unggahan`}
            className={cn(
                'relative grid w-full grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.25rem] items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem]',
                on ? 'bg-primary-soft' : 'hover:bg-neutral-soft',
            )}
        >
            <span className="min-w-0">
                <span
                    className={cn(
                        'block truncate text-[0.8438rem] font-bold',
                        on && 'text-primary-deep',
                    )}
                >
                    {group.label}
                </span>
                <span className="block truncate text-[0.6875rem] text-muted-foreground">
                    <span data-numeric>{nf.format(group.posts)}</span> unggahan
                    {small ? ' · sedikit' : ''}
                </span>
            </span>

            <span className="relative block h-3.5 rounded-full bg-neutral-soft">
                <span
                    className={cn(
                        'animate-draw-across absolute inset-y-0 left-0 rounded-full',
                        small
                            ? 'bg-[repeating-linear-gradient(135deg,var(--chart-2)_0_3px,transparent_3px_6px)] ring-1 ring-chart-2 ring-inset'
                            : isAbove(group.lift)
                              ? 'bg-primary'
                              : isBelow(group.lift)
                                ? 'bg-chart-3'
                                : 'bg-chart-2',
                        past && 'rounded-r-none',
                    )}
                    style={{
                        width: `${Math.max(width, 2)}%`,
                        animationDelay: `${at * 60}ms`,
                    }}
                />
            </span>

            <span
                className={cn(
                    'text-right text-sm font-extrabold',
                    !small && isAbove(group.lift)
                        ? 'text-primary-deep'
                        : 'text-muted-foreground',
                )}
                data-numeric
            >
                {times(group.lift)}
            </span>
        </button>
    );
}

/** The picked group, explained. */
function Insight({
    group,
    dimension,
    small,
    leader,
    wide = false,
}: {
    group: Group;
    dimension: string;
    small: boolean;
    leader: boolean;
    /** Laid across under a short chart, rather than stacked beside a tall one. */
    wide?: boolean;
}) {
    const lift = useCountUp(group.lift, 80, 700, 1);
    const verdict = isAbove(group.lift)
        ? 'di atas biasanya'
        : isBelow(group.lift)
          ? 'di bawah biasanya'
          : 'setara biasanya';

    /* One dot per post while there are few enough to count at a glance;
       past that a split bar says the same thing without a wall of dots. */
    const dots = group.posts <= 60;

    return (
        <aside
            className={cn(
                'animate-settle min-w-0 gap-4 rounded-lg bg-neutral-soft/70 p-4',
                wide
                    ? 'grid md:grid-cols-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:gap-6'
                    : 'flex flex-col justify-between',
            )}
        >
            <div className="flex flex-col gap-4">
                <div>
                    <p className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                        {dimension}
                        {leader ? (
                            <span className="rounded-full bg-primary px-1.5 py-px text-[0.6875rem] tracking-normal text-primary-foreground normal-case">
                                Tertinggi
                            </span>
                        ) : null}
                        {small ? (
                            <span className="rounded-full bg-card px-1.5 py-px tracking-normal normal-case">
                                Data sedikit
                            </span>
                        ) : null}
                    </p>
                    <p className="mt-1 text-lg leading-tight font-extrabold tracking-[-0.02em]">
                        {group.label}
                    </p>
                </div>

                <div className="flex items-end gap-2.5">
                    <span
                        className={cn(
                            'text-[1.875rem] leading-none font-extrabold tracking-[-0.035em]',
                            isAbove(group.lift) &&
                                !small &&
                                'text-primary-deep',
                        )}
                        data-numeric
                    >
                        {times(lift)}
                    </span>
                    <span className="pb-0.5 text-xs leading-snug text-muted-foreground">
                        interaksi unggahan biasa,
                        <br />
                        {verdict}
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div>
                    <p className="text-xs">
                        <b data-numeric>{nf.format(group.above)}</b> dari{' '}
                        <b data-numeric>{nf.format(group.posts)}</b> unggahan di
                        atas biasanya
                    </p>
                    {dots ? (
                        <span
                            className="mt-2 flex flex-wrap gap-1"
                            role="img"
                            aria-label={`${group.above} dari ${group.posts} unggahan di atas biasanya`}
                        >
                            {Array.from({ length: group.posts }, (_, index) => (
                                <span
                                    key={index}
                                    className={cn(
                                        'animate-settle size-2 rounded-full',
                                        index < group.above
                                            ? 'bg-primary'
                                            : 'bg-foreground/15',
                                    )}
                                    style={{
                                        animationDelay: `${index * 12}ms`,
                                    }}
                                />
                            ))}
                        </span>
                    ) : (
                        <span
                            className="mt-2 block h-2 overflow-hidden rounded-full bg-foreground/15"
                            role="img"
                            aria-label={`${group.above} dari ${group.posts} unggahan di atas biasanya`}
                        >
                            <span
                                className="animate-draw-across block h-full bg-primary"
                                style={{
                                    width: `${(group.above / group.posts) * 100}%`,
                                }}
                            />
                        </span>
                    )}
                </div>

                <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                    <div>
                        <dt className="text-muted-foreground">
                            Median interaksi
                        </dt>
                        <dd
                            className="mt-0.5 text-sm font-extrabold"
                            data-numeric
                        >
                            {nf1.format(group.interactions)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Dari</dt>
                        <dd className="mt-0.5 flex items-center gap-2.5 text-sm font-extrabold">
                            {(Object.keys(group.platforms) as Platform[]).map(
                                (platform) => (
                                    <span
                                        key={platform}
                                        className="inline-flex items-center gap-1"
                                        title={
                                            platform === 'tiktok'
                                                ? 'TikTok'
                                                : 'Instagram'
                                        }
                                    >
                                        <ChannelIcon
                                            channel={platform}
                                            className="size-3 text-muted-foreground"
                                        />
                                        <span data-numeric>
                                            {nf.format(
                                                group.platforms[platform] ?? 0,
                                            )}
                                        </span>
                                    </span>
                                ),
                            )}
                        </dd>
                    </div>
                </dl>
            </div>

            {/* A category is easier to believe with a post in it. */}
            <Link
                href={group.best.href}
                className="group/best flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-[border-color,box-shadow] duration-200 hover:border-primary/35 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none md:col-span-2 lg:col-span-1"
            >
                {group.best.thumbnail ? (
                    <img
                        src={group.best.thumbnail}
                        alt=""
                        loading="lazy"
                        className="size-14 shrink-0 rounded-md object-cover"
                    />
                ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-md bg-neutral-soft text-muted-foreground">
                        <ChannelIcon channel={group.best.platform} />
                    </span>
                )}
                <span className="min-w-0 flex-1">
                    <span className="block text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                        Contoh terbaik
                    </span>
                    <span
                        className={cn(
                            'mt-0.5 line-clamp-2 text-xs leading-snug font-bold transition-colors group-hover/best:text-primary-deep',
                            !group.best.caption && 'text-muted-foreground',
                        )}
                    >
                        {group.best.caption ?? 'Tanpa keterangan'}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                        <ChannelIcon
                            channel={group.best.platform}
                            className="size-3"
                        />
                        <span data-numeric>
                            {shortDate(group.best.postedAt)}
                        </span>
                        <span aria-hidden>·</span>
                        <b className="text-primary-deep" data-numeric>
                            {times(group.best.lift)}
                        </b>
                    </span>
                </span>
                <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/best:translate-x-0.5 group-hover/best:text-primary-deep"
                    strokeWidth={2.25}
                    aria-hidden
                />
            </Link>
        </aside>
    );
}

/**
 * Pillar and type live on the calendar piece, so they are counted only from
 * posts somebody linked to one. This says how many that is, and where to
 * link more.
 */
function Coverage({
    linked,
    posts,
    empty,
}: {
    linked: number;
    posts: number;
    empty: boolean;
}) {
    const share = posts > 0 ? (linked / posts) * 100 : 0;

    return (
        <div
            className={cn(
                'mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-primary/35 bg-primary-soft/50 p-3.5 sm:flex-row sm:items-center sm:justify-between',
                empty && 'py-5',
            )}
        >
            <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-primary-deep">
                    <Link2 className="size-4" strokeWidth={2.25} aria-hidden />
                </span>
                <div className="min-w-0">
                    <p className="text-[0.8438rem] font-bold">
                        {empty
                            ? 'Belum ada unggahan yang tertaut ke kalender'
                            : `Dihitung dari ${nf.format(linked)} unggahan yang tertaut ke kalender`}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Jenis konten dan pillar dicatat di kalender, jadi hanya
                        terbaca dari unggahan yang ditautkan di kolom Tautan.
                    </p>
                    <span className="mt-2 flex items-center gap-2 text-[0.6875rem] font-semibold text-muted-foreground">
                        <span className="h-1.5 w-32 overflow-hidden rounded-full bg-card">
                            <span
                                className="animate-draw-across block h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(share, 2)}%` }}
                            />
                        </span>
                        <span data-numeric>
                            {nf.format(linked)} dari {nf.format(posts)} unggahan
                        </span>
                    </span>
                </div>
            </div>
            <Link
                href={content()}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md bg-card px-3 py-2 text-xs font-bold text-primary-deep shadow-lift transition-colors hover:bg-primary hover:text-primary-foreground sm:self-center"
            >
                Tautkan di Kalender
                <ArrowRight
                    className="size-3.5"
                    strokeWidth={2.5}
                    aria-hidden
                />
            </Link>
        </div>
    );
}
