import { Head, Link, router } from '@inertiajs/react';
import {
    Check,
    ExternalLink,
    Lightbulb,
    Newspaper,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { CountChip } from '@/components/count-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { dayLabel, toIso } from '@/data/content';
import type { NewsRow } from '@/data/ideas';
import { TODAY } from '@/data/leads';
import { cn } from '@/lib/utils';
import { content as contentIndex } from '@/routes';
import { ideas as ideasIndex, news as newsIndex } from '@/routes/content';
import { idea as saveIdea } from '@/routes/content/news';

/** What the feed is allowed to show, so the page can say it out loud. */
type Window = {
    /** Zero when the page shows the whole archive rather than a window. */
    days: number;
    minScore: number;
    since: string | null;
};

type Filters = {
    q: string;
    kategori: string;
    sumber: string;
    ide: string;
};

type Day = {
    key: string;
    count: number;
    items: NewsRow[];
};

type Facet = { key: string; count: number };

type Props = {
    filters: Filters;
    days: Day[];
    categories: Facet[];
    sources: Facet[];
    /** Every story the filters match, not just the ones on this page. */
    total: number;
    /** How many of those nobody has turned into an idea yet. */
    unused: number;
    page: {
        shown: number;
        hasMore: boolean;
        next: string | null;
        prev: string | null;
    };
    window: Window;
};

/** Only what differs from the default rides in the URL. */
const DEFAULTS: Filters = {
    q: '',
    kategori: 'semua',
    sumber: 'semua',
    ide: 'semua',
};

/** How long to wait after the last keystroke before asking the server. */
const TYPING = 300;

/**
 * The stories the calendar feeds on, newest first, grouped by the day they
 * ran. A press on "Jadikan ide" moves one onto the idea backlog and the row
 * remembers it.
 *
 * Two thousand of them used to arrive in one payload and render as one list,
 * which made the page unusable for the only thing anybody opens it to do:
 * find a story. It reads fifty at a time now, and carries the three controls
 * that make an archive navigable — a search across what a story said, what it
 * was about and who ran it; the five categories as chips that show what
 * switching to one would find; and the sources with volume by name.
 */
export default function ContentNewsPage({
    filters,
    days,
    categories,
    sources,
    total,
    unused,
    page,
    window: feed,
}: Props) {
    const [savingId, setSavingId] = useState<number | null>(null);

    /** The one control that types faster than the server can answer. */
    const [query, setQuery] = useState(filters.q);
    const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

    const today = toIso(TODAY);

    const go = (next: Partial<Filters>) => {
        const asked = { ...filters, q: query, ...next };

        router.get(
            newsIndex.url({
                query: Object.fromEntries(
                    Object.entries(asked).filter(
                        ([key, value]) =>
                            value !== DEFAULTS[key as keyof Filters],
                    ),
                ),
            }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const search = (value: string) => {
        setQuery(value);

        if (typing.current) {
            clearTimeout(typing.current);
        }

        typing.current = setTimeout(() => go({ q: value }), TYPING);
    };

    const narrowed =
        filters.q !== '' ||
        filters.kategori !== 'semua' ||
        filters.sumber !== 'semua' ||
        filters.ide !== 'semua';

    const save = (item: NewsRow) =>
        router.post(
            saveIdea(item.id).url,
            {},
            {
                preserveScroll: true,
                onStart: () => setSavingId(item.id),
                onFinish: () => setSavingId(null),
            },
        );

    return (
        <>
            <Head title="Berita Terbaru" />

            <div className="animate-settle flex flex-1 flex-col gap-5 p-4 sm:p-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                        Berita Terbaru
                    </h1>
                    {/* The scope is part of the headline, not a footnote: a feed that
                        shows a slice of its source without saying so is a feed
                        that quietly lies about what is happening. */}
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                        <span>
                            Bahan konten dari pantauan berita pajak,{' '}
                            <span className="font-semibold text-foreground">
                                {feed.days > 0
                                    ? `${feed.days} hari terakhir`
                                    : 'seluruh arsip'}
                            </span>{' '}
                            dengan skor {feed.minScore}–10.
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {total}
                            </span>{' '}
                            berita
                            {/* Only once some have been used: while the two
                                figures are equal, printing both says the same
                                thing twice. */}
                            {unused > 0 && unused < total ? (
                                <>
                                    {' · '}
                                    <span data-numeric>{unused}</span> belum
                                    jadi ide
                                </>
                            ) : null}
                        </span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative min-w-0 flex-1 sm:max-w-80">
                        <Search
                            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <Input
                            value={query}
                            onChange={(event) => search(event.target.value)}
                            placeholder="Cari judul, ringkasan, sumber…"
                            className="pl-9"
                            aria-label="Cari berita"
                        />
                    </div>

                    <Select
                        value={filters.sumber}
                        onValueChange={(value) => go({ sumber: value })}
                    >
                        <SelectTrigger className="h-auto w-auto min-w-44 gap-2 rounded-md border-border bg-card px-3 py-2 text-[0.8438rem] font-bold shadow-lift">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="semua">Semua sumber</SelectItem>
                            {sources.map((source) => (
                                <SelectItem key={source.key} value={source.key}>
                                    {source.key} ({source.count})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* The page's own job, as a filter: what is left to use. */}
                    <button
                        type="button"
                        aria-pressed={filters.ide === 'belum'}
                        onClick={() =>
                            go({
                                ide:
                                    filters.ide === 'belum' ? 'semua' : 'belum',
                            })
                        }
                        className={cn(
                            'rounded-md border px-3 py-2 text-[0.8438rem] font-bold transition-colors',
                            filters.ide === 'belum'
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card text-secondary-foreground shadow-lift hover:border-primary/35 hover:text-primary-deep',
                        )}
                    >
                        Belum jadi ide
                    </button>

                    {narrowed ? (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                go({ ...DEFAULTS });
                            }}
                            className="rounded-md bg-primary-soft px-3 py-2 text-[0.8438rem] font-bold text-primary-deep transition-colors hover:bg-accent"
                        >
                            Bersihkan filter
                        </button>
                    ) : null}
                </div>

                {/* Each chip carries what choosing it would find, counted past
                    its own filter — so the row doubles as a reading of what
                    the archive is made of. */}
                {categories.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <CountChip
                            label="Semua kategori"
                            count={categories.reduce(
                                (sum, item) => sum + item.count,
                                0,
                            )}
                            active={filters.kategori === 'semua'}
                            onClick={() => go({ kategori: 'semua' })}
                        />
                        {categories.map((category) => (
                            <CountChip
                                key={category.key}
                                label={category.key}
                                count={category.count}
                                active={filters.kategori === category.key}
                                onClick={() => go({ kategori: category.key })}
                            />
                        ))}
                    </div>
                ) : null}

                {days.length === 0 ? (
                    <Empty narrowed={narrowed} feed={feed} />
                ) : (
                    <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-lift sm:p-5">
                        <ol className="flex flex-col gap-5">
                            {days.map((day) => (
                                <li key={day.key}>
                                    <h3 className="mb-1 flex items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                        <span
                                            className={cn(
                                                day.key === today &&
                                                    'text-primary-deep',
                                            )}
                                        >
                                            {dayLabel(day.key)}
                                        </span>
                                        {day.key === today ? (
                                            <span className="rounded-full bg-primary px-1.5 py-px text-[0.6875rem] font-extrabold text-primary-foreground">
                                                Hari ini
                                            </span>
                                        ) : null}
                                        <span
                                            className="h-px flex-1 bg-border"
                                            aria-hidden
                                        />
                                    </h3>

                                    <ul className="flex flex-col">
                                        {day.items.map((item) => (
                                            <li
                                                key={item.id}
                                                className="border-b border-border py-3.5 last:border-b-0 last:pb-1"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        {/* Who ran it, then what kind of story it
                                                            is. The score is stored but not shown:
                                                            everything here is a 9 or a 10, so
                                                            printing it would say nothing. */}
                                                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold text-secondary-foreground">
                                                                {item.source}
                                                            </span>
                                                            {item.category ? (
                                                                <span className="text-[0.6875rem] font-bold tracking-[0.04em] text-primary-deep uppercase">
                                                                    {
                                                                        item.category
                                                                    }
                                                                </span>
                                                            ) : null}
                                                        </p>
                                                        <p className="mt-1.5 text-[0.8438rem] leading-snug font-bold">
                                                            {item.url ? (
                                                                <a
                                                                    href={
                                                                        item.url
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                                                                >
                                                                    {item.title}
                                                                    <ExternalLink
                                                                        className="ml-1 inline size-3 align-baseline"
                                                                        strokeWidth={
                                                                            2
                                                                        }
                                                                        aria-hidden
                                                                    />
                                                                </a>
                                                            ) : (
                                                                item.title
                                                            )}
                                                        </p>
                                                        {item.summary ? (
                                                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                                                {item.summary}
                                                            </p>
                                                        ) : null}
                                                    </div>

                                                    <div className="shrink-0">
                                                        {item.ideaId ? (
                                                            <Link
                                                                href={ideasIndex()}
                                                                aria-label="Sudah jadi ide — buka Ide Konten"
                                                                className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1.5 text-xs font-bold text-primary-deep transition-colors hover:bg-accent"
                                                            >
                                                                <Check
                                                                    className="size-3.5"
                                                                    strokeWidth={
                                                                        2.5
                                                                    }
                                                                    aria-hidden
                                                                />
                                                                <span className="hidden sm:inline">
                                                                    Sudah jadi
                                                                    ide
                                                                </span>
                                                            </Link>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    save(item)
                                                                }
                                                                disabled={
                                                                    savingId ===
                                                                    item.id
                                                                }
                                                                aria-label={`Jadikan ide: ${item.title}`}
                                                            >
                                                                <Lightbulb
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    aria-hidden
                                                                />
                                                                <span className="hidden sm:inline">
                                                                    {savingId ===
                                                                    item.id
                                                                        ? 'Menyimpan…'
                                                                        : 'Jadikan ide'}
                                                                </span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                {page.prev || page.hasMore ? (
                    <div className="flex items-center justify-between gap-3 text-xs">
                        <p className="text-muted-foreground">
                            Menampilkan{' '}
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {page.shown}
                            </span>{' '}
                            dari <span data-numeric>{total}</span> berita
                        </p>
                        <div className="flex items-center gap-2">
                            <Step href={page.prev}>Lebih baru</Step>
                            <Step href={page.next}>Lebih lama</Step>
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );
}

function Step({
    href,
    children,
}: {
    href: string | null;
    children: React.ReactNode;
}) {
    if (!href) {
        return (
            <span className="rounded-md border border-border px-3 py-1.5 font-bold text-muted-foreground/50">
                {children}
            </span>
        );
    }

    return (
        <Link
            href={href}
            preserveScroll
            className="rounded-md border border-border bg-card px-3 py-1.5 font-bold text-secondary-foreground transition-colors hover:border-primary/35 hover:text-primary-deep"
        >
            {children}
        </Link>
    );
}

/**
 * Nothing to show, and the two reasons are not the same reason: a filter that
 * matched nothing is the reader's own doing and is undone in one press, while
 * an empty feed is a sync that has not run.
 */
function Empty({ narrowed, feed }: { narrowed: boolean; feed: Window }) {
    return (
        <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                    {narrowed ? (
                        <SlidersHorizontal
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    ) : (
                        <Newspaper
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    )}
                </span>
                <p className="text-sm font-bold">
                    {narrowed
                        ? 'Tidak ada berita yang cocok'
                        : 'Belum ada berita'}
                </p>
                <p className="max-w-[42ch] text-xs leading-relaxed text-balance text-muted-foreground">
                    {narrowed ? (
                        'Longgarkan salah satu filter, atau bersihkan semuanya.'
                    ) : (
                        <>
                            {feed.since
                                ? `Tidak ada yang lolos saringan sejak ${dayLabel(feed.since)}.`
                                : 'Belum ada berita yang tersimpan.'}{' '}
                            Jalankan{' '}
                            <code className="rounded bg-neutral-soft px-1 py-px font-mono text-[0.6875rem]">
                                php artisan news:sync
                            </code>{' '}
                            untuk menariknya.
                        </>
                    )}
                </p>
            </div>
        </section>
    );
}

ContentNewsPage.layout = {
    breadcrumbs: [
        { title: 'Konten', href: contentIndex() },
        { title: 'Berita Terbaru', href: newsIndex() },
    ],
};
