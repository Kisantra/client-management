import { Head, Link, router } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileText,
    Lightbulb,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { dayLabel } from '@/data/content';
import { cn } from '@/lib/utils';
import { content as contentIndex } from '@/routes';
import { brief as briefRoute, ideas as ideasIndex } from '@/routes/content';
import { idea as takeIdea } from '@/routes/content/brief';

/*
 | THESIS: The brief is not a document to read, it is the nine o'clock running
 | order — what the day is about, then the work you can pick up from it. It
 | refuses the markdown-in-a-box that renders 2,000 characters of asterisks and
 | emoji headings and calls it a feature.
 | OWN-WORLD: Lembut, unchanged. Cool paper, white panels, hairline rules, one
 | Deep Teal mass carrying the day's three topics as the page's centre of
 | gravity; every idea is a hairline-ruled row in one panel, never a card grid.
 | STORY: A writer opens this at nine, reads three lines to know what today is,
 | takes one or two ideas onto the backlog, and closes it inside a minute.
 | FIRST VIEWPORT: Title and the brief's own date with a step-back control at
 | the top right. Below it the teal band, three numbered topics. Below that the
 | ideas as a run of ruled rows, each with its source and its take button on
 | the right. The archive is at the foot, never competing.
 | FORM: "Rapat Pagi", index 4 of seven structures; surface seed key 5ff97307.
 | FINISH: unreviewed and undocumented is unfinished; this build ends with the
 | finish review, the verdict, DESIGN.md, and every shipping raster carrying
 | its provenance.
 */

type Topic = { title: string; body: string | null; url: string | null };

type Idea = {
    id: number;
    title: string;
    body: string | null;
    url: string | null;
    ideaId: number | null;
};

type Extra = { heading: string; items: Topic[] };

type Brief = {
    id: number;
    publishedAt: string;
    lead: string | null;
    topics: Topic[];
    ideas: Idea[];
    extras: Extra[];
};

type ArchiveRow = {
    id: number;
    publishedAt: string;
    lead: string | null;
    ideas: number;
};

type Props = {
    brief: Brief | null;
    archive: ArchiveRow[];
};

/** "2026-09-03 08:10:00" — the day and the hour, kept apart. */
const dayOf = (stamp: string) => stamp.slice(0, 10);
const hourOf = (stamp: string) => stamp.slice(11, 16).replace(':', '.');

/** The publisher, not the address: "investor.id" rather than 90 characters. */
function host(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return 'sumber';
    }
}

const monthLabel = (day: string) =>
    `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;

const MONTHS = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];

export default function ContentBriefPage({ brief, archive }: Props) {
    const [takingId, setTakingId] = useState<number | null>(null);

    const take = (idea: Idea) =>
        router.post(
            takeIdea(idea.id).url,
            {},
            {
                preserveScroll: true,
                onStart: () => setTakingId(idea.id),
                onFinish: () => setTakingId(null),
            },
        );

    const at = archive.findIndex((row) => row.id === brief?.id);
    const newer = at > 0 ? archive[at - 1] : null;
    const older = at >= 0 && at < archive.length - 1 ? archive[at + 1] : null;

    const days = new Set(archive.map((row) => dayOf(row.publishedAt))).size;
    const untaken =
        brief?.ideas.filter((idea) => idea.ideaId === null).length ?? 0;

    return (
        <>
            <Head title="Brief Harian" />

            <div className="animate-settle flex flex-1 flex-col gap-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Brief Harian
                        </h1>
                        <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
                            Ringkasan pagi dari pantauan berita pajak: apa isu
                            hari ini, dan apa yang bisa dibuat darinya.
                        </p>
                    </div>

                    {brief ? (
                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                            <Step to={newer} label="Brief lebih baru">
                                <ChevronLeft strokeWidth={2.25} aria-hidden />
                            </Step>
                            <span className="px-1 text-center">
                                <span
                                    className="block text-[0.8438rem] leading-tight font-extrabold"
                                    data-numeric
                                >
                                    {dayLabel(dayOf(brief.publishedAt))}
                                </span>
                                <span
                                    className="block text-[0.6875rem] leading-tight text-muted-foreground"
                                    data-numeric
                                >
                                    {hourOf(brief.publishedAt)}
                                </span>
                            </span>
                            <Step to={older} label="Brief sebelumnya">
                                <ChevronRight strokeWidth={2.25} aria-hidden />
                            </Step>
                        </div>
                    ) : null}
                </div>

                {brief === null ? (
                    <Empty />
                ) : (
                    <>
                        <Topics topics={brief.topics} />

                        <Ideas
                            ideas={brief.ideas}
                            untaken={untaken}
                            extras={brief.extras.length}
                            onTake={take}
                            takingId={takingId}
                        />

                        {brief.extras.length > 0 ? (
                            <Extras extras={brief.extras} />
                        ) : null}
                    </>
                )}

                <Archive rows={archive} days={days} currentId={brief?.id} />
            </div>
        </>
    );
}

/** A step through the archive; a missing neighbour is a dead control, not a link. */
function Step({
    to,
    label,
    children,
}: {
    to: ArchiveRow | null;
    label: string;
    children: React.ReactNode;
}) {
    const shell =
        'grid size-8 place-items-center rounded-md [&>svg]:size-4 transition-colors';

    if (!to) {
        return (
            <span className={cn(shell, 'text-muted-foreground/40')} aria-hidden>
                {children}
            </span>
        );
    }

    return (
        <Link
            href={briefRoute(to.id)}
            prefetch
            aria-label={label}
            title={label}
            className={cn(
                shell,
                'bg-neutral-soft text-secondary-foreground hover:bg-accent hover:text-primary-deep',
            )}
        >
            {children}
        </Link>
    );
}

/**
 * The day's three topics, and the loudest mass on the page.
 *
 * Solid Deep Teal rather than the anchor tile's gradient: the system allows
 * one gradient and the dashboard owns it. Secondary text is Teal Tint rather
 * than a grey, so it stays tinted from the surface it sits on (4.6:1).
 */
function Topics({ topics }: { topics: Topic[] }) {
    if (topics.length === 0) {
        return (
            <section className="rounded-xl border border-border bg-card px-5 py-4 shadow-lift">
                <p className="text-[0.8438rem] font-bold">
                    Brief ini tidak memuat topik
                </p>
                <p className="mt-1 max-w-[52ch] text-xs leading-relaxed text-muted-foreground">
                    Pipeline pagi itu hanya menghasilkan daftar headline. Itu
                    run yang gagal, bukan hari yang sepi — isinya ada di bagian
                    bawah halaman ini.
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-xl border border-transparent bg-primary px-5 py-5 text-primary-foreground shadow-teal sm:px-6">
            <h2 className="text-[0.6875rem] font-bold tracking-[0.1em] text-primary-soft uppercase">
                Hari ini tentang
            </h2>

            <ol className="mt-3 flex flex-col gap-3">
                {topics.map((topic, index) => (
                    <li key={topic.title} className="flex gap-3">
                        <span
                            className="mt-px grid size-6 shrink-0 place-items-center rounded-md bg-white/25 text-[0.75rem] font-extrabold"
                            data-numeric
                            aria-hidden
                        >
                            {index + 1}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-base leading-snug font-extrabold tracking-[-0.02em] text-balance">
                                {topic.title}
                            </span>
                            {topic.body ? (
                                <span className="mt-0.5 block max-w-[74ch] text-sm leading-relaxed text-primary-soft">
                                    {topic.body}
                                </span>
                            ) : null}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

/** The running order: one panel of ruled rows, never a grid of cards. */
function Ideas({
    ideas,
    untaken,
    extras,
    onTake,
    takingId,
}: {
    ideas: Idea[];
    untaken: number;
    extras: number;
    onTake: (idea: Idea) => void;
    takingId: number | null;
}) {
    return (
        <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-3.5">
                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                    Ide konten
                </h2>
                {ideas.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                        <span
                            className="font-bold text-foreground"
                            data-numeric
                        >
                            {ideas.length}
                        </span>{' '}
                        ide · <span data-numeric>{untaken}</span> belum diambil
                    </p>
                ) : null}
            </header>

            {ideas.length === 0 ? (
                <p className="mx-auto max-w-[46ch] px-5 py-8 text-center text-xs leading-relaxed text-muted-foreground">
                    Brief ini tidak mengusulkan ide konten
                    {extras > 0
                        ? ' — bagian lain di bawah yang membawa isinya.'
                        : '.'}
                </p>
            ) : (
                <ul className="flex flex-col">
                    {ideas.map((idea) => (
                        <li
                            key={idea.id}
                            className="border-b border-border px-5 py-4 last:border-b-0"
                        >
                            <div className="flex items-start gap-4">
                                <div className="min-w-0 flex-1">
                                    <p className="text-base leading-snug font-extrabold tracking-[-0.02em] text-balance">
                                        {idea.title}
                                    </p>
                                    {idea.body ? (
                                        <p className="mt-1.5 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
                                            {idea.body}
                                        </p>
                                    ) : null}
                                    {idea.url ? (
                                        <a
                                            href={idea.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                                        >
                                            {host(idea.url)}
                                            <ExternalLink
                                                className="size-3"
                                                strokeWidth={2}
                                                aria-hidden
                                            />
                                        </a>
                                    ) : null}
                                </div>

                                <div className="shrink-0">
                                    {idea.ideaId ? (
                                        <Link
                                            href={ideasIndex()}
                                            aria-label="Sudah diambil — buka Ide Konten"
                                            className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1.5 text-xs font-bold text-primary-deep transition-colors hover:bg-accent"
                                        >
                                            <Check
                                                className="size-3.5"
                                                strokeWidth={2.5}
                                                aria-hidden
                                            />
                                            <span className="hidden sm:inline">
                                                Sudah diambil
                                            </span>
                                        </Link>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onTake(idea)}
                                            disabled={takingId === idea.id}
                                            aria-label={`Jadikan ide: ${idea.title}`}
                                        >
                                            <Lightbulb
                                                strokeWidth={2}
                                                aria-hidden
                                            />
                                            <span className="hidden sm:inline">
                                                {takingId === idea.id
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
            )}
        </section>
    );
}

/**
 * What the older templates carried and the newer one dropped: Quick Win,
 * Sudut Unik, Top Headlines. Folded shut, because on most mornings there is
 * nothing here — but never discarded, because on 33 of them there is.
 */
function Extras({ extras }: { extras: Extra[] }) {
    const count = extras.reduce((sum, block) => sum + block.items.length, 0);

    return (
        <Collapsible className="group/extras min-w-0 rounded-xl border border-border bg-card shadow-lift">
            <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left">
                <span className="text-[0.8438rem] font-bold">
                    Bagian lain brief ini
                </span>
                <span className="text-xs text-muted-foreground">
                    {extras.map((block) => block.heading).join(' · ')} ·{' '}
                    <span data-numeric>{count}</span> butir
                </span>
                <ChevronDown
                    className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/extras:rotate-180"
                    strokeWidth={2}
                    aria-hidden
                />
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="flex flex-col gap-5 border-t border-border px-5 py-4">
                    {extras.map((block) => (
                        <div key={block.heading}>
                            <h3 className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                {block.heading}
                            </h3>
                            <ul className="mt-2 flex flex-col gap-2.5">
                                {block.items.map((item, index) => (
                                    <li
                                        key={`${block.heading}-${index}`}
                                        className="min-w-0"
                                    >
                                        <p className="text-[0.8438rem] leading-snug font-bold text-balance">
                                            {item.url ? (
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                                                >
                                                    {item.title}
                                                    <ExternalLink
                                                        className="ml-1 inline size-3 align-baseline"
                                                        strokeWidth={2}
                                                        aria-hidden
                                                    />
                                                </a>
                                            ) : (
                                                item.title
                                            )}
                                        </p>
                                        {item.body ? (
                                            <p className="mt-0.5 max-w-[72ch] text-xs leading-relaxed text-muted-foreground">
                                                {item.body}
                                            </p>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

/**
 * The archive at the foot, never competing with the brief above it.
 *
 * Each row carries the day's leading topic: a column of dates is unscannable,
 * and the topic is what somebody is actually looking for. Twelve mornings in
 * the sheet produced two briefs, so the hour rides along where a day holds
 * more than one.
 */
function Archive({
    rows,
    days,
    currentId,
}: {
    rows: ArchiveRow[];
    days: number;
    currentId?: number;
}) {
    const perDay = new Map<string, number>();
    /* Which rows open a month, worked out before the render rather than by
       mutating a cursor inside it. */
    const opensMonth = new Set<number>();
    let month = '';

    for (const row of rows) {
        const day = dayOf(row.publishedAt);
        perDay.set(day, (perDay.get(day) ?? 0) + 1);

        const label = monthLabel(day);

        if (label !== month) {
            opensMonth.add(row.id);
            month = label;
        }
    }

    return (
        <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-3.5">
                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                    Arsip brief
                </h2>
                <p className="text-xs text-muted-foreground">
                    <span className="font-bold text-foreground" data-numeric>
                        {rows.length}
                    </span>{' '}
                    brief dari <span data-numeric>{days}</span> hari
                </p>
            </header>

            <ol className="max-h-[24rem] overflow-y-auto">
                {rows.map((row) => {
                    const day = dayOf(row.publishedAt);
                    const current = row.id === currentId;

                    return (
                        <li key={row.id}>
                            {opensMonth.has(row.id) ? (
                                <p className="border-b border-border bg-neutral-soft px-5 py-1.5 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                    {monthLabel(day)}
                                </p>
                            ) : null}

                            <Link
                                href={briefRoute(row.id)}
                                prefetch
                                aria-current={current ? 'page' : undefined}
                                className={cn(
                                    'flex items-baseline gap-3 border-b border-border px-5 py-2.5 transition-colors',
                                    current
                                        ? 'bg-accent'
                                        : 'hover:bg-neutral-soft',
                                )}
                            >
                                <span
                                    className={cn(
                                        'w-[6.5rem] shrink-0 text-xs font-bold whitespace-nowrap',
                                        current
                                            ? 'text-primary-deep'
                                            : 'text-secondary-foreground',
                                    )}
                                    data-numeric
                                >
                                    {dayLabel(day)}
                                    {(perDay.get(day) ?? 0) > 1 ? (
                                        <span className="ml-1 font-medium text-muted-foreground">
                                            {hourOf(row.publishedAt)}
                                        </span>
                                    ) : null}
                                </span>

                                <span
                                    className={cn(
                                        'min-w-0 flex-1 truncate text-[0.8438rem]',
                                        current
                                            ? 'font-bold text-primary-deep'
                                            : 'text-foreground',
                                    )}
                                >
                                    {row.lead ?? 'Tanpa topik'}
                                </span>

                                <span
                                    className="shrink-0 text-xs text-muted-foreground"
                                    data-numeric
                                >
                                    {row.ideas}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

function Empty() {
    return (
        <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                    <FileText
                        className="size-5"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                </span>
                <p className="text-sm font-bold">Belum ada brief tersimpan</p>
                <p className="max-w-[42ch] text-xs leading-relaxed text-muted-foreground">
                    Jalankan{' '}
                    <code className="rounded bg-neutral-soft px-1 py-px font-mono text-[0.6875rem]">
                        php artisan news:sync
                    </code>{' '}
                    untuk menarik brief dari sheet tim.
                </p>
            </div>
        </section>
    );
}

ContentBriefPage.layout = {
    breadcrumbs: [
        { title: 'Konten', href: contentIndex() },
        { title: 'Brief Harian', href: briefRoute() },
    ],
};
