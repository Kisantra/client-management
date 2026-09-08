import { Heart, Instagram, MessageCircle, Pin, Play } from 'lucide-react';
import { FormatMark } from '@/components/performance/format-mark';
import { nf, shortDate } from '@/data/instagram';
import type { PostRow } from '@/data/instagram';

export type Sort = 'terbaru' | 'terlama' | 'interaksi' | 'pemutaran' | 'suka';

/**
 * Every post the account has published, each with the counts it earned.
 *
 * This was a seven-column table, and a table promises that every column is
 * populated and comparable. Neither held: only Reels carry plays, so two of
 * the seven columns were a run of em-dashes and noughts, and a Reel's 2.555
 * plays and a photo's 5 likes were never on one axis to begin with. Worse,
 * each piece was separated from its own numbers by the width of the screen.
 *
 * What each row shows now is what the platform itself counted — likes,
 * comments, plays — and nothing derived. Two things were taken out on the way
 * here and both for the same reason. A bar, scaled to the strongest post on
 * whatever page you happened to be on: a denominator nobody could see, moving
 * under the reader every time the page or the sort changed. Then the
 * engagement rate the bar had been drawing, a figure whose own denominator is
 * a follower count the row never states, printed to two decimals as though
 * 0,05 and 0,04 were a finding. Sixty rows of that is arithmetic nobody asked
 * for standing in front of three numbers anybody can read.
 *
 * One card, all widths. The counts sit beside the piece where there is room
 * and under it where there is not, and the card asks its own container which
 * it is — the list is as wide as the panel, not as the window.
 */
export function ContentList({
    rows,
    onOpen,
}: {
    rows: PostRow[];
    onOpen: (code: string) => void;
}) {
    return (
        <div className="@container/list">
            <ul className="flex flex-col">
                {rows.map((row) => {
                    return (
                        <li key={row.shortCode}>
                            <button
                                type="button"
                                onClick={() => onOpen(row.shortCode)}
                                className="group/post -mx-2 grid w-[calc(100%+1rem)] gap-x-6 gap-y-3 rounded-md border-b border-border px-2 py-3.5 text-left transition-colors hover:bg-neutral-soft @2xl/list:grid-cols-[minmax(0,1fr)_minmax(9rem,13rem)] @2xl/list:items-center"
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

                                {/* The measure: the figure, and the counts it
                                    was made of. */}
                                <span className="flex min-w-0 flex-col gap-1.5 pl-[4.25rem] @2xl/list:pl-0">
                                    <Counts row={row} />
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
 * What the platform counted, and only that.
 *
 * These used to be a footnote under a derived figure and they are the measure
 * now, so they are set as figures: the number in the row's own ink at reading
 * size, the icon left quiet beside it. The icon carries the meaning for anyone
 * who can see it and the label is there in full for anyone who cannot.
 *
 * A post with no plays simply has no play count. A nought would be a claim
 * that nobody watched it, and a dash would be a column held open for a number
 * that was never going to come — a photo has no plays to report.
 */
function Counts({ row }: { row: PostRow }) {
    const counts = [
        { icon: Heart, value: row.likes, label: 'suka' },
        { icon: MessageCircle, value: row.comments, label: 'komentar' },
        ...(row.plays !== null
            ? [{ icon: Play, value: row.plays, label: 'pemutaran' }]
            : []),
    ];

    return (
        <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8438rem]">
            {counts.map((count) => (
                <span
                    key={count.label}
                    className="inline-flex items-center gap-1.5"
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
