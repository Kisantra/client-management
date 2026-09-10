import { Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    ExternalLink,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import type { ChannelKey } from '@/data/dashboard';
import { cn } from '@/lib/utils';
import { performance as performanceIndex } from '@/routes';

/** One post the app already knows went out, as the picker offers it. */
export type ReleasedPost = {
    url: string;
    channel: ChannelKey;
    format: string;
    caption: string;
    date: string;
    postedAt: string;
    thumb: string | null;
    /** Already the Tautan of some other piece. */
    taken: boolean;
};

/**
 * Picks the piece's live address from what Performa already scraped.
 *
 * Every address this field wants is in the app already — Performa pulls each
 * post the moment it goes out. Asking somebody to open Instagram, find the
 * post, copy the address and come back was asking them to fetch something
 * from the next room while holding it.
 *
 * The typed box stays underneath, and stays a real field. Not everything the
 * team publishes lives on the two accounts Performa follows, and a picker that
 * refuses anything it has not heard of cannot record the one link somebody
 * actually needed.
 */
export function LinkPicker({
    value,
    onChange,
    invalid,
    describedBy,
}: {
    value: string;
    onChange: (url: string) => void;
    invalid: boolean;
    describedBy?: string;
}) {
    const released = usePage().props.released as ReleasedPost[] | undefined;

    const [open, setOpen] = useState(false);

    /* When the field already holds one of the known posts, the field can show
       the post rather than a hundred characters of address. */
    const chosen = released?.find((post) => post.url === value) ?? null;

    return (
        <div className="flex flex-col gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'flex w-full items-center gap-2.5 rounded-md border bg-transparent px-3 py-2 text-left text-sm shadow-xs transition-colors',
                            invalid
                                ? 'border-destructive'
                                : 'border-input hover:border-primary/40',
                        )}
                    >
                        {chosen ? (
                            <Preview post={chosen} />
                        ) : value ? (
                            <span className="min-w-0 flex-1 truncate text-foreground">
                                {value}
                            </span>
                        ) : (
                            <span className="min-w-0 flex-1 text-muted-foreground">
                                Pilih dari konten yang sudah tayang…
                            </span>
                        )}

                        <ChevronDown
                            className="size-4 shrink-0 text-muted-foreground"
                            strokeWidth={2}
                            aria-hidden
                        />
                    </button>
                </PopoverTrigger>

                {/*
                    Tautan is the last field on a long form, so the list opens
                    against the bottom of the window as often as not. Bound to
                    the space Radix says is actually there, rather than a fixed
                    height that gets cut off by the edge.
                */}
                <PopoverContent
                    align="start"
                    collisionPadding={12}
                    className="flex max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) flex-col p-0"
                >
                    <ReleasedList
                        value={value}
                        onPick={(url) => {
                            onChange(url);
                            setOpen(false);
                        }}
                    />
                </PopoverContent>
            </Popover>

            {/*
                The address itself, still typed and still cleared by hand. The
                picker is the shortcut, not the gate.
            */}
            <div className="flex items-center gap-2">
                <Input
                    id="url"
                    type="url"
                    inputMode="url"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="atau tempel sendiri: https://www.instagram.com/p/…"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="text-[0.8438rem]"
                />
                {value ? (
                    <>
                        <a
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Buka tautan"
                            className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                        >
                            <ExternalLink
                                className="size-4"
                                strokeWidth={2}
                                aria-hidden
                            />
                            <span className="sr-only">Buka tautan</span>
                        </a>
                        <button
                            type="button"
                            onClick={() => onChange('')}
                            title="Kosongkan tautan"
                            className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                        >
                            <X className="size-4" strokeWidth={2} aria-hidden />
                            <span className="sr-only">Kosongkan tautan</span>
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
}

/**
 * The posts Performa already scraped, searchable, as a list to pick from.
 *
 * Shared by the form's picker and by the panel's own Tautan line: one list,
 * one empty state, one explanation of why it might be empty.
 *
 * The options are asked for when this first mounts rather than shipped with
 * the calendar — and this only mounts when somebody opens it. Two hundred
 * scraped posts on every page load, for a field most pieces never fill, is a
 * page paying for a door nobody walked through.
 */
export function ReleasedList({
    value,
    onPick,
}: {
    value: string;
    onPick: (url: string) => void;
}) {
    const released = usePage().props.released as ReleasedPost[] | undefined;
    const [query, setQuery] = useState('');

    /* A ref, not state: nothing on screen turns on whether the ask has gone
       out, and a second render for it would be a render for nobody. */
    const asked = useRef(false);

    useEffect(() => {
        /* Once per visit to the page: the list changes when Performa syncs,
           not while somebody is deciding. */
        if (released || asked.current) {
            return;
        }

        asked.current = true;
        router.reload({ only: ['released'] });
    }, [released]);

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase();

        if (!released) {
            return [];
        }

        if (!needle) {
            return released;
        }

        return released.filter(
            (post) =>
                post.caption.toLowerCase().includes(needle) ||
                post.url.toLowerCase().includes(needle) ||
                post.date.toLowerCase().includes(needle),
        );
    }, [released, query]);

    return (
        <>
            <div className="shrink-0 border-b border-border p-2">
                <div className="relative">
                    <Search
                        className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                    />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Cari keterangan atau tanggal…"
                        className="h-8 pl-8 text-[0.8438rem]"
                        aria-label="Cari konten yang sudah tayang"
                    />
                </div>
            </div>

            {!released ? (
                <p className="flex items-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                    <Spinner className="size-3.5" />
                    Mengambil konten dari Performa…
                </p>
            ) : released.length === 0 ? (
                <NotSynced />
            ) : matches.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Tidak ada yang cocok dengan “{query.trim()}”.
                </p>
            ) : (
                <ul className="scroll-slim min-h-0 flex-1 overflow-y-auto p-1">
                    {matches.map((post) => (
                        <li key={post.url}>
                            <Option
                                post={post}
                                active={post.url === value}
                                onPick={() => onPick(post.url)}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

/** The chosen post, on the closed trigger. */
function Preview({ post }: { post: ReleasedPost }) {
    return (
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <Thumb post={post} className="size-7" />
            <span className="min-w-0 flex-1 truncate text-foreground">
                {post.caption || 'Tanpa keterangan'}
            </span>
            <span
                className="shrink-0 text-xs text-muted-foreground"
                data-numeric
            >
                {post.date}
            </span>
        </span>
    );
}

function Option({
    post,
    active,
    onPick,
}: {
    post: ReleasedPost;
    active: boolean;
    onPick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onPick}
            className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                active ? 'bg-primary-soft' : 'hover:bg-neutral-soft',
            )}
        >
            <Thumb post={post} className="size-9" />

            <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-[0.8438rem] font-bold">
                    {post.caption || 'Tanpa keterangan'}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ChannelIcon channel={post.channel} className="size-3" />
                    <span className="capitalize">{post.format}</span>
                    <span aria-hidden>·</span>
                    <span data-numeric>{post.date}</span>
                    {/* Two pieces pointing at one post is nearly always a slip,
                        so the picker says so rather than letting it happen
                        quietly. It still allows it. */}
                    {post.taken && !active ? (
                        <>
                            <span aria-hidden>·</span>
                            <span className="font-semibold text-destructive">
                                sudah dipakai
                            </span>
                        </>
                    ) : null}
                </span>
            </span>

            {active ? (
                <Check
                    className="size-4 shrink-0 text-primary"
                    strokeWidth={2.5}
                    aria-hidden
                />
            ) : null}
        </button>
    );
}

function Thumb({ post, className }: { post: ReleasedPost; className: string }) {
    if (!post.thumb) {
        return (
            <span
                className={cn(
                    'grid shrink-0 place-items-center rounded-md bg-neutral-soft text-muted-foreground',
                    className,
                )}
                aria-hidden
            >
                <ChannelIcon channel={post.channel} className="size-3.5" />
            </span>
        );
    }

    return (
        <img
            src={post.thumb}
            alt=""
            loading="lazy"
            className={cn(
                'shrink-0 rounded-md border border-border object-cover',
                className,
            )}
        />
    );
}

/**
 * Nothing to offer, and the reason is somewhere else.
 *
 * An empty picker that only says "kosong" leaves the reader to work out that
 * the emptiness is not about this piece at all — it is about Performa never
 * having been synced. So it says that, and goes there.
 */
function NotSynced() {
    return (
        <div className="flex flex-col items-center gap-2.5 px-4 py-8 text-center">
            <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                <RefreshCw className="size-4" strokeWidth={2} aria-hidden />
            </span>
            <p className="text-[0.8438rem] font-bold">
                Belum ada konten tayang yang tersimpan
            </p>
            <p className="max-w-[34ch] text-xs leading-relaxed text-balance text-muted-foreground">
                Daftar ini diambil dari Performa. Sinkronkan datanya dulu, lalu
                buka lagi pilihan ini.
            </p>
            <Link
                href={performanceIndex()}
                className="mt-1 rounded-md bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary-deep transition-colors hover:bg-accent"
            >
                Buka Performa
            </Link>
        </div>
    );
}
