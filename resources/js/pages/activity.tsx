import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    History,
    Pencil,
    Plus,
    SlidersHorizontal,
    Trash2,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { activity as activityIndex } from '@/routes';

type Action = 'created' | 'updated' | 'deleted';

type Change = {
    label: string;
    from: string | null;
    to: string | null;
};

type Entry = {
    id: number;
    actor: string;
    initial: string;
    action: Action;
    actionLabel: string;
    type: string;
    label: string;
    url: string | null;
    changes: Change[];
    at: string;
    time: string;
};

type Day = {
    key: string;
    label: string;
    count: number;
    entries: Entry[];
};

type Filters = {
    siapa: string;
    jenis: string;
    aksi: string;
    periode: string;
};

type Props = {
    filters: Filters;
    days: Day[];
    summary: {
        total: number;
        created: number;
        updated: number;
        deleted: number;
        people: number;
    };
    actors: string[];
    types: { key: string; label: string; count: number }[];
    page: {
        shown: number;
        hasMore: boolean;
        next: string | null;
        prev: string | null;
    };
};

/** The stretches the page offers, in the order they narrow. */
const PERIODS = [
    { key: 'hari-ini', label: 'Hari ini' },
    { key: '7-hari', label: '7 hari' },
    { key: '30-hari', label: '30 hari' },
    { key: 'semua', label: 'Semua' },
];

/**
 * Each action gets its own mark and its own colour, and the colours are the
 * system's own: teal for something made, ink for something changed, and the
 * alarm red kept for the one action nobody can undo.
 */
const ACTIONS: Record<
    Action,
    { label: string; verb: string; icon: typeof Plus; tone: string }
> = {
    created: {
        label: 'Dibuat',
        verb: 'membuat',
        icon: Plus,
        tone: 'bg-primary-soft text-primary-deep',
    },
    updated: {
        label: 'Diubah',
        verb: 'mengubah',
        icon: Pencil,
        tone: 'bg-neutral-soft text-secondary-foreground',
    },
    deleted: {
        label: 'Dihapus',
        verb: 'menghapus',
        icon: Trash2,
        tone: 'bg-destructive-soft text-destructive',
    },
};

/** Only what differs from the default rides in the URL. */
const DEFAULTS: Filters = {
    siapa: 'semua',
    jenis: 'semua',
    aksi: 'semua',
    periode: '30-hari',
};

/**
 * The log of what the team did.
 *
 * Grouped by day and nothing else, because the question people bring here is
 * always anchored to a day: what happened today, what did I miss yesterday,
 * when did this lead change hands. A flat list answers that only if you
 * already know the answer.
 *
 * Every entry is one sentence — who, what they did, and to which record — and
 * an update carries the fields it moved underneath it, each one from and to.
 * That last part is what makes the log worth keeping: "Andre mengubah PT Bumi
 * Mandiri" is a receipt, while "Tahap: Proposal → Deal" is the thing you came
 * to find out.
 */
export default function ActivityPage({
    filters,
    days,
    summary,
    actors,
    types,
    page,
}: Props) {
    const go = (next: Partial<Filters>) => {
        const query = { ...filters, ...next };

        router.get(
            activityIndex.url({
                query: Object.fromEntries(
                    Object.entries(query).filter(
                        ([key, value]) =>
                            value !== DEFAULTS[key as keyof Filters],
                    ),
                ),
            }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const narrowed =
        filters.siapa !== 'semua' ||
        filters.jenis !== 'semua' ||
        filters.aksi !== 'semua';

    return (
        <>
            <Head title="Aktivitas" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                        Aktivitas
                    </h1>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                        <span>
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {summary.total}
                            </span>{' '}
                            perubahan
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {summary.people}
                            </span>{' '}
                            orang
                        </span>
                        <span aria-hidden>·</span>
                        <span data-numeric>
                            {summary.created} dibuat · {summary.updated} diubah
                            · {summary.deleted} dihapus
                        </span>
                    </p>
                </div>

                {/*
                    The stretch is a row of chips because it is the one filter
                    that is always on — there is no "no period" — while the
                    other three are pickers that start at "semua" and stay out
                    of the way until somebody has a question.
                */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex rounded-md border border-border bg-card p-1 shadow-lift">
                        {PERIODS.map((period) => (
                            <button
                                key={period.key}
                                type="button"
                                aria-pressed={period.key === filters.periode}
                                onClick={() => go({ periode: period.key })}
                                className={cn(
                                    'rounded-sm px-3 py-1.5 text-[0.8438rem] font-bold transition-colors',
                                    period.key === filters.periode
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-secondary-foreground hover:text-primary-deep',
                                )}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>

                    <Picker
                        value={filters.siapa}
                        onChange={(value) => go({ siapa: value })}
                        all="Semua orang"
                        options={actors.map((name) => ({
                            key: name,
                            label: name,
                        }))}
                    />

                    <Picker
                        value={filters.jenis}
                        onChange={(value) => go({ jenis: value })}
                        all="Semua jenis"
                        options={types.map((type) => ({
                            key: type.key,
                            label: `${type.label} (${type.count})`,
                        }))}
                    />

                    <Picker
                        value={filters.aksi}
                        onChange={(value) => go({ aksi: value })}
                        all="Semua aksi"
                        options={(Object.keys(ACTIONS) as Action[]).map(
                            (key) => ({ key, label: ACTIONS[key].label }),
                        )}
                    />

                    {narrowed ? (
                        <button
                            type="button"
                            onClick={() =>
                                go({
                                    siapa: 'semua',
                                    jenis: 'semua',
                                    aksi: 'semua',
                                })
                            }
                            className="rounded-md bg-primary-soft px-3 py-2 text-[0.8438rem] font-bold text-primary-deep transition-colors hover:bg-accent"
                        >
                            Bersihkan filter
                        </button>
                    ) : null}
                </div>

                {days.length === 0 ? (
                    <Empty narrowed={narrowed} />
                ) : (
                    <div className="flex flex-col gap-6">
                        {days.map((day) => (
                            <DayGroup key={day.key} day={day} />
                        ))}
                    </div>
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
                            perubahan
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

/** One day, and everything that happened in it. */
function DayGroup({ day }: { day: Day }) {
    return (
        <section>
            {/*
                The date sticks to the top of the window while its own entries
                scroll past. Fifty rows deep into a Tuesday, the one thing you
                stop being able to see is which day you are in.
            */}
            <div className="sticky top-0 z-10 -mx-4 bg-background/85 px-4 pt-1 pb-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
                <h2 className="flex items-baseline gap-2.5 text-[0.8438rem] font-extrabold tracking-[-0.01em]">
                    {day.label}
                    <span
                        className="text-xs font-semibold text-muted-foreground"
                        data-numeric
                    >
                        {day.count} perubahan
                    </span>
                    <span className="h-px flex-1 bg-border" aria-hidden />
                </h2>
            </div>

            <ol className="mt-1 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lift">
                {day.entries.map((entry) => (
                    <li
                        key={entry.id}
                        className="border-b border-border last:border-b-0"
                    >
                        <Row entry={entry} />
                    </li>
                ))}
            </ol>
        </section>
    );
}

/**
 * One thing that happened.
 *
 * The whole row is the link when there is somewhere to go, and plain text when
 * there is not — a deleted record has no page left, and a row that looks
 * pressable and then refuses is worse than one that never offered.
 */
function Row({ entry }: { entry: Entry }) {
    const action = ACTIONS[entry.action];
    const Icon = action.icon;

    const body = (
        <>
            <span
                className={cn(
                    'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md',
                    action.tone,
                )}
                aria-hidden
            >
                <Icon className="size-3.5" strokeWidth={2.5} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-1.5 text-[0.8438rem] leading-snug">
                    <span className="font-bold">{entry.actor}</span>
                    <span className="text-muted-foreground">{action.verb}</span>
                    <span className="rounded-full bg-neutral-soft px-2 py-px text-[0.6875rem] font-bold text-secondary-foreground">
                        {entry.type}
                    </span>
                    {/* Teal is what this app uses for somewhere you can go.
                        A deleted record has nowhere left, so its name is set
                        in ink — colouring it like a link and then refusing
                        the press is worse than never offering. */}
                    <span
                        className={cn(
                            'font-bold',
                            entry.url ? 'text-primary-deep' : 'text-foreground',
                        )}
                    >
                        {entry.label}
                    </span>
                </span>

                {entry.changes.length > 0 ? (
                    <span className="mt-1.5 flex flex-col gap-1">
                        {entry.changes.map((change) => (
                            <Diff key={change.label} change={change} />
                        ))}
                    </span>
                ) : null}
            </span>

            <span
                className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums"
                data-numeric
            >
                {entry.time}
            </span>
        </>
    );

    const className =
        'flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors sm:px-4';

    if (!entry.url) {
        return <div className={className}>{body}</div>;
    }

    return (
        <Link
            href={entry.url}
            className={cn(className, 'hover:bg-neutral-soft')}
        >
            {body}
        </Link>
    );
}

/**
 * One field that moved.
 *
 * An empty value is written as "kosong" rather than left blank: a field that
 * was cleared and a field the log has nothing to say about look identical
 * otherwise, and they are not the same event.
 */
function Diff({ change }: { change: Change }) {
    return (
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            <span className="font-semibold text-muted-foreground">
                {change.label}
            </span>
            <span
                className={cn(
                    'line-through',
                    change.from
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/70 italic no-underline',
                )}
            >
                {change.from ?? 'kosong'}
            </span>
            <ArrowRight
                className="size-3 shrink-0 text-muted-foreground"
                strokeWidth={2.5}
                aria-hidden
            />
            <span
                className={cn(
                    'font-bold',
                    change.to
                        ? 'text-foreground'
                        : 'text-muted-foreground italic',
                )}
            >
                {change.to ?? 'kosong'}
            </span>
        </span>
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

function Empty({ narrowed }: { narrowed: boolean }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-16 text-center shadow-lift">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                {narrowed ? (
                    <SlidersHorizontal
                        className="size-5"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                ) : (
                    <History
                        className="size-5"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                )}
            </span>
            <p className="text-sm font-bold">
                {narrowed
                    ? 'Tidak ada yang cocok dengan filter ini'
                    : 'Belum ada aktivitas di rentang ini'}
            </p>
            <p className="max-w-[46ch] text-xs leading-relaxed text-balance text-muted-foreground">
                {narrowed
                    ? 'Longgarkan salah satu filter, atau lebarkan rentang waktunya.'
                    : 'Setiap kali ada yang membuat, mengubah, atau menghapus lead, konten, ide, dan catatan, perubahannya tercatat di sini.'}
            </p>
        </div>
    );
}

/** One filter, always with its own "everything" as the resting choice. */
function Picker({
    value,
    onChange,
    all,
    options,
}: {
    value: string;
    onChange: (value: string) => void;
    all: string;
    options: { key: string; label: string }[];
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-auto w-auto min-w-36 gap-2 rounded-md border-border bg-card px-3 py-2 text-[0.8438rem] font-bold shadow-lift">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="semua">{all}</SelectItem>
                {options.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

ActivityPage.layout = {
    breadcrumbs: [{ title: 'Aktivitas', href: activityIndex() }],
};
