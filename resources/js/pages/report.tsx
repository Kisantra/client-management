import { Head, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { report as reportIndex } from '@/routes';
import { exportMethod as reportExport } from '@/routes/report';

type Period = {
    kind: 'bulan' | 'minggu';
    label: string;
    start: string;
    end: string;
    slug: string;
    /** True while the period has not finished, so figures are still partial. */
    open: boolean;
};

type Figure = {
    key: string;
    label: string;
    value: number;
    /** The same figure over the period immediately before this one. */
    was: number;
    note: string;
};

type ChannelRow = {
    key: string;
    label: string;
    planned: number;
    published: number;
    late: number;
};

type Props = {
    period: Period;
    previous: Period;
    steps: { back: string; forward: string | null };
    summary: Figure[];
    channels: ChannelRow[];
    owners: {
        name: string;
        planned: number;
        published: number;
        late: number;
    }[];
    sources: {
        key: string;
        label: string;
        leads: number;
        value: number;
        clients: number;
    }[];
    earning: {
        title: string;
        channels: string[];
        leads: number;
        clients: number;
    }[];
    generatedAt: string;
};

const nf = new Intl.NumberFormat('id-ID');

/** Rupiah at report scale: 47.500.000 reads as 47,5 jt. */
function money(value: number): string {
    if (value === 0) {
        return '—';
    }

    if (value >= 1_000_000_000) {
        return `Rp ${nf.format(Math.round((value / 1_000_000_000) * 10) / 10)} M`;
    }

    return `Rp ${nf.format(Math.round(value / 1_000_000))} jt`;
}

/**
 * The month, or the week, written up.
 *
 * Built to be printed as much as read. The thing a team is actually asked for
 * is a PDF, and the browser already makes one, so the page carries a print
 * stylesheet rather than the app carrying a PDF library — which also means the
 * printed sheet and the screen can never disagree.
 *
 * Every figure is set beside the same figure over the period before it. A
 * count on its own says what happened; a count next to the one before it says
 * whether that is normal, which is the question a report exists to answer.
 */
export default function ReportPage({
    period,
    previous,
    steps,
    summary,
    channels,
    owners,
    sources,
    earning,
    generatedAt,
}: Props) {
    const go = (next: { periode?: string; pada?: string }) =>
        router.get(
            reportIndex.url({
                query: {
                    periode: next.periode ?? period.kind,
                    pada: next.pada ?? period.start,
                },
            }),
            {},
            { preserveState: true, preserveScroll: true },
        );

    return (
        <>
            <Head title={`Laporan ${period.label}`} />

            {/*
                The one place in the app with print rules of its own. The rail,
                the header and every control are struck out on paper — nobody
                needs a sidebar in a PDF — and the tables are told not to break
                a row across two pages.
            */}
            <style>{`
                @media print {
                    /* The rail, the app's own header bar, and every control on
                       this page. Nobody needs a search box in a PDF. */
                    [data-slot="sidebar"],
                    [data-print="hide"] { display: none !important; }
                    [data-print="sheet"] { padding: 0 !important; }
                    main, [data-slot="sidebar-inset"] {
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: 0 !important;
                    }
                    table { break-inside: auto; }
                    tr, section { break-inside: avoid; }
                    thead { display: table-header-group; }
                }
            `}</style>

            <div
                data-print="sheet"
                className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6"
            >
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Laporan {period.label}
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                Dibandingkan dengan{' '}
                                <span className="font-semibold text-foreground">
                                    {previous.label}
                                </span>
                            </span>
                            <span aria-hidden>·</span>
                            <span data-numeric>Dicetak {generatedAt}</span>
                            {/* A period still running has not finished
                                counting, and a partial figure read as a final
                                one is the whole report gone wrong. */}
                            {period.open ? (
                                <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-[0.6875rem] font-bold text-destructive uppercase">
                                    Belum selesai
                                </span>
                            ) : null}
                        </p>
                    </div>

                    <div
                        data-print="hide"
                        className="flex flex-wrap items-center gap-2.5"
                    >
                        <div className="flex rounded-md border border-border bg-card p-1 shadow-lift">
                            {(['bulan', 'minggu'] as const).map((kind) => (
                                <button
                                    key={kind}
                                    type="button"
                                    aria-pressed={period.kind === kind}
                                    onClick={() => go({ periode: kind })}
                                    className={cn(
                                        'rounded-sm px-3 py-1.5 text-[0.8438rem] font-bold capitalize transition-colors',
                                        period.kind === kind
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-secondary-foreground hover:text-primary-deep',
                                    )}
                                >
                                    {kind === 'bulan' ? 'Bulanan' : 'Mingguan'}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center rounded-md border border-border bg-card shadow-lift">
                            <button
                                type="button"
                                onClick={() => go({ pada: steps.back })}
                                title="Periode sebelumnya"
                                className="grid size-9 place-items-center rounded-l-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                            >
                                <ChevronLeft
                                    className="size-4"
                                    strokeWidth={2}
                                    aria-hidden
                                />
                                <span className="sr-only">
                                    Periode sebelumnya
                                </span>
                            </button>
                            <button
                                type="button"
                                disabled={steps.forward === null}
                                onClick={() =>
                                    steps.forward && go({ pada: steps.forward })
                                }
                                title="Periode berikutnya"
                                className="grid size-9 place-items-center rounded-r-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                            >
                                <ChevronRight
                                    className="size-4"
                                    strokeWidth={2}
                                    aria-hidden
                                />
                                <span className="sr-only">
                                    Periode berikutnya
                                </span>
                            </button>
                        </div>

                        {(['konten', 'lead'] as const).map((part) => (
                            <a
                                key={part}
                                href={reportExport.url(part, {
                                    query: {
                                        periode: period.kind,
                                        pada: period.start,
                                    },
                                })}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[0.8438rem] font-bold text-secondary-foreground shadow-lift transition-colors hover:border-primary/35 hover:text-primary-deep"
                            >
                                <Download
                                    className="size-4"
                                    strokeWidth={2}
                                    aria-hidden
                                />
                                CSV {part}
                            </a>
                        ))}

                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[0.8438rem] font-bold text-primary-foreground shadow-teal transition-colors hover:bg-primary-deep"
                        >
                            <Printer
                                className="size-4"
                                strokeWidth={2}
                                aria-hidden
                            />
                            Cetak / PDF
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {summary.map((figure) => (
                        <Stat key={figure.key} figure={figure} />
                    ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <Table
                        title="Konten per channel"
                        note="Satu konten di dua channel dihitung di keduanya: dibuat sekali, tayang dua kali."
                        head={['Channel', 'Dijadwalkan', 'Tayang', 'Telat']}
                        rows={channels.map((row) => [
                            row.label,
                            nf.format(row.planned),
                            nf.format(row.published),
                            row.late > 0 ? nf.format(row.late) : '—',
                        ])}
                        alarm={channels.map((row) => row.late > 0)}
                    />

                    <Table
                        title="Konten per penanggung jawab"
                        note="Dihitung dari tanggal tayang yang dijadwalkan pada periode ini."
                        head={['Nama', 'Dijadwalkan', 'Tayang', 'Telat']}
                        rows={owners.map((row) => [
                            row.name,
                            nf.format(row.planned),
                            nf.format(row.published),
                            row.late > 0 ? nf.format(row.late) : '—',
                        ])}
                        alarm={owners.map((row) => row.late > 0)}
                    />

                    <Table
                        title="Lead per channel"
                        note="Lead yang masuk pada periode ini. “Kini client” dihitung per hari ini, bukan per periode — beda dari kartu Jadi client di atas."
                        head={['Channel', 'Lead', 'Estimasi', 'Kini client']}
                        rows={sources.map((row) => [
                            row.label,
                            nf.format(row.leads),
                            money(row.value),
                            row.clients > 0 ? nf.format(row.clients) : '—',
                        ])}
                    />

                    {/* The one table that answers what the whole app is built
                        around, and it is read from the lead's own content_id
                        rather than guessed at. */}
                    <Table
                        title="Konten yang menghasilkan lead"
                        note="Ditautkan dari lead-nya sendiri, bukan dugaan. Hitungannya sama dengan tabel di sebelah."
                        head={['Konten', 'Lead', 'Kini client']}
                        rows={earning.map((row) => [
                            row.title,
                            nf.format(row.leads),
                            row.clients > 0 ? nf.format(row.clients) : '—',
                        ])}
                        empty="Belum ada lead pada periode ini yang tertaut ke konten."
                    />
                </div>
            </div>
        </>
    );
}

/** One headline figure, and the same figure last time. */
function Stat({ figure }: { figure: Figure }) {
    const delta = figure.value - figure.was;

    /* Fewer late pieces is the good direction; for everything else it is more.
       A report that colours every fall red would be lying about half of it. */
    const better = figure.key === 'late' ? delta < 0 : delta > 0;

    return (
        <section className="rounded-xl border border-border bg-card p-4 shadow-lift">
            <p className="text-[0.8438rem] font-bold text-secondary-foreground">
                {figure.label}
            </p>
            <p
                className="mt-1.5 text-3xl leading-none font-extrabold tracking-[-0.03em]"
                data-numeric
            >
                {nf.format(figure.value)}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-xs">
                {delta === 0 ? (
                    <span className="text-muted-foreground">
                        Sama dengan periode sebelumnya
                    </span>
                ) : (
                    <>
                        <span
                            className={cn(
                                'font-bold',
                                better
                                    ? 'text-primary-deep'
                                    : 'text-destructive',
                            )}
                            data-numeric
                        >
                            {delta > 0 ? '+' : '−'}
                            {nf.format(Math.abs(delta))}
                        </span>
                        <span className="text-muted-foreground">
                            dari{' '}
                            <span data-numeric>{nf.format(figure.was)}</span>
                        </span>
                    </>
                )}
            </p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
                {figure.note}
            </p>
        </section>
    );
}

/**
 * One table, and the sentence that says how to read it.
 *
 * A report table without a note under its title is a table the reader has to
 * guess the rules of — whether a piece on two channels counts twice, whether
 * "jadi client" means within the period or as of today. Guessing is how a
 * figure gets quoted wrongly in a meeting.
 */
function Table({
    title,
    note,
    head,
    rows,
    alarm,
    empty = 'Tidak ada data pada periode ini.',
}: {
    title: string;
    note: string;
    head: string[];
    rows: string[][];
    /** Which rows carry something late, so the figure reads in the alarm tone. */
    alarm?: boolean[];
    empty?: string;
}) {
    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-lift sm:p-5">
            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                {title}
            </h2>
            <p className="mt-1 mb-3 text-xs leading-relaxed text-muted-foreground">
                {note}
            </p>

            {rows.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                    {empty}
                </p>
            ) : (
                <div className="-mx-1 overflow-x-auto px-1">
                    <table className="w-full min-w-0 text-[0.8438rem]">
                        <thead>
                            <tr className="border-b border-border">
                                {head.map((cell, index) => (
                                    <th
                                        key={cell}
                                        scope="col"
                                        className={cn(
                                            'pb-2 text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase',
                                            index === 0
                                                ? 'text-left'
                                                : 'text-right',
                                        )}
                                    >
                                        {cell}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIndex) => (
                                <tr
                                    key={row[0] + rowIndex}
                                    className="border-b border-border last:border-b-0"
                                >
                                    {row.map((cell, index) => (
                                        <td
                                            key={index}
                                            className={cn(
                                                'py-2.5',
                                                index === 0
                                                    ? 'pr-3 font-bold'
                                                    : 'text-right tabular-nums',
                                                index === row.length - 1 &&
                                                    alarm?.[rowIndex] &&
                                                    'font-bold text-destructive',
                                            )}
                                            data-numeric={
                                                index > 0 ? '' : undefined
                                            }
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

ReportPage.layout = {
    breadcrumbs: [{ title: 'Laporan', href: reportIndex() }],
};
