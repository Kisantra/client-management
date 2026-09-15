import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUpRight,
    Bookmark,
    CalendarCheck,
    Clapperboard,
    Heart,
    MessageCircle,
    Play,
    Share2,
} from 'lucide-react';
import { useState } from 'react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { FormatMark } from '@/components/performance/format-mark';
import {
    ReportEmpty,
    ReportSection,
    Segmented,
    nf,
    nf1,
    times,
} from '@/components/report/report-section';
import { shortDate } from '@/data/instagram';
import { cn } from '@/lib/utils';
import { performance } from '@/routes';

type Platform = 'instagram' | 'tiktok';

export type TopPost = {
    id: string;
    platform: Platform;
    url: string | null;
    /** The post's own panel on the Performa page. */
    href: string;
    caption: string | null;
    thumbnail: string | null;
    format: string;
    postedAt: string;
    likes: number;
    comments: number;
    plays: number | null;
    shares: number | null;
    saves: number | null;
    interactions: number;
    /** The account's median interactions per post, over everything on record. */
    typical: number;
    /** Interactions over `typical`. Null when the typical post earned nothing. */
    lift: number | null;
    /** The calendar piece somebody tied to this post, and the leads it brought. */
    content: { title: string; leads: number } | null;
};

export type TopContentData = {
    posts: TopPost[];
    platforms: {
        key: Platform;
        label: string;
        posts: number;
        typical: number;
    }[];
};

/** How many make the ranking. Past this, Performa has the whole list. */
const LIMIT = 6;

const PLATFORM_LABEL: Record<Platform, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
};

/**
 * The period's best posts, one of them held up to the light.
 *
 * Ranked by how far a post rose above what its own account usually earns —
 * the only yardstick fair to both platforms, since TikTok counts shares and
 * saves an Instagram scrape never sees. The number a reader meets first is
 * therefore "6,8×", not "78": seventy-eight interactions means nothing until
 * you know the account's ordinary post earns eleven.
 *
 * The first post is shown large; pick any other in the ranking and it takes
 * the stage. The layout follows the count rather than reserving a shape: one
 * post fills the card on its own, two or three sit side by side, and only a
 * full ranking earns the list beside the spotlight — a list of two beside a
 * tall cover would be the empty band this card was redesigned to remove.
 */
export function TopContent({
    top,
    periodLabel,
}: {
    top: TopContentData;
    periodLabel: string;
}) {
    const [platform, setPlatform] = useState<'all' | Platform>('all');
    const [picked, setPicked] = useState<string | null>(null);

    const pool =
        platform === 'all'
            ? top.posts
            : top.posts.filter((post) => post.platform === platform);
    const list = pool.slice(0, LIMIT);
    const selected = list.find((post) => post.id === picked) ?? list[0];
    const rank = (post: TopPost) => list.indexOf(post) + 1;
    const bestLift = Math.max(...list.map((post) => post.lift ?? 0), 1);

    const live = top.platforms.filter((item) => item.posts > 0);
    const followed = top.platforms.map((item) => item.label).join(' dan ');

    return (
        <ReportSection
            title="Konten paling sukses"
            description={
                top.platforms.length === 0
                    ? 'Unggahan terbaik tiap periode, dari akun yang diikuti Performa.'
                    : `Unggahan ${followed} pada ${periodLabel}, diurutkan dari yang paling jauh melampaui interaksi biasa akunnya.`
            }
            action={
                live.length > 1 ? (
                    <Segmented
                        label="Tampilkan unggahan dari"
                        value={platform}
                        onChange={(next) => {
                            setPlatform(next);
                            setPicked(null);
                        }}
                        options={[
                            {
                                value: 'all',
                                label: 'Semua',
                                count: top.posts.length,
                            },
                            ...live.map((item) => ({
                                value: item.key,
                                label: item.label,
                                count: item.posts,
                            })),
                        ]}
                    />
                ) : undefined
            }
        >
            {!selected ? (
                <ReportEmpty
                    compact
                    icon={Clapperboard}
                    title={
                        top.platforms.length === 0
                            ? 'Performa belum mengikuti akun mana pun'
                            : 'Belum ada unggahan di periode ini'
                    }
                >
                    {top.platforms.length === 0 ? (
                        'Hubungkan Instagram atau TikTok di Performa, dan unggahan terbaik tiap periode akan muncul di sini.'
                    ) : (
                        <>
                            Tidak ada unggahan baru di {followed} yang tercatat
                            pada {periodLabel}.{' '}
                            <Link
                                href={performance()}
                                className="font-bold text-primary-deep underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                            >
                                Buka Performa
                            </Link>
                        </>
                    )}
                </ReportEmpty>
            ) : list.length === 1 ? (
                <Spotlight post={selected} rank={1} variant="wide" />
            ) : list.length <= 3 ? (
                <div
                    className={cn(
                        'grid gap-4 sm:grid-cols-2',
                        list.length === 3 && 'lg:grid-cols-3',
                    )}
                >
                    {list.map((post, at) => (
                        <Spotlight
                            key={post.id}
                            post={post}
                            rank={at + 1}
                            variant="card"
                        />
                    ))}
                </div>
            ) : (
                <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-5">
                    <Spotlight
                        key={selected.id}
                        post={selected}
                        rank={rank(selected)}
                        variant="fill"
                    />

                    <div className="flex min-w-0 flex-col">
                        <ol className="flex flex-1 flex-col justify-between gap-1">
                            {list.map((post, at) => (
                                <li key={post.id}>
                                    <RankRow
                                        post={post}
                                        rank={at + 1}
                                        on={post.id === selected.id}
                                        share={(post.lift ?? 0) / bestLift}
                                        onPick={() => setPicked(post.id)}
                                    />
                                </li>
                            ))}
                        </ol>

                        <Link
                            href={performance({
                                query:
                                    platform === 'all'
                                        ? undefined
                                        : { platform },
                            })}
                            className="mt-3 inline-flex items-center gap-1.5 self-end rounded-sm px-1 text-xs font-bold text-secondary-foreground transition-colors hover:text-primary-deep"
                        >
                            {pool.length > LIMIT
                                ? `${nf.format(pool.length - LIMIT)} unggahan lainnya di Performa`
                                : 'Lihat semua di Performa'}
                            <ArrowRight
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                        </Link>
                    </div>
                </div>
            )}
        </ReportSection>
    );
}

/**
 * One post, large.
 *
 * `fill` grows to the height of the ranking beside it, `card` keeps a fixed
 * cover for a row of two or three, and `wide` lays the cover beside the words
 * when a single post has the whole card to itself.
 */
function Spotlight({
    post,
    rank,
    variant,
}: {
    post: TopPost;
    rank: number;
    variant: 'fill' | 'card' | 'wide';
}) {
    const label = PLATFORM_LABEL[post.platform];
    /* Within a twentieth of usual is usual: "1× di atas biasanya" says
       nothing happened in a sentence that claims something did. */
    const verdict =
        post.lift === null
            ? null
            : post.lift >= 1.05
              ? 'di atas biasanya'
              : post.lift > 0.95
                ? 'setara biasanya'
                : 'dari biasanya';

    return (
        <article
            className={cn(
                'animate-settle flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
                variant === 'wide' && 'md:flex-row',
            )}
        >
            <Link
                href={post.href}
                className={cn(
                    'group/cover relative block overflow-hidden bg-neutral-soft focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none focus-visible:ring-inset',
                    variant === 'fill' && 'min-h-60 flex-1',
                    /* A fixed height, not a ratio: at two across, 4:3 made
                       each cover taller than the whole ranking it replaces. */
                    variant === 'card' && 'h-52',
                    variant === 'wide' &&
                        'aspect-[4/3] md:aspect-auto md:min-h-72 md:w-2/5 md:shrink-0',
                )}
            >
                {post.thumbnail ? (
                    <img
                        src={post.thumbnail}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/cover:scale-[1.03] motion-reduce:transition-none"
                    />
                ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted-foreground">
                        <ChannelIcon
                            channel={post.platform}
                            className="size-8"
                        />
                    </span>
                )}

                {/* A scrim, so the figure set on the photograph reads on any
                    photograph — a white number on a white wall is no number. */}
                <span
                    className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
                    aria-hidden
                />

                <span className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span
                        className="rounded-full bg-card px-2 py-0.5 text-xs font-extrabold text-foreground shadow-lift"
                        data-numeric
                    >
                        #{rank}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                        <ChannelIcon
                            channel={post.platform}
                            className="size-3"
                        />
                        {label}
                    </span>
                </span>

                <span className="absolute inset-x-4 bottom-3.5 text-white">
                    {post.lift !== null ? (
                        <span className="flex items-baseline gap-2">
                            <span
                                className="text-[1.875rem] leading-none font-extrabold tracking-[-0.035em]"
                                data-numeric
                            >
                                {times(post.lift)}
                            </span>
                            <span className="text-xs font-bold text-white/85">
                                {verdict}
                            </span>
                        </span>
                    ) : null}
                    <span className="mt-1.5 block text-xs text-white/85">
                        <span className="font-bold text-white" data-numeric>
                            {nf.format(post.interactions)}
                        </span>{' '}
                        interaksi · biasanya{' '}
                        <span data-numeric>{nf1.format(post.typical)}</span> per
                        unggahan
                    </span>
                </span>
            </Link>

            <div className="flex min-w-0 flex-col gap-2.5 p-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <FormatMark format={post.format} />
                    <span
                        className="text-xs text-muted-foreground"
                        data-numeric
                    >
                        {shortDate(post.postedAt)}
                    </span>
                </div>

                <p
                    className={cn(
                        'text-[0.8438rem] leading-snug font-bold',
                        variant === 'wide' ? 'line-clamp-4' : 'line-clamp-2',
                        !post.caption && 'text-muted-foreground',
                    )}
                >
                    {post.caption ?? 'Tanpa keterangan'}
                </p>

                <Counts post={post} />

                {post.content ? (
                    <p className="flex min-w-0 items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1.5 text-xs text-primary-deep">
                        <CalendarCheck
                            className="size-3.5 shrink-0"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <span className="min-w-0 truncate">
                            <span className="font-bold">
                                {post.content.title}
                            </span>
                            {post.content.leads > 0
                                ? ` · ${nf.format(post.content.leads)} lead`
                                : ' · belum ada lead'}
                        </span>
                    </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs font-bold">
                    <Link
                        href={post.href}
                        className="inline-flex items-center gap-1 text-primary-deep underline-offset-2 hover:underline"
                    >
                        Lihat detail
                        <ArrowRight
                            className="size-3.5"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                    </Link>
                    {post.url ? (
                        <a
                            href={post.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-secondary-foreground transition-colors hover:text-primary-deep"
                        >
                            Buka di {label}
                            <ArrowUpRight
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                        </a>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

function RankRow({
    post,
    rank,
    on,
    share,
    onPick,
}: {
    post: TopPost;
    rank: number;
    on: boolean;
    /** This post's lift against the best in the ranking, 0 to 1. */
    share: number;
    onPick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onPick}
            className={cn(
                'grid w-full grid-cols-[1.25rem_2.75rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                on ? 'bg-primary-soft' : 'hover:bg-neutral-soft',
            )}
        >
            <span
                className={cn(
                    'text-center text-sm font-extrabold',
                    on ? 'text-primary-deep' : 'text-muted-foreground',
                )}
                data-numeric
            >
                {rank}
            </span>

            {post.thumbnail ? (
                <img
                    src={post.thumbnail}
                    alt=""
                    loading="lazy"
                    className="size-11 rounded-md border border-border object-cover"
                />
            ) : (
                <span className="grid size-11 place-items-center rounded-md bg-neutral-soft text-muted-foreground">
                    <ChannelIcon channel={post.platform} />
                </span>
            )}

            <span className="min-w-0">
                <span
                    className={cn(
                        'block truncate text-[0.8438rem] font-bold',
                        on && 'text-primary-deep',
                        !post.caption && 'text-muted-foreground',
                    )}
                >
                    {post.caption ?? 'Tanpa keterangan'}
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <ChannelIcon channel={post.platform} className="size-3" />
                    <span className="sr-only">
                        {PLATFORM_LABEL[post.platform]}
                    </span>
                    <span className="shrink-0" data-numeric>
                        {shortDate(post.postedAt)}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="truncate" data-numeric>
                        {nf.format(post.interactions)} interaksi
                    </span>
                </span>
            </span>

            <span className="text-right">
                <span
                    className={cn(
                        'block text-sm font-extrabold',
                        post.lift !== null && post.lift >= 1
                            ? 'text-primary-deep'
                            : 'text-muted-foreground',
                    )}
                    data-numeric
                >
                    {post.lift !== null ? times(post.lift) : '—'}
                </span>
                <span
                    className="mt-1 ml-auto block h-1 w-full rounded-full bg-neutral-soft"
                    aria-hidden
                >
                    <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${Math.max(share * 100, 4)}%` }}
                    />
                </span>
            </span>
        </button>
    );
}

/** What the platform counted, and only what it counted. */
function Counts({ post }: { post: TopPost }) {
    const counts = [
        { icon: Heart, value: post.likes, label: 'suka' },
        { icon: MessageCircle, value: post.comments, label: 'komentar' },
        { icon: Play, value: post.plays, label: 'diputar' },
        { icon: Share2, value: post.shares, label: 'dibagikan' },
        { icon: Bookmark, value: post.saves, label: 'disimpan' },
    ].filter(
        (count): count is typeof count & { value: number } =>
            count.value !== null,
    );

    return (
        <p className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[0.8438rem]">
            {counts.map((count) => (
                <span
                    key={count.label}
                    className="inline-flex items-center gap-1.5"
                    title={count.label}
                >
                    <count.icon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        strokeWidth={2.5}
                        aria-hidden
                    />
                    <span className="font-bold" data-numeric>
                        {nf.format(count.value)}
                    </span>
                    <span className="sr-only">{count.label}</span>
                </span>
            ))}
        </p>
    );
}
