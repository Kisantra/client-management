import { router } from '@inertiajs/react';
import {
    ArrowUpRight,
    AtSign,
    Bookmark,
    Clock,
    Expand,
    Hash,
    Heart,
    Loader2,
    MapPin,
    MessageCircle,
    Music,
    Play,
    Ratio,
    Share2,
    Users,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { FormatMark } from '@/components/performance/format-mark';
import { VideoTheatre } from '@/components/performance/video-theatre';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    duration,
    longDate,
    nf,
    rateFormat,
    sinceLabel,
} from '@/data/instagram';
import type { PostDetail } from '@/data/instagram';
import { cn } from '@/lib/utils';
import { video as keepVideo } from '@/routes/performance';

/**
 * One post, in full.
 *
 * The list answers "how did this land"; this answers "what exactly was it".
 * Everything the scraper returned and this app keeps is readable here — the
 * whole caption, every hashtag and mention, the track a Reel used, the frame it
 * was shot in — because a record you cannot read is not a record.
 *
 * Detached from the edge like the content calendar's panel: it is a sheet laid
 * over the page, not a drawer built into its side, and the page stays visible
 * around it.
 */
export function PostSheet({
    post,
    open,
    onOpenChange,
}: {
    post: PostDetail | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                showClose={false}
                className="inset-y-3 right-3 h-auto w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-xl border-border p-0 shadow-carry sm:inset-y-4 sm:right-4 sm:w-[34rem] sm:max-w-[34rem]"
            >
                {post ? <Body key={post.shortCode} post={post} /> : null}
            </SheetContent>
        </Sheet>
    );
}

function Body({ post }: { post: PostDetail }) {
    const [fetching, setFetching] = useState(false);
    const [watching, setWatching] = useState(false);
    /* Where the small player had got to, so watching properly resumes it
       rather than starting the video over. */
    const [resumeAt, setResumeAt] = useState(0);
    const inline = useRef<HTMLVideoElement>(null);

    const watch = () => {
        const node = inline.current;

        setResumeAt(node?.currentTime ?? 0);
        node?.pause();
        setWatching(true);
    };

    /* Copied on request rather than during the scrape: sixty videos is half a
       gigabyte, and asking to watch one is the only moment anyone has said
       this particular video is worth the disk. */
    const keep = () =>
        router.post(
            keepVideo({ platform: post.platform, code: post.shortCode }).url,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setFetching(true),
                onFinish: () => setFetching(false),
            },
        );

    const metrics = [
        { icon: Heart, label: 'Suka', value: post.likes },
        { icon: MessageCircle, label: 'Komentar', value: post.comments },
        ...(post.plays !== null
            ? [{ icon: Play, label: 'Pemutaran', value: post.plays }]
            : []),
        ...(post.views !== null
            ? [{ icon: Users, label: 'View', value: post.views }]
            : []),
        /* TikTok reports two more than Instagram's public scrape does, and a
           save is the strongest thing a viewer can do about tax advice. */
        ...(post.shares !== null && post.shares !== undefined
            ? [{ icon: Share2, label: 'Dibagikan', value: post.shares }]
            : []),
        ...(post.saves !== null && post.saves !== undefined
            ? [{ icon: Bookmark, label: 'Disimpan', value: post.saves }]
            : []),
    ];

    /* One height per shape, shared by the still and the player, so keeping a
       video never makes the panel jump. */
    const frame =
        post.aspect === 'portrait'
            ? 'max-h-72'
            : post.aspect === 'landscape'
              ? 'max-h-48'
              : 'max-h-64';

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Toolbar: the way out on the left, the one action on the right. */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
                <SheetClose asChild>
                    <button
                        type="button"
                        className="grid size-9 place-items-center rounded-md text-secondary-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                    >
                        <X className="size-4" strokeWidth={2.5} aria-hidden />
                        <span className="sr-only">Tutup</span>
                    </button>
                </SheetClose>

                <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-3 py-2 text-[0.8438rem] font-bold text-primary-deep transition-colors hover:bg-accent"
                >
                    Buka di{' '}
                    {post.platform === 'tiktok' ? 'TikTok' : 'Instagram'}
                    <ArrowUpRight
                        className="size-3.5"
                        strokeWidth={2.5}
                        aria-hidden
                    />
                </a>
            </div>

            {/*
             | One band per question, ruled apart: what it was, what it looked
             | like, what it earned, what it said, and what it was made of. The
             | panel used to be one long run of prose with small caps sprinkled
             | through it, which reads as a document rather than a record.
             */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col divide-y divide-border">
                    <div className="p-5 pb-4">
                        <SheetTitle className="flex flex-wrap items-center gap-2 text-base font-extrabold tracking-[-0.02em]">
                            <FormatMark
                                format={post.format}
                                slides={post.slides}
                            />
                            <span>{longDate(post.postedAt)}</span>
                        </SheetTitle>
                        <SheetDescription className="mt-1 text-xs leading-relaxed">
                            {post.fetchedAt
                                ? `Angka di bawah tercatat ${sinceLabel(post.fetchedAt)}, bukan angka langsung dari ${post.platform === 'tiktok' ? 'TikTok' : 'Instagram'}.`
                                : 'Tercatat dari pengambilan terakhir.'}
                        </SheetDescription>
                    </div>

                    {/*
                        The post itself, filling the band it stands in.

                        A vertical cover is a 9:16 sliver: centred on a plain
                        bed it left more empty field than picture, and the
                        emptiness read as something failing to load. The frame
                        fills its own letterbox instead — the same image blown
                        past the edges and blurred out of legibility, so the
                        space beside the picture is made of the picture. It is
                        the letterbox every video player draws, not decoration:
                        a post whose cover is dark gets a dark surround, one
                        shot against a white wall gets a pale one.
                    */}
                    {post.thumbnail ? (
                        <div className="relative isolate flex justify-center overflow-hidden p-5">
                            <img
                                src={post.thumbnail}
                                alt=""
                                aria-hidden
                                className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-45 blur-2xl saturate-150"
                            />

                            {post.video ? (
                                /* Our own copy, playing from our own disk.
                                   At this size it is a glance; the corner
                                   opens it at the height of the window. */
                                <span className="group/film relative">
                                    <video
                                        ref={inline}
                                        key={post.video}
                                        src={post.video}
                                        poster={post.thumbnail}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className={cn(
                                            'w-auto max-w-full rounded-lg border border-border bg-black object-contain',
                                            frame,
                                        )}
                                    />

                                    <button
                                        type="button"
                                        onClick={watch}
                                        title="Tonton lebih besar"
                                        className="absolute top-2 right-2 grid size-9 place-items-center rounded-md bg-ink-panel/55 text-ink-panel-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover/film:opacity-100 focus-visible:opacity-100"
                                    >
                                        <Expand
                                            className="size-4"
                                            strokeWidth={2.5}
                                            aria-hidden
                                        />
                                        <span className="sr-only">
                                            Tonton lebih besar
                                        </span>
                                    </button>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={
                                        post.videoAvailable ? keep : undefined
                                    }
                                    disabled={!post.videoAvailable || fetching}
                                    aria-label={
                                        post.videoAvailable
                                            ? 'Simpan videonya lalu putar di sini'
                                            : undefined
                                    }
                                    className={cn(
                                        'group/play relative rounded-lg',
                                        post.videoAvailable
                                            ? 'cursor-pointer'
                                            : 'cursor-default',
                                    )}
                                >
                                    <img
                                        src={post.thumbnail}
                                        alt={post.alt ?? ''}
                                        className={cn(
                                            'w-auto max-w-full rounded-lg border border-border object-contain',
                                            frame,
                                        )}
                                    />

                                    {/* A video nobody has kept yet: the frame
                                        is the control, and it says what it
                                        will do rather than pretending to be a
                                        player that is not there. */}
                                    {post.videoAvailable ? (
                                        <span className="absolute inset-0 grid place-items-center rounded-lg bg-ink-panel/35 transition-colors group-hover/play:bg-ink-panel/50">
                                            <span className="flex items-center gap-2 rounded-full bg-card px-3.5 py-2 text-[0.8438rem] font-bold text-foreground shadow-lift">
                                                {fetching ? (
                                                    <>
                                                        <Loader2
                                                            className="size-4 animate-spin"
                                                            strokeWidth={2.5}
                                                            aria-hidden
                                                        />
                                                        Mengunduh…
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play
                                                            className="size-4 fill-current"
                                                            strokeWidth={2.5}
                                                            aria-hidden
                                                        />
                                                        Simpan &amp; putar
                                                    </>
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                </button>
                            )}
                        </div>
                    ) : null}

                    {/* The counts and what they come to, in one band: the rate
                        is what these four numbers add up to, so reading it
                        anywhere else means holding them in your head. */}
                    <div className="@container p-5">
                        <dl
                            className={cn(
                                'grid grid-cols-2 gap-x-4 gap-y-4',
                                /* Never an orphan on the last row: five
                                   figures read as three and two, not four
                                   and one. */
                                metrics.length <= 2
                                    ? ''
                                    : metrics.length === 3 ||
                                        metrics.length === 5
                                      ? '@sm:grid-cols-3'
                                      : '@sm:grid-cols-4',
                            )}
                        >
                            {metrics.map((metric) => (
                                <div key={metric.label} className="min-w-0">
                                    <dt className="flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                        <metric.icon
                                            className="size-3 shrink-0"
                                            strokeWidth={2.5}
                                            aria-hidden
                                        />
                                        <span className="truncate">
                                            {metric.label}
                                        </span>
                                    </dt>
                                    <dd
                                        className="mt-1 text-xl leading-none font-extrabold tracking-[-0.02em]"
                                        data-numeric
                                    >
                                        {nf.format(metric.value)}
                                    </dd>
                                </div>
                            ))}
                        </dl>

                        <EngagementRate post={post} />
                    </div>

                    {post.caption ? (
                        <Section title="Keterangan">
                            <p className="text-[0.8438rem] leading-relaxed whitespace-pre-line text-secondary-foreground">
                                {post.caption}
                            </p>
                        </Section>
                    ) : null}

                    {post.hashtags.length > 0 ||
                    post.mentions.length > 0 ||
                    post.taggedUsers.length > 0 ? (
                        <Section title="Tag">
                            {/* Two lists, one band: both are things the post
                                pointed at, and side by side they were two
                                identical grey fields with different headings. */}
                            {post.hashtags.length > 0 ? (
                                <p className="flex flex-wrap gap-1.5">
                                    {post.hashtags.map((tag) => (
                                        <Tag key={tag} icon={Hash}>
                                            {tag}
                                        </Tag>
                                    ))}
                                </p>
                            ) : null}

                            {post.mentions.length > 0 ||
                            post.taggedUsers.length > 0 ? (
                                <p className="mt-1.5 flex flex-wrap gap-1.5">
                                    {[
                                        ...new Set([
                                            ...post.mentions,
                                            ...post.taggedUsers,
                                        ]),
                                    ].map((name) => (
                                        <Tag key={name} icon={AtSign}>
                                            {name}
                                        </Tag>
                                    ))}
                                </p>
                            ) : null}
                        </Section>
                    ) : null}

                    <Section title="Rincian">
                        <dl className="flex flex-col gap-2.5 text-[0.8438rem]">
                            {post.music?.song ? (
                                <Fact icon={Music} label="Audio">
                                    {post.music.song}
                                    {post.music.artist
                                        ? ` · ${post.music.artist}`
                                        : ''}
                                </Fact>
                            ) : null}
                            {post.duration ? (
                                <Fact icon={Clock} label="Durasi">
                                    {duration(post.duration)}
                                </Fact>
                            ) : null}
                            {post.width && post.height ? (
                                <Fact icon={Ratio} label="Ukuran">
                                    <span data-numeric>
                                        {post.width} × {post.height}
                                    </span>
                                </Fact>
                            ) : null}
                            {post.location ? (
                                <Fact icon={MapPin} label="Lokasi">
                                    {post.location}
                                </Fact>
                            ) : null}
                        </dl>

                        {post.pinned ||
                        post.paidPartnership ||
                        post.commentsDisabled ? (
                            <p className="mt-3 flex flex-wrap gap-1.5">
                                {post.pinned ? <State>Disematkan</State> : null}
                                {post.paidPartnership ? (
                                    <State>Kerja sama berbayar</State>
                                ) : null}
                                {post.commentsDisabled ? (
                                    <State>Komentar ditutup</State>
                                ) : null}
                            </p>
                        ) : null}
                    </Section>

                    {post.firstComment ? (
                        <Section title="Komentar pertama">
                            <p className="text-[0.8438rem] leading-relaxed text-secondary-foreground">
                                {post.firstComment}
                            </p>
                        </Section>
                    ) : null}
                </div>
            </div>

            <VideoTheatre
                post={post}
                open={watching}
                onOpenChange={setWatching}
                startAt={resumeAt}
            />
        </div>
    );
}

/**
 * The panel's conclusion, read as a figure rather than told as a sentence.
 *
 * Three numbers in one line of prose make the eye parse a sentence to find
 * them; the metrics above already show that a figure belongs on its own line
 * under its label. The derivation stays underneath as the counterweight, and
 * the account's usual rate sits beside it — a bare 0,03% means nothing until
 * you know whether this account normally earns more.
 */
function EngagementRate({ post }: { post: PostDetail }) {
    const gap = post.rate - post.typicalRate;
    /* Under a hundredth of a point apart is the same number to a reader. */
    const level = Math.abs(gap) < 0.005 ? 'sama' : gap > 0 ? 'atas' : 'bawah';

    return (
        <section className="mt-5 rounded-lg bg-neutral-soft p-4">
            <h3 className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Engagement rate
            </h3>

            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span
                    className="text-[1.875rem] leading-none font-extrabold tracking-[-0.035em]"
                    data-numeric
                >
                    {rateFormat.format(post.rate)}
                    <span className="text-base font-medium text-muted-foreground">
                        %
                    </span>
                </span>

                {/* Below usual is not a breach, so it never reads in red. */}
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-[0.6875rem] font-extrabold',
                        level === 'atas'
                            ? 'bg-primary-soft text-primary-deep'
                            : 'bg-card text-muted-foreground',
                    )}
                >
                    {level === 'sama'
                        ? 'seperti biasanya'
                        : level === 'atas'
                          ? 'di atas biasanya'
                          : 'di bawah biasanya'}
                </span>
            </p>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <span
                    className="font-bold text-secondary-foreground"
                    data-numeric
                >
                    {nf.format(post.interactions)}
                </span>{' '}
                interaksi dari{' '}
                <span
                    className="font-bold text-secondary-foreground"
                    data-numeric
                >
                    {nf.format(post.rateBasis)}
                </span>{' '}
                {post.rateNoun} · akun ini biasanya{' '}
                <span
                    className="font-bold text-secondary-foreground"
                    data-numeric
                >
                    {rateFormat.format(post.typicalRate)}%
                </span>
            </p>
        </section>
    );
}

/** One band of the record: a heading, and whatever it introduces. */
function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="min-w-0 p-5">
            <h3 className="mb-2 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {title}
            </h3>
            {children}
        </section>
    );
}

function Fact({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof Music;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <Icon
                    className="size-3.5 shrink-0 translate-y-0.5"
                    strokeWidth={2}
                    aria-hidden
                />
                {label}
            </dt>
            <dd className="min-w-0 truncate text-right font-bold">
                {children}
            </dd>
        </div>
    );
}

function Tag({
    icon: Icon,
    children,
}: {
    icon: typeof Hash;
    children: React.ReactNode;
}) {
    return (
        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-soft py-1 pr-2.5 pl-2 text-[0.6875rem] font-bold text-secondary-foreground">
            <Icon className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
            <span className="truncate">{children}</span>
        </span>
    );
}

function State({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[0.6875rem] font-bold text-primary-deep">
            {children}
        </span>
    );
}
