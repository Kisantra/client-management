import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUpRight,
    BadgeCheck,
    Heart,
    Instagram,
    MessageCircle,
    Pin,
    Play,
    TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Panel } from '@/components/dashboard/panel';
import { StatTile } from '@/components/dashboard/stat-tile';
import { MiniBars, MiniLine } from '@/components/dashboard/stat-viz';
import { FormatMark } from '@/components/performance/format-mark';
import { PerformanceHeader } from '@/components/performance/performance-header';
import type { Period } from '@/components/period-filter';
import {
    FORMAT_LABEL,
    longDate,
    nf,
    nf1,
    rateFormat,
    shortDate,
    signed,
} from '@/data/instagram';
import type {
    InstagramAccount,
    PostCard,
    Platform as PlatformOption,
    PlatformKey,
} from '@/data/instagram';
import { cn } from '@/lib/utils';
import { performance, performance as performanceRoute } from '@/routes';
import { content as performanceContent } from '@/routes/performance';

type Summary = {
    followers: {
        value: number;
        follows: number;
        delta: number | null;
        since: string | null;
    };
    posts: {
        total: number;
        measured: number;
        span: { from: string; to: string } | null;
    };
    interactions: {
        typical: number;
        average: number;
        likes: number;
        comments: number;
        best: number;
    };
    engagement: { rate: number; mean: number; measured: number };
    /* The one figure this platform has that the three above do not cover:
       Instagram's Reel plays, TikTok's saves. */
    highlight: { label: string; hint: string; value: number; note: string };
    /** The one post bending every average, when there is one. */
    outlier: {
        shortCode: string;
        format: string;
        postedAt: string;
        likes: number;
        comments: number;
        interactions: number;
        share: number;
    } | null;
};

type TimelinePost = {
    shortCode: string;
    date: string;
    format: string;
    interactions: number;
    likes: number;
    comments: number;
};

type FormatRow = {
    format: string;
    count: number;
    typical: number;
    views: number | null;
};

/** What the asked-for window and the stored posts have to say to each other. */
type Coverage = {
    posts: number;
    stored: number;
    from: string | null;
    to: string | null;
    /** The oldest post on record at all: the floor of every window. */
    earliest: string | null;
};

type Props = {
    connected: boolean;
    platform: PlatformKey;
    platforms: PlatformOption[];
    period: Period;
    coverage: Coverage | null;
    account: InstagramAccount | null;
    summary: Summary | null;
    followerTrend: { date: string; followers: number }[];
    timeline: TimelinePost[];
    top: PostCard[];
    formats: FormatRow[];
    handle: string;
};

export default function Performa({
    connected,
    platform,
    platforms,
    period,
    coverage,
    account,
    summary,
    followerTrend,
    timeline,
    top,
    formats,
    handle,
}: Props) {
    return (
        <>
            <Head title="Performa" />

            <div className="animate-settle flex flex-1 flex-col gap-5 p-4 sm:p-6">
                <PerformanceHeader
                    handle={handle}
                    account={account}
                    connected={connected}
                    view="statistik"
                    platform={platform}
                    platforms={platforms}
                    period={period}
                    onPeriodChange={(next) =>
                        router.get(
                            performanceRoute.url(),
                            {
                                ...(platform === 'instagram'
                                    ? {}
                                    : { platform }),
                                ...(next.periode === 'semua'
                                    ? {}
                                    : { periode: next.periode }),
                                ...(next.dari
                                    ? { dari: next.dari, sampai: next.sampai }
                                    : {}),
                            },
                            { preserveScroll: true, preserveState: true },
                        )
                    }
                />

                <Coverage period={period} coverage={coverage} />

                {!connected ? (
                    <Notice>
                        Token Apify belum diisi. Tambahkan{' '}
                        <code className="font-bold">APIFY_TOKEN</code> di berkas{' '}
                        <code className="font-bold">.env</code>, lalu tekan
                        Perbarui data.
                    </Notice>
                ) : null}

                {account && summary ? (
                    <>
                        <AccountCard account={account} summary={summary} />

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                            <StatTile
                                tone="anchor"
                                label="Pengikut"
                                hint="Jumlah pengikut akun saat data terakhir diambil."
                                value={summary.followers.value}
                                format={(value) => nf.format(value)}
                                delay={0}
                                compare={
                                    summary.followers.since
                                        ? `vs ${longDate(summary.followers.since)}`
                                        : 'belum ada pembanding'
                                }
                                delta={
                                    summary.followers.delta === null ||
                                    summary.followers.delta === 0
                                        ? undefined
                                        : {
                                              text: signed(
                                                  summary.followers.delta,
                                              ),
                                              direction:
                                                  summary.followers.delta > 0
                                                      ? 'up'
                                                      : 'down',
                                          }
                                }
                                viz={
                                    followerTrend.length > 1 ? (
                                        <MiniLine
                                            values={followerTrend.map(
                                                (point) => point.followers,
                                            )}
                                            strokeClassName="stroke-white text-white"
                                            fillClassName="fill-white/15"
                                            label={`Pengikut ${followerTrend.length} hari terakhir`}
                                        />
                                    ) : (
                                        <FirstReading />
                                    )
                                }
                            />

                            <StatTile
                                label="Engagement rate"
                                hint="Interaksi konten tengah dibagi jumlah pengikut. Dipakai median, bukan rata-rata, supaya satu konten viral tidak membuat angka ini menggambarkan konten yang tidak pernah ada."
                                value={summary.engagement.rate}
                                precision={2}
                                format={(value) => rateFormat.format(value)}
                                valueSuffix={
                                    <span className="text-base font-medium text-muted-foreground">
                                        %
                                    </span>
                                }
                                delay={90}
                                compare={`median ${summary.engagement.measured} konten · rata-rata ${rateFormat.format(summary.engagement.mean)}%`}
                                viz={
                                    <MiniBars
                                        values={timeline
                                            .slice(-6)
                                            .map((post) => post.interactions)}
                                        barClassName="bg-primary"
                                        label="Interaksi enam konten terakhir"
                                    />
                                }
                            />

                            <StatTile
                                label="Interaksi per konten"
                                hint="Suka ditambah komentar pada konten tengah. Rata-ratanya ikut ditampilkan; jarak antara keduanya menunjukkan seberapa timpang sebarannya."
                                value={summary.interactions.typical}
                                precision={1}
                                format={(value) => nf1.format(value)}
                                delay={180}
                                compare={`${nf1.format(summary.interactions.likes)} suka · ${nf1.format(summary.interactions.comments)} komentar · rata-rata ${nf1.format(summary.interactions.average)}`}
                                viz={
                                    <MiniBars
                                        values={timeline
                                            .slice(-6)
                                            .map((post) => post.likes)}
                                        barClassName="bg-chart-2"
                                        label="Suka enam konten terakhir"
                                    />
                                }
                            />

                            {/* The fourth figure is the platform's own: what
                                Instagram counts in plays, TikTok counts in
                                saves. The label, the note and the meaning all
                                come from the account being read. */}
                            <StatTile
                                label={summary.highlight.label}
                                hint={summary.highlight.hint}
                                value={summary.highlight.value}
                                format={(value) => nf.format(value)}
                                delay={270}
                                compare={summary.highlight.note}
                                viz={
                                    <MiniBars
                                        values={timeline
                                            .slice(-6)
                                            .map((post) => post.interactions)}
                                        barClassName="bg-primary-bright"
                                        label="Interaksi enam konten terakhir"
                                    />
                                }
                            />
                        </div>

                        {/*
                         | Every post over time, then the two readings of that
                         | run: which shape works, and which pieces did. The
                         | chart takes the full width because sixty-one bars
                         | in two thirds of it were slivers, and the two
                         | readings pair off at heights that actually match —
                         | a three-row table beside a chart left a third of
                         | its panel empty.
                         */}
                        <Panel
                            title="Interaksi tiap konten"
                            meta={
                                summary.posts.span
                                    ? `${summary.posts.measured} konten terukur`
                                    : undefined
                            }
                        >
                            <InteractionChart
                                posts={timeline}
                                outlier={summary.outlier}
                            />
                        </Panel>

                        <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
                            <Panel
                                title="Per format"
                                meta="median interaksi"
                                bodyClassName="flex-1"
                                footer={<FormatNote rows={formats} />}
                            >
                                <FormatBreakdown rows={formats} />
                            </Panel>

                            <Panel
                                title="Konten terbaik"
                                action={
                                    <Link
                                        href={performanceContent()}
                                        prefetch
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-deep transition-colors hover:bg-accent"
                                    >
                                        Semua konten
                                        <ArrowRight
                                            className="size-3.5"
                                            strokeWidth={2.5}
                                            aria-hidden
                                        />
                                    </Link>
                                }
                            >
                                <TopPosts posts={top} />
                            </Panel>
                        </div>
                    </>
                ) : connected ? (
                    <EmptyState />
                ) : null}
            </div>
        </>
    );
}

/** The account itself, stated once so every figure below has an owner. */
function AccountCard({
    account,
    summary,
}: {
    account: InstagramAccount;
    summary: Summary;
}) {
    return (
        <section className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-border bg-card p-4 shadow-lift sm:p-5">
            {account.avatar ? (
                <img
                    src={account.avatar}
                    alt=""
                    className="size-14 shrink-0 rounded-full object-cover ring-1 ring-border sm:size-16"
                />
            ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-deep sm:size-16">
                    <Instagram className="size-6" strokeWidth={1.75} />
                </span>
            )}

            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-base font-extrabold tracking-[-0.02em]">
                        {account.name ?? account.username}
                    </span>
                    {account.verified ? (
                        <BadgeCheck
                            className="size-4 text-primary"
                            strokeWidth={2.5}
                            aria-label="terverifikasi"
                        />
                    ) : null}
                    {account.business ? (
                        <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold text-secondary-foreground">
                            Akun bisnis
                        </span>
                    ) : null}

                    <a
                        href={account.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[0.8438rem] font-bold text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                    >
                        @{account.username}
                        <ArrowUpRight
                            className="size-3.5"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                    </a>
                </p>

                {/* The bio is what the account says about itself, not a
                    figure: two lines of it place the account, and the rest
                    was costing a hundred pixels of every reading. */}
                {account.biography ? (
                    <p className="mt-1 line-clamp-2 hidden max-w-[80ch] text-xs leading-relaxed text-muted-foreground sm:block">
                        {account.biography}
                    </p>
                ) : null}
            </div>

            {/* The two counts nothing below repeats, at the far edge: the card
                was one column of text with two thirds of its width empty. */}
            <dl className="flex shrink-0 items-center gap-5 border-border pl-5 sm:border-l">
                <Count value={summary.followers.follows} label="mengikuti" />
                <Count
                    value={summary.posts.total}
                    label="konten sepanjang akun"
                />
            </dl>
        </section>
    );
}

function Count({ value, label }: { value: number; label: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {label}
            </dt>
            <dd
                className="mt-0.5 text-base font-extrabold tracking-[-0.02em]"
                data-numeric
            >
                {nf.format(value)}
            </dd>
        </div>
    );
}

/**
 * Every measured post as one bar, oldest to newest.
 *
 * The bars are the whole point: a run of near-identical stubs with one spike is
 * the shape of an account whose reach does not depend on what it posts, and
 * that reads faster here than in any average.
 */
function InteractionChart({
    posts,
    outlier,
}: {
    posts: TimelinePost[];
    outlier: Summary['outlier'];
}) {
    const [pinned, setPinned] = useState<number | null>(null);

    if (posts.length === 0) {
        return <Blank>Belum ada konten yang terukur.</Blank>;
    }

    /*
     | Scaled to the ninetieth percentile rather than the peak. Against a single
     | viral post every ordinary one flattens to a stub and the chart stops
     | saying anything; the posts that run past the ceiling are drawn full
     | height with a cut across the top, and the footer counts them.
     */
    const sorted = [...posts]
        .map((post) => post.interactions)
        .sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 1;
    const ceiling = Math.max(p90, 1);
    const clipped = posts.filter((post) => post.interactions > ceiling).length;

    const active = pinned ?? posts.length - 1;
    const post = posts[active];

    return (
        <figure className="m-0">
            <figcaption className="mb-4 flex min-h-9 flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="text-sm font-extrabold text-foreground">
                    {longDate(post.date)}
                </span>
                <span
                    className="text-sm font-extrabold text-foreground"
                    data-numeric
                >
                    {nf.format(post.interactions)} interaksi
                </span>
                <span>
                    {FORMAT_LABEL[post.format] ?? post.format} ·{' '}
                    <span data-numeric>{nf.format(post.likes)}</span> suka ·{' '}
                    <span data-numeric>{nf.format(post.comments)}</span>{' '}
                    komentar
                </span>
            </figcaption>

            <div className="flex h-40 items-end gap-px sm:gap-1">
                {posts.map((item, index) => {
                    const over = item.interactions > ceiling;

                    return (
                        <button
                            key={item.shortCode}
                            type="button"
                            onMouseEnter={() => setPinned(index)}
                            onFocus={() => setPinned(index)}
                            onClick={() => setPinned(index)}
                            className="group/bar flex h-full min-w-0 flex-1 items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <span className="sr-only">
                                {longDate(item.date)}: {item.interactions}{' '}
                                interaksi
                            </span>
                            <span
                                className={cn(
                                    'animate-draw-up flex w-full justify-center rounded-t-md rounded-b-sm transition-colors',
                                    index === active
                                        ? 'bg-primary'
                                        : 'bg-chart-2 group-hover/bar:bg-primary-bright',
                                )}
                                style={{
                                    height: `${Math.min(Math.max((item.interactions / ceiling) * 100, 3), 100)}%`,
                                    animationDelay: `${index * 18}ms`,
                                }}
                            >
                                {/* The cut says the bar was stopped, not that
                                    the post stopped there. */}
                                {over ? (
                                    <span
                                        className="mt-0.5 h-1 w-2/3 rounded-full bg-card/70"
                                        aria-hidden
                                    />
                                ) : null}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                <p>
                    Tiap batang satu konten, dari yang terlama ke yang terbaru.
                    Arahkan kursor untuk melihat rinciannya.
                    {clipped > 0 ? (
                        <>
                            {' '}
                            <span data-numeric>{clipped}</span> konten melewati
                            skala dan dipotong di puncaknya.
                        </>
                    ) : null}
                </p>

                {outlier ? (
                    <p className="mt-2 rounded-lg bg-neutral-soft p-2.5 text-secondary-foreground">
                        Satu konten menguasai{' '}
                        <span className="font-bold" data-numeric>
                            {outlier.share}%
                        </span>{' '}
                        dari seluruh interaksi:{' '}
                        {FORMAT_LABEL[outlier.format] ?? outlier.format}{' '}
                        {shortDate(outlier.postedAt)} dengan{' '}
                        <span className="font-bold" data-numeric>
                            {nf.format(outlier.likes)}
                        </span>{' '}
                        suka dan{' '}
                        <span className="font-bold" data-numeric>
                            {nf.format(outlier.comments)}
                        </span>{' '}
                        komentar. Itu sebabnya angka di atas memakai median.
                    </p>
                ) : null}
            </div>
        </figure>
    );
}

/** What each kind of post is worth, with the count it was averaged from. */
function FormatBreakdown({ rows }: { rows: FormatRow[] }) {
    if (rows.length === 0) {
        return <Blank>Belum ada konten yang terukur.</Blank>;
    }

    const widest = Math.max(...rows.map((row) => row.typical), 1);

    return (
        <>
            <p className="mb-2 flex items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                <span className="w-[4.5rem] shrink-0">Format</span>
                <span className="min-w-0 flex-1" />
                <span className="w-8 shrink-0 text-right">Jml</span>
                <span className="w-14 shrink-0 text-right">Median</span>
            </p>

            <ul className="flex flex-col">
                {rows.map((row, index) => (
                    <li
                        key={row.format}
                        className="flex items-center gap-2.5 py-1.5 text-[0.8438rem]"
                    >
                        <span className="w-[4.5rem] shrink-0 font-bold text-secondary-foreground">
                            {FORMAT_LABEL[row.format] ?? row.format}
                        </span>

                        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-soft">
                            <span
                                className="animate-draw-across block h-full rounded-full bg-primary"
                                style={{
                                    width: `${Math.max((row.typical / widest) * 100, 3)}%`,
                                    animationDelay: `${300 + index * 70}ms`,
                                }}
                            />
                        </span>

                        <span
                            className="w-8 shrink-0 text-right text-xs text-muted-foreground"
                            data-numeric
                        >
                            {row.count}
                        </span>
                        <span
                            className="w-14 shrink-0 text-right font-extrabold"
                            data-numeric
                        >
                            {nf1.format(row.typical)}
                        </span>
                    </li>
                ))}
            </ul>
        </>
    );
}

/**
 * The one figure only one format has.
 *
 * It sits in the panel's footer rather than under the table: a three-row
 * breakdown is shorter than whatever it stands beside, and the height the row
 * obliges it to keep reads as a margin under the note instead of a hole after
 * the table.
 */
function FormatNote({ rows }: { rows: FormatRow[] }) {
    const withViews = rows.find((row) => row.views !== null);

    if (!withViews) {
        return null;
    }

    return (
        <p className="text-xs leading-relaxed text-muted-foreground">
            {FORMAT_LABEL[withViews.format] ?? withViews.format} juga dihitung
            tayangannya:{' '}
            <span className="font-bold text-foreground" data-numeric>
                {nf.format(withViews.views ?? 0)}
            </span>{' '}
            pemutaran di konten tengah.
        </p>
    );
}

function TopPosts({ posts }: { posts: PostCard[] }) {
    if (posts.length === 0) {
        return <Blank>Belum ada konten yang terukur.</Blank>;
    }

    return (
        <div className="@container/top">
            <ul className="grid gap-3 @md/top:grid-cols-2">
                {posts.map((post) => (
                    <li key={post.shortCode}>
                        <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/post flex h-full gap-3 rounded-lg border border-border bg-card p-2.5 shadow-lift transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-lift-lg"
                        >
                            {post.thumbnail ? (
                                <img
                                    src={post.thumbnail}
                                    alt=""
                                    loading="lazy"
                                    className="size-20 shrink-0 rounded-md object-cover"
                                />
                            ) : (
                                <span className="grid size-20 shrink-0 place-items-center rounded-md bg-neutral-soft text-muted-foreground">
                                    <Instagram
                                        className="size-5"
                                        strokeWidth={2}
                                    />
                                </span>
                            )}

                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex flex-wrap items-center gap-1.5">
                                    <FormatMark format={post.format} />
                                    {post.pinned ? (
                                        <Pin
                                            className="size-3 text-muted-foreground"
                                            strokeWidth={2.5}
                                            aria-label="disematkan"
                                        />
                                    ) : null}
                                    <span className="text-[0.6875rem] text-muted-foreground">
                                        {shortDate(post.postedAt)}
                                    </span>
                                </span>

                                <span className="mt-1 line-clamp-2 text-xs leading-relaxed font-semibold text-secondary-foreground transition-colors group-hover/post:text-primary-deep">
                                    {post.caption ?? 'Tanpa keterangan'}
                                </span>

                                <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[0.6875rem] text-muted-foreground">
                                    <Metric icon={Heart} value={post.likes} />
                                    <Metric
                                        icon={MessageCircle}
                                        value={post.comments}
                                    />
                                    {post.plays !== null ? (
                                        <Metric
                                            icon={Play}
                                            value={post.plays}
                                        />
                                    ) : null}
                                </span>
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Metric({ icon: Icon, value }: { icon: typeof Heart; value: number }) {
    return (
        <span className="inline-flex items-center gap-1 font-bold">
            <Icon className="size-3" strokeWidth={2.5} aria-hidden />
            <span data-numeric>{nf.format(value)}</span>
        </span>
    );
}

function Blank({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-10 text-center text-xs text-muted-foreground">
            {children}
        </p>
    );
}

/** The follower line needs two readings; the first one says so. */
function FirstReading() {
    return (
        <span className="grid h-9 w-[4.5rem] place-items-center rounded-md bg-white/15 text-[0.6875rem] leading-tight font-bold text-white/80">
            bacaan
            <br />
            pertama
        </span>
    );
}

function Notice({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4 text-[0.8438rem] leading-relaxed text-secondary-foreground shadow-lift">
            <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-destructive"
                strokeWidth={2}
                aria-hidden
            />
            <span>{children}</span>
        </p>
    );
}

function EmptyState() {
    return (
        <section className="flex min-w-0 flex-col items-center gap-3 rounded-xl border border-border bg-card py-14 text-center shadow-lift">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                <Instagram className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm font-bold">Belum ada data yang diambil</p>
            <p className="max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
                Tekan Perbarui data di atas untuk menarik profil dan konten
                terakhir dari Instagram. Pengambilan memakan waktu satu sampai
                dua menit karena dijalankan lewat scraper Apify.
            </p>
        </section>
    );
}

/**
 * What the window asked for, against what is actually on record.
 *
 * The store only reaches back as far as the last scrape did. A page scoped to
 * a year while the oldest post kept is two months old would otherwise report a
 * year it never saw — so when the window runs past the data, the page says
 * where the data really starts instead of letting the heading imply it.
 */
function Coverage({
    period,
    coverage,
}: {
    period: Period;
    coverage: Coverage | null;
}) {
    if (!coverage || coverage.stored === 0) {
        return null;
    }

    const short = Boolean(
        period.from && coverage.earliest && period.from < coverage.earliest,
    );

    return (
        <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
            <span className="font-bold text-secondary-foreground" data-numeric>
                {coverage.posts}
            </span>{' '}
            konten dibaca
            {coverage.from && coverage.to ? (
                <>
                    {', '}
                    <span data-numeric>
                        {shortDate(coverage.from)} – {shortDate(coverage.to)}
                    </span>
                </>
            ) : null}
            .{' '}
            {short ? (
                <span className="font-semibold text-secondary-foreground">
                    Yang tersimpan hanya sampai{' '}
                    <span data-numeric>{longDate(coverage.earliest!)}</span>;
                    sebelum itu belum pernah diambil.
                </span>
            ) : (
                'Semuanya dari pengambilan terakhir, bukan angka langsung.'
            )}
        </p>
    );
}

Performa.layout = {
    breadcrumbs: [
        {
            title: 'Performa',
            href: performance(),
        },
    ],
};
