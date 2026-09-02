import { Heart, Instagram, MessageCircle, Pin, Play } from 'lucide-react';
import { FormatMark } from '@/components/performance/format-mark';
import { nf, rateFormat, shortDate } from '@/data/instagram';
import type { PostRow } from '@/data/instagram';

export type Sort = 'terbaru' | 'terlama' | 'interaksi' | 'pemutaran' | 'suka';

/** What the bars are measuring, given the order the list is in. */
type Measure = {
    /** The word the legend uses for it. */
    label: string;
    /** The comparable magnitude, for the bar. */
    value: number;
    /** The same thing in words, for the figure. */
    text: string;
};

/**
 * The bar measures whatever the list is ordered by.
 *
 * Sorting is otherwise an invisible act — the rows move and nothing says why.
 * Tying the bar to it makes the sort the axis of the whole page: order by
 * plays and the bars become plays. Ordering by date has no magnitude of its
 * own, so it falls back to the engagement rate, which is the only figure that
 * compares fairly across formats.
 */
function measureOf(row: PostRow, sort: Sort): Measure {
    if (sort === 'suka') {
        return { label: 'suka', value: row.likes, text: nf.format(row.likes) };
    }

    if (sort === 'pemutaran') {
        return {
            label: 'pemutaran',
            value: row.plays ?? 0,
            /* A photo has no plays. An em-dash says so; a nought would be a
               claim that nobody watched it. */
            text: row.plays === null ? '—' : nf.format(row.plays),
        };
    }

    if (sort === 'interaksi') {
        return {
            label: 'interaksi',
            value: row.interactions,
            text: nf.format(row.interactions),
        };
    }

    return {
        label: 'engagement rate',
        value: row.rate,
        text: `${rateFormat.format(row.rate)}%`,
    };
}

/**
 * Every post the account has published, as a run of measured strips.
 *
 * This was a seven-column table, and a table promises that every column is
 * populated and comparable. Neither held: only Reels carry plays, so two of
 * the seven columns were a run of em-dashes and noughts, and a Reel's 2.555
 * plays and a photo's 5 likes were never on one axis to begin with. Worse,
 * each piece was separated from its own numbers by the width of the screen.
 *
 * So each piece keeps its own numbers, and the one thing that does compare is
 * drawn as a length rather than printed as a digit — the same meter the
 * pipeline uses on the dashboard, scaled here to the strongest post on the
 * page. Sixty rows of that read as a shape: a few long bars, a long tail of
 * short ones, which is the finding this account has to face.
 *
 * One card, all widths. The measure sits beside the piece where there is room
 * and under it where there is not, and the card asks its own container which
 * it is — the list is as wide as the panel, not as the window.
 */
export function ContentList({
    rows,
    sort,
    onOpen,
}: {
    rows: PostRow[];
    sort: Sort;
    onOpen: (code: string) => void;
}) {
    const measures = rows.map((row) => measureOf(row, sort));
    const widest = Math.max(...measures.map((measure) => measure.value), 0);
    const legend = measures[0]?.label ?? 'engagement rate';

    return (
        <div className="@container/list">
            <p className="border-b border-border py-3 text-xs leading-relaxed text-muted-foreground">
                Panjang batang ={' '}
                <span className="font-bold text-secondary-foreground">
                    {legend}
                </span>{' '}
                tiap konten, dibanding yang tertinggi di halaman ini. Ubah
                urutan untuk mengukur yang lain.
            </p>

            <ul className="flex flex-col">
                {rows.map((row, index) => {
                    const measure = measures[index];
                    /* A floor, so a post that earned something never draws as
                       a post that earned nothing. */
                    const share =
                        widest > 0 && measure.value > 0
                            ? Math.max((measure.value / widest) * 100, 2)
                            : 0;

                    return (
                        <li key={row.shortCode}>
                            <button
                                type="button"
                                onClick={() => onOpen(row.shortCode)}
                                className="group/post -mx-2 grid w-[calc(100%+1rem)] gap-x-6 gap-y-3 rounded-md border-b border-border px-2 py-3.5 text-left transition-colors hover:bg-neutral-soft @2xl/list:grid-cols-[minmax(0,1fr)_minmax(13rem,19rem)] @2xl/list:items-center"
                            >
                                {/* The piece: what it was, and what it said. */}
                                <span className="flex min-w-0 items-start gap-3">
                                    <Thumb row={row} />

                                    {/* Capped at a reading measure: a caption
                                        run edge to edge across a wide screen
                                        is a line nobody finishes. */}
                                    <span className="min-w-0 flex-1 @2xl/list:max-w-[64ch]">
                                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <FormatMark
                                                format={row.format}
                                                slides={row.slides}
                                            />
                                            <span
                                                className="text-xs text-muted-foreground"
                                                data-numeric
                                            >
                                                {shortDate(row.postedAt)}
                                            </span>
                                            {row.pinned ? (
                                                <span
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary-deep"
                                                    title="Disematkan di profil"
                                                >
                                                    <Pin
                                                        className="size-3"
                                                        strokeWidth={2.5}
                                                        aria-hidden
                                                    />
                                                    Disematkan
                                                </span>
                                            ) : null}
                                        </span>

                                        <span className="mt-1 line-clamp-2 text-[0.8438rem] leading-snug font-bold transition-colors group-hover/post:text-primary-deep">
                                            {row.caption ?? 'Tanpa keterangan'}
                                        </span>

                                        {row.hashtags.length > 0 ? (
                                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                                                {row.hashtags
                                                    .map((tag) => `#${tag}`)
                                                    .join(' ')}
                                            </span>
                                        ) : null}
                                    </span>
                                </span>

                                {/* The measure: the figure, its length, and the
                                    counts it was made of. */}
                                <span className="flex min-w-0 flex-col gap-2 pl-[4.25rem] @2xl/list:pl-0">
                                    <span
                                        className="text-lg leading-none font-extrabold tracking-[-0.025em]"
                                        data-numeric
                                    >
                                        {measure.text}
                                    </span>

                                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-soft">
                                        <span
                                            className="animate-draw-across block h-full rounded-full bg-primary transition-colors group-hover/post:bg-primary-bright"
                                            style={{
                                                width: `${share}%`,
                                                animationDelay: `${Math.min(index, 9) * 40}ms`,
                                            }}
                                        />
                                    </span>

                                    <Counts row={row} sort={sort} />
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/**
 * The raw counts, minus whatever the figure above already said.
 *
 * Repeating the measure beside itself is how a table ends up with seven
 * columns; a post with no plays simply has no play count rather than a dash
 * holding a column open.
 */
function Counts({ row, sort }: { row: PostRow; sort: Sort }) {
    const counts = [
        ...(sort === 'suka'
            ? []
            : [{ icon: Heart, value: row.likes, label: 'suka' }]),
        { icon: MessageCircle, value: row.comments, label: 'komentar' },
        ...(row.plays !== null && sort !== 'pemutaran'
            ? [{ icon: Play, value: row.plays, label: 'pemutaran' }]
            : []),
    ];

    return (
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {counts.map((count) => (
                <span
                    key={count.label}
                    className="inline-flex items-center gap-1 font-semibold"
                >
                    <count.icon
                        className="size-3 shrink-0"
                        strokeWidth={2.5}
                        aria-hidden
                    />
                    <span data-numeric>{nf.format(count.value)}</span>
                    <span className="sr-only">{count.label}</span>
                </span>
            ))}
        </span>
    );
}

function Thumb({ row }: { row: PostRow }) {
    if (!row.thumbnail) {
        return (
            <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-neutral-soft text-muted-foreground">
                <Instagram className="size-4" strokeWidth={2} aria-hidden />
            </span>
        );
    }

    return (
        <img
            src={row.thumbnail}
            alt=""
            loading="lazy"
            className="size-14 shrink-0 rounded-lg border border-border object-cover"
        />
    );
}
