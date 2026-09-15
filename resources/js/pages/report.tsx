import { Head, router } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    FileSpreadsheet,
    Printer,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StatTile } from '@/components/dashboard/stat-tile';
import { MiniBars, MiniLine } from '@/components/dashboard/stat-viz';
import { ContentPatterns } from '@/components/report/content-patterns';
import type { PatternsData } from '@/components/report/content-patterns';
import { ContentProduction } from '@/components/report/content-production';
import { LeadSources } from '@/components/report/lead-sources';
import type { LeadSource } from '@/components/report/lead-sources';
import { nf } from '@/components/report/report-section';
import { TopContent } from '@/components/report/top-content';
import type { TopContentData } from '@/components/report/top-content';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    /** The six periods ending in this one, oldest first, for the chart. */
    series: number[];
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
    sources: LeadSource[];
    top: TopContentData;
    patterns: PatternsData;
    generatedAt: string;
};

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
    top,
    patterns,
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
                    [data-slot="dropdown-menu-content"],
                    [data-print="hide"] { display: none !important; }
                    [data-print="sheet"] {
                        padding: 0 !important;
                        /* The lead tile is white on teal; a browser that drops
                           backgrounds to save ink would print it blank. */
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    main, [data-slot="sidebar-inset"] {
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: 0 !important;
                    }
                    table { break-inside: auto; }
                    tr, section, article { break-inside: avoid; }
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

                        <ExportMenu period={period} />
                    </div>
                </div>

                {/* The dashboard's own tiles, so the two pages read as one
                    product: the lead figure anchored in teal, every figure
                    with its recent shape beside it. No link on any of them —
                    this page is already the detail. */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                    {summary.map((figure, at) => (
                        <ReportTile
                            key={figure.key}
                            figure={figure}
                            /* A week's full name fills the tile's whole
                               footer; the subtitle above already spells it
                               out, so the tile only needs to point at it. */
                            previous={
                                period.kind === 'minggu'
                                    ? 'minggu sebelumnya'
                                    : previous.label
                            }
                            anchor={at === 0}
                            delay={at * 90}
                        />
                    ))}
                </div>

                {/* Lead on the left, content on the right: the same halves
                    the tiles above are split into, so each card sits under
                    the figures it explains. */}
                <div className="grid gap-4 xl:grid-cols-2">
                    <LeadSources sources={sources} />
                    <ContentProduction channels={channels} owners={owners} />
                </div>

                <TopContent top={top} periodLabel={period.label} />

                <ContentPatterns data={patterns} />
            </div>
        </>
    );
}

/**
 * Every way out of the page, behind one button.
 *
 * Three side-by-side buttons made the toolbar wider than the controls that
 * actually change what the page shows. Folded into one menu, each way out
 * can also say what it hands over — the sheet as printed, or the rows behind
 * it — which a two-word button label never could.
 */
function ExportMenu({ period }: { period: Period }) {
    const query = { query: { periode: period.kind, pada: period.start } };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="group/export inline-flex items-center gap-1.5 rounded-md bg-primary py-2 pr-2.5 pl-3 text-[0.8438rem] font-bold text-primary-foreground shadow-teal transition-colors hover:bg-primary-deep focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:outline-none data-[state=open]:bg-primary-deep"
                >
                    <Download className="size-4" strokeWidth={2} aria-hidden />
                    Ekspor
                    <ChevronDown
                        className="size-4 opacity-80 transition-transform duration-200 group-data-[state=open]/export:rotate-180"
                        strokeWidth={2.25}
                        aria-hidden
                    />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="w-[17.5rem] rounded-lg border-border p-1.5 shadow-lift-lg"
            >
                <p className="px-2 pt-1 pb-1.5 text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                    Laporan {period.label}
                </p>

                <ExportItem
                    icon={Printer}
                    title="Cetak atau simpan PDF"
                    body="Halaman ini, siap dicetak."
                    /* Printing blocks the page. Waiting out the menu's closing
                       fade keeps it from being frozen, half-faded, on the
                       screen behind the print dialog. */
                    onSelect={() =>
                        window.setTimeout(() => window.print(), 160)
                    }
                />

                <DropdownMenuSeparator className="mx-1 my-1.5" />

                <p className="px-2 pt-0.5 pb-1.5 text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                    Data mentah · CSV
                </p>

                <ExportItem
                    icon={FileSpreadsheet}
                    title="Data konten"
                    body="Konten terjadwal di periode ini."
                    href={reportExport.url('konten', query)}
                />
                <ExportItem
                    icon={Users}
                    title="Data lead"
                    body="Lead yang masuk di periode ini."
                    href={reportExport.url('lead', query)}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ExportItem({
    icon: Icon,
    title,
    body,
    href,
    onSelect,
}: {
    icon: LucideIcon;
    title: string;
    body: string;
    href?: string;
    onSelect?: () => void;
}) {
    const inner = (
        <>
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-deep transition-colors group-data-[highlighted]/item:bg-primary group-data-[highlighted]/item:text-primary-foreground">
                {/* text-current, or the menu item paints every icon grey. */}
                <Icon
                    className="size-4 text-current"
                    strokeWidth={2}
                    aria-hidden
                />
            </span>
            <span className="min-w-0">
                <span className="block text-[0.8438rem] leading-tight font-bold text-foreground">
                    {title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {body}
                </span>
            </span>
        </>
    );

    const className =
        'group/item cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 data-[highlighted]:bg-neutral-soft';

    /* The CSV answers with an attachment, so a plain link downloads it without
       leaving the page — and stays a link a person can copy or open elsewhere. */
    return href ? (
        <DropdownMenuItem asChild className={className}>
            <a href={href}>{inner}</a>
        </DropdownMenuItem>
    ) : (
        <DropdownMenuItem className={className} onSelect={onSelect}>
            {inner}
        </DropdownMenuItem>
    );
}

/**
 * One headline figure, as the dashboard draws it: the count, the same count
 * last period as a change, and the last six periods as its shape.
 */
function ReportTile({
    figure,
    previous,
    anchor,
    delay,
}: {
    figure: Figure;
    previous: string;
    anchor: boolean;
    delay: number;
}) {
    const delta = figure.value - figure.was;

    /* Fewer late pieces is the good direction; for everything else it is more.
       A report that colours every fall red would be lying about half of it. */
    const better = figure.key === 'late' ? delta < 0 : delta > 0;
    const shape = `${figure.label} enam periode terakhir, kini ${nf.format(figure.value)}`;

    return (
        <StatTile
            tone={anchor ? 'anchor' : 'plain'}
            label={figure.label}
            hint={`${figure.label}: ${figure.note}.`}
            value={figure.value}
            format={(value) => nf.format(value)}
            delay={delay}
            compare={delta === 0 ? `sama dengan ${previous}` : `vs ${previous}`}
            delta={
                delta === 0
                    ? undefined
                    : {
                          text: `${delta > 0 ? '+' : '−'}${nf.format(Math.abs(delta))}`,
                          direction: better ? 'up' : 'down',
                      }
            }
            viz={
                figure.key === 'clients' ? (
                    <MiniLine
                        values={figure.series}
                        strokeClassName="stroke-primary text-primary"
                        fillClassName="fill-primary/12"
                        label={shape}
                    />
                ) : (
                    <MiniBars
                        values={figure.series}
                        barClassName={
                            anchor
                                ? 'bg-white/70'
                                : figure.key === 'late'
                                  ? 'bg-destructive'
                                  : 'bg-primary'
                        }
                        label={shape}
                    />
                )
            }
        />
    );
}

ReportPage.layout = {
    breadcrumbs: [{ title: 'Laporan', href: reportIndex() }],
};
