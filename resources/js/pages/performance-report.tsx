import { Head, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    FileText,
    Sparkles,
    TriangleAlert,
} from 'lucide-react';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { performance as performanceIndex } from '@/routes';
import { performance as performanceReport } from '@/routes/report';

/*
 | Laporan Performa, on screen.
 |
 | The document is the deliverable — it is what gets sent, printed and read by
 | somebody who was not watching the accounts all quarter. This page is where
 | you choose the stretch it covers and read the same figures before committing
 | them to paper, so nobody downloads a report to find out what is in it.
 |
 | Both are rendered from one computation on the server, so the screen can
 | never promise a figure the file does not carry.
 */

type Totals = {
    interactions: number;
    likes: number;
    comments: number;
    plays: number | null;
    shares: number | null;
    saves: number | null;
};

type Platform = {
    key: string;
    label: string;
    handle: string;
    measured: number;
    enough: boolean;
    syncedAt: string | null;
    followers: number | null;
    totals: Totals | null;
    typical: { interactions: number; plays: number | null } | null;
    average: { interactions: number; skew: number | null } | null;
    engagement: {
        rate: number | null;
        basis: string;
        basisValue: number;
    } | null;
    cadence: { perWeek: number; longestGap: number | null } | null;
    formats: { key: string; label: string; count: number; share: number }[];
    concentration: { topFiveShare: number } | null;
    outlier: { times: number; share: number } | null;
};

type MonthRow = {
    key: string;
    label: string;
    year: number;
    posts: number;
    interactions: number;
    partial: boolean;
    by: Record<string, { label: string; posts: number; interactions: number }>;
};

type Leads = {
    summary: {
        arrived: number;
        wonInWindow: number;
        value: number;
        wonValue: number;
    };
    funnel: {
        key: string;
        label: string;
        count: number;
        share: number;
        dropped: number | null;
        kept: number | null;
    }[];
    sources: {
        key: string;
        label: string;
        leads: number;
        share: number;
        clients: number;
    }[];
    speed: {
        toContact: number | null;
        toClient: number | null;
        stalledNow: number;
        worstStage: { label: string; count: number; afterDays: number } | null;
    };
    closed: { total: number; share: number; lostValue: number };
    followUps: { overdueNow: number };
};

type Report = {
    period: {
        label: string;
        from: string;
        to: string;
        months: number;
        generatedAt: string;
        open: boolean;
        elapsed: { days: number; of: number } | null;
        lastMonth: string;
    };
    platforms: Platform[];
    combined: {
        posts: number;
        interactions: number;
        likes: number;
        comments: number;
        plays: number;
        followers: number;
    };
    months: MonthRow[];
    business: {
        plannedContent: number;
        publishedContent: number;
        publishedShare: number | null;
        topLinked: number;
        topTotal: number;
    };
    leads: Leads;
};

type Analysis = {
    ringkasan: string;
    temuan: { judul: string; isi: string }[];
    rekomendasi: { judul: string; isi: string }[];
    risiko: string | null;
    model: string;
} | null;

type Props = {
    report: Report;
    analysis?: Analysis;
    analysisAvailable: boolean;
    spans: number[];
    asked: { bulan: number; sampai: string; max: string };
};

/** The two accounts, each in one hue the whole report keeps to. */
const TONE: Record<string, { bar: string; chip: string; dot: string }> = {
    instagram: {
        bar: 'bg-primary',
        chip: 'bg-primary-soft text-primary-deep',
        dot: 'bg-primary',
    },
    tiktok: {
        bar: 'bg-info',
        chip: 'bg-info-soft text-info',
        dot: 'bg-info',
    },
};

const nf = new Intl.NumberFormat('id-ID');
const df = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/** One month either side, as YYYY-MM. */
function shift(month: string, by: number): string {
    const [year, index] = month.split('-').map(Number);
    const moved = new Date(year, index - 1 + by, 1);

    return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`;
}

export default function PerformanceReportPage({
    report,
    analysis,
    analysisAvailable,
    spans,
    asked,
}: Props) {
    /* The reading is a call to somebody else's server. The figures are the
       report and land first; this arrives when it arrives. */
    useEffect(() => {
        if (analysisAvailable && analysis === undefined) {
            router.reload({ only: ['analysis'] });
        }
    }, [analysisAvailable, analysis]);

    const go = (next: { bulan?: number; sampai?: string }) =>
        router.get(
            performanceReport.url({
                query: {
                    bulan: String(next.bulan ?? asked.bulan),
                    sampai: next.sampai ?? asked.sampai,
                },
            }),
            {},
            { preserveState: true, preserveScroll: true },
        );

    const pdfHref = `/laporan/performa/pdf?bulan=${asked.bulan}&sampai=${asked.sampai}`;
    const busiest = Math.max(...report.months.map((m) => m.interactions), 1);

    return (
        <>
            <Head title={`Laporan Kuartalan ${report.period.label}`} />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Laporan Kuartalan
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                            <span
                                className="font-semibold text-foreground"
                                data-numeric
                            >
                                {report.period.label}
                            </span>
                            <span aria-hidden>·</span>
                            <span>Leads &amp; media sosial, dua bagian</span>
                            {report.period.open ? (
                                <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-[0.6875rem] font-bold text-destructive uppercase">
                                    {report.period.lastMonth} berjalan
                                </span>
                            ) : null}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex rounded-md border border-border bg-card p-1 shadow-lift">
                            {spans.map((span) => (
                                <button
                                    key={span}
                                    type="button"
                                    aria-pressed={asked.bulan === span}
                                    onClick={() => go({ bulan: span })}
                                    className={cn(
                                        'rounded-sm px-3 py-1.5 text-[0.8438rem] font-bold transition-colors',
                                        asked.bulan === span
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-secondary-foreground hover:text-primary-deep',
                                    )}
                                >
                                    {span} bulan
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center rounded-md border border-border bg-card shadow-lift">
                            <Step
                                label="Periode sebelumnya"
                                onClick={() =>
                                    go({ sampai: shift(asked.sampai, -1) })
                                }
                            >
                                <ChevronLeft
                                    className="size-4"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            </Step>
                            <Step
                                label="Periode berikutnya"
                                disabled={asked.sampai >= asked.max}
                                onClick={() =>
                                    go({ sampai: shift(asked.sampai, 1) })
                                }
                            >
                                <ChevronRight
                                    className="size-4"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            </Step>
                        </div>

                        {/* A real download, not a visit: the file is streamed
                            straight from the server. */}
                        <a
                            href={pdfHref}
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-[0.8438rem] font-bold text-primary-foreground shadow-teal transition-colors hover:bg-primary-deep"
                        >
                            <Download
                                className="size-4"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            Unduh PDF
                        </a>
                    </div>
                </div>

                {report.period.open && report.period.elapsed ? (
                    <p className="flex items-start gap-2 rounded-lg bg-destructive-soft px-3.5 py-2.5 text-xs leading-relaxed text-destructive">
                        <TriangleAlert
                            className="mt-px size-3.5 shrink-0"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                        <span>
                            <span className="font-bold">
                                {report.period.lastMonth} baru berjalan{' '}
                                {report.period.elapsed.days} dari{' '}
                                {report.period.elapsed.of} hari.
                            </span>{' '}
                            Bulan terakhir di setiap grafik adalah bulan
                            berjalan — bukan bulan yang jatuh.
                        </span>
                    </p>
                ) : null}

                {/* ── Angka pokok ── */}
                <section className="grid gap-4 lg:grid-cols-2">
                    <Half
                        part="Bagian I"
                        title="Leads & Pipeline"
                        headline={nf.format(report.leads.summary.arrived)}
                        unit="lead masuk"
                        accent
                        figures={[
                            {
                                label: 'Client baru',
                                value: nf.format(
                                    report.leads.summary.wonInWindow,
                                ),
                            },
                            {
                                label: 'Berhenti',
                                value: nf.format(report.leads.closed.total),
                            },
                            {
                                label: 'Mandek',
                                value: nf.format(report.leads.speed.stalledNow),
                                alarm: report.leads.speed.stalledNow > 0,
                            },
                        ]}
                    />
                    <Half
                        part="Bagian II"
                        title="Performa Media Sosial"
                        headline={nf.format(report.combined.posts)}
                        unit="post terukur"
                        figures={[
                            {
                                label: 'Interaksi',
                                value: nf.format(report.combined.interactions),
                            },
                            {
                                label: 'Pemutaran',
                                value: nf.format(report.combined.plays),
                            },
                            {
                                label: 'Pengikut',
                                value: nf.format(report.combined.followers),
                            },
                        ]}
                    />
                </section>

                <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                    <div className="flex flex-col gap-6">
                        {/* ── Ringkasan dari model ── */}
                        <Panel
                            title="Ringkasan eksekutif"
                            meta={
                                analysis
                                    ? `dibaca oleh ${analysis.model}`
                                    : undefined
                            }
                            icon={Sparkles}
                        >
                            {!analysisAvailable ? (
                                <p className="text-[0.8438rem] leading-relaxed text-muted-foreground">
                                    Layanan analisis belum dikonfigurasi, jadi
                                    laporan ini tampil tanpa kalimat penafsir.
                                    Seluruh angkanya tetap lengkap dan dihitung
                                    di dalam aplikasi.
                                </p>
                            ) : analysis === undefined ? (
                                <p className="flex items-center gap-2 text-[0.8438rem] text-muted-foreground">
                                    <Spinner className="size-3.5" />
                                    Membaca angkanya…
                                </p>
                            ) : analysis === null ? (
                                <p className="text-[0.8438rem] leading-relaxed text-muted-foreground">
                                    Pembacaan naratif tidak bisa diambil kali
                                    ini. Angka di halaman ini dan di PDF tetap
                                    lengkap.
                                </p>
                            ) : (
                                <>
                                    <p className="text-[0.8438rem] leading-relaxed">
                                        {analysis.ringkasan}
                                    </p>

                                    {analysis.risiko ? (
                                        <p className="mt-3 rounded-lg bg-destructive-soft px-3.5 py-2.5 text-xs leading-relaxed text-destructive">
                                            <span className="font-bold">
                                                Perlu diwaspadai.
                                            </span>{' '}
                                            {analysis.risiko}
                                        </p>
                                    ) : null}

                                    {analysis.temuan.length > 0 ? (
                                        <ul className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                                            {analysis.temuan.map((item) => (
                                                <li key={item.judul}>
                                                    <p className="text-[0.8438rem] font-bold">
                                                        {item.judul}
                                                    </p>
                                                    <p className="mt-0.5 text-xs leading-relaxed text-secondary-foreground">
                                                        {item.isi}
                                                    </p>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </>
                            )}
                        </Panel>

                        {/* ── Bagian I: corong ── */}
                        <Panel
                            title="Corong konversi"
                            meta={`${nf.format(report.leads.summary.arrived)} lead periode ini`}
                        >
                            <ul className="flex flex-col gap-2.5">
                                {report.leads.funnel.map((stage) => (
                                    <li
                                        key={stage.key}
                                        className="flex items-center gap-3"
                                    >
                                        <span className="w-24 shrink-0 text-xs font-bold text-secondary-foreground">
                                            {stage.label}
                                        </span>
                                        <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-soft">
                                            <span
                                                className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                                                style={{
                                                    width: `${stage.count > 0 ? Math.max(1.5, stage.share) : 0}%`,
                                                }}
                                            />
                                        </span>
                                        <span
                                            className="w-20 shrink-0 text-right text-xs"
                                            data-numeric
                                        >
                                            <span className="font-bold">
                                                {nf.format(stage.count)}
                                            </span>{' '}
                                            <span className="text-muted-foreground">
                                                {df.format(stage.share)}%
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {/* The cohort has not finished maturing, and a
                                funnel read as final would blame the team for
                                leads that simply arrived last week. */}
                            <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                                Rombongan ini belum matang: lead yang baru masuk
                                belum punya waktu untuk sampai ke Client. Client
                                baru yang benar-benar ditutup di periode ini{' '}
                                <span className="font-bold text-foreground">
                                    {nf.format(
                                        report.leads.summary.wonInWindow,
                                    )}
                                </span>
                                .
                            </p>
                        </Panel>

                        {/* ── Bagian II: tren bulanan ── */}
                        <Panel
                            title="Interaksi per bulan"
                            meta={`${report.period.months} bulan`}
                        >
                            <ul className="flex flex-col gap-3.5">
                                {report.months.map((month) => (
                                    <li key={month.key}>
                                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-secondary-foreground">
                                            <span data-numeric>
                                                {month.label} {month.year}
                                            </span>
                                            {month.partial ? (
                                                <span className="text-[0.6875rem] font-bold text-destructive">
                                                    berjalan
                                                </span>
                                            ) : null}
                                            <span className="ml-auto font-normal text-muted-foreground">
                                                {month.posts} post
                                            </span>
                                        </p>

                                        {report.platforms.map((platform) => {
                                            const row = month.by[platform.key];
                                            const value =
                                                row?.interactions ?? 0;

                                            return (
                                                <span
                                                    key={platform.key}
                                                    className="mt-1 flex items-center gap-2.5"
                                                >
                                                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-soft">
                                                        <span
                                                            className={cn(
                                                                'block h-full rounded-full transition-[width] duration-500 ease-out',
                                                                TONE[
                                                                    platform.key
                                                                ]?.bar,
                                                            )}
                                                            style={{
                                                                width: `${value > 0 ? Math.max(1.5, (value / busiest) * 100) : 0}%`,
                                                            }}
                                                        />
                                                    </span>
                                                    <span
                                                        className="w-16 shrink-0 text-right text-xs font-bold"
                                                        data-numeric
                                                    >
                                                        {nf.format(value)}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </li>
                                ))}
                            </ul>

                            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                                {report.platforms.map((platform) => (
                                    <span
                                        key={platform.key}
                                        className="inline-flex items-center gap-1.5"
                                    >
                                        <span
                                            className={cn(
                                                'size-2 rounded-full',
                                                TONE[platform.key]?.dot,
                                            )}
                                            aria-hidden
                                        />
                                        {platform.label}
                                    </span>
                                ))}
                            </p>
                        </Panel>
                    </div>

                    <div className="flex flex-col gap-6">
                        {/* ── Per akun ── */}
                        {report.platforms.map((platform) => (
                            <Panel
                                key={platform.key}
                                title={platform.label}
                                meta={`@${platform.handle}`}
                            >
                                {platform.measured === 0 ? (
                                    <p className="text-[0.8438rem] leading-relaxed text-muted-foreground">
                                        Tidak ada post tercatat di periode ini.
                                        Bisa jadi akunnya memang tidak terbit,
                                        atau Performa belum disinkronkan.
                                    </p>
                                ) : (
                                    <>
                                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                                            <Figure
                                                label="Post terbit"
                                                value={nf.format(
                                                    platform.measured,
                                                )}
                                                note={`${df.format(platform.cadence?.perWeek ?? 0)}/minggu`}
                                            />
                                            <Figure
                                                label="Interaksi khas"
                                                value={df.format(
                                                    platform.typical
                                                        ?.interactions ?? 0,
                                                )}
                                                note={`rata-rata ${df.format(platform.average?.interactions ?? 0)}`}
                                            />
                                            <Figure
                                                label="Engagement"
                                                value={
                                                    platform.engagement
                                                        ?.rate === null
                                                        ? '–'
                                                        : `${df.format(platform.engagement?.rate ?? 0)}%`
                                                }
                                                note={`per ${platform.engagement?.basis}`}
                                            />
                                            <Figure
                                                label="Total interaksi"
                                                value={nf.format(
                                                    platform.totals
                                                        ?.interactions ?? 0,
                                                )}
                                                note={`${nf.format(platform.followers ?? 0)} pengikut`}
                                            />
                                        </dl>

                                        {/* The gap between the middle post and
                                            the mean is the finding, so it is
                                            stated rather than left to be
                                            spotted in two numbers. */}
                                        {platform.average?.skew &&
                                        platform.average.skew >= 2 ? (
                                            <p className="mt-3.5 rounded-lg bg-destructive-soft px-3 py-2 text-xs leading-relaxed text-destructive">
                                                Rata-rata{' '}
                                                <span
                                                    className="font-bold"
                                                    data-numeric
                                                >
                                                    {df.format(
                                                        platform.average.skew,
                                                    )}
                                                    ×
                                                </span>{' '}
                                                lebih tinggi dari post khas —
                                                sebarannya timpang, pakai angka
                                                khas sebagai patokan.
                                            </p>
                                        ) : null}

                                        <p className="mt-3 flex flex-wrap gap-1.5">
                                            {platform.formats.map((format) => (
                                                <span
                                                    key={format.key}
                                                    className={cn(
                                                        'rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold',
                                                        TONE[platform.key]
                                                            ?.chip,
                                                    )}
                                                >
                                                    {format.label}{' '}
                                                    {format.share}%
                                                </span>
                                            ))}
                                        </p>

                                        {platform.syncedAt ? (
                                            <p className="mt-3 text-[0.6875rem] text-muted-foreground">
                                                Data ditarik {platform.syncedAt}
                                                . Post setelah itu belum
                                                terhitung.
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </Panel>
                        ))}

                        {/* ── Apa yang ada di PDF ── */}
                        <Panel title="Isi dokumen PDF" icon={FileText}>
                            <ol className="flex flex-col gap-2 text-[0.8438rem]">
                                {[
                                    'Ringkasan eksekutif',
                                    'Bagian I · Leads & Pipeline',
                                    'Bagian II · Performa Media Sosial',
                                    'Temuan & rekomendasi',
                                    'Catatan metode',
                                ].map((title, at) => (
                                    <li
                                        key={title}
                                        className="flex items-baseline gap-2.5"
                                    >
                                        <span
                                            className="w-4 shrink-0 text-xs font-extrabold text-primary-deep"
                                            data-numeric
                                        >
                                            {at + 1}
                                        </span>
                                        <span>{title}</span>
                                    </li>
                                ))}
                            </ol>

                            <a
                                href={pdfHref}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-[0.8438rem] font-bold transition-colors hover:border-primary/40 hover:text-primary-deep"
                            >
                                <Download
                                    className="size-4"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                                Unduh laporan lengkap
                            </a>

                            <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
                                Angka mentah tiap post ada di{' '}
                                <a
                                    href={performanceIndex().url}
                                    className="font-bold text-primary-deep underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                                >
                                    halaman Performa
                                </a>
                                . Laporan ini menghitung ulang dari sumber yang
                                sama setiap kali dibuka.
                            </p>
                        </Panel>
                    </div>
                </div>
            </div>
        </>
    );
}

function Step({
    label,
    onClick,
    disabled = false,
    children,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            className="grid size-9 place-items-center rounded-md text-secondary-foreground transition-colors first:rounded-r-none last:rounded-l-none hover:bg-neutral-soft hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
            {children}
            <span className="sr-only">{label}</span>
        </button>
    );
}

/**
 * One half of the document, as a card.
 *
 * The screen mirrors the printed cover: two halves, each named, each carrying
 * the one figure that names it and three that qualify it. Reading this page and
 * reading the front of the PDF should feel like the same act.
 */
function Half({
    part,
    title,
    headline,
    unit,
    figures,
    accent = false,
}: {
    part: string;
    title: string;
    headline: string;
    unit: string;
    figures: { label: string; value: string; alarm?: boolean }[];
    /** The lead half carries the teal, because it is the half that pays. */
    accent?: boolean;
}) {
    return (
        <div
            className={cn(
                'rounded-xl border p-4 shadow-lift sm:p-5',
                accent
                    ? 'border-primary/25 bg-primary-soft'
                    : 'border-border bg-card',
            )}
        >
            <p
                className={cn(
                    'text-[0.6875rem] font-bold tracking-[0.14em] uppercase',
                    accent ? 'text-primary-deep' : 'text-primary',
                )}
            >
                {part}
            </p>
            <h2 className="mt-0.5 text-base font-extrabold tracking-[-0.01em]">
                {title}
            </h2>

            <p className="mt-3 flex items-baseline gap-2">
                <span
                    className="text-3xl font-extrabold tracking-[-0.03em]"
                    data-numeric
                >
                    {headline}
                </span>
                <span
                    className={cn(
                        'text-xs',
                        accent ? 'text-primary-deep' : 'text-muted-foreground',
                    )}
                >
                    {unit}
                </span>
            </p>

            <dl
                className={cn(
                    'mt-3.5 grid grid-cols-3 gap-3 border-t pt-3',
                    accent ? 'border-primary/20' : 'border-border',
                )}
            >
                {figures.map((figure) => (
                    <div key={figure.label}>
                        <dt
                            className={cn(
                                'text-[0.6875rem] font-bold tracking-[0.06em] uppercase',
                                accent
                                    ? 'text-primary-deep/75'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {figure.label}
                        </dt>
                        <dd
                            className={cn(
                                'mt-0.5 text-lg leading-tight font-extrabold',
                                figure.alarm && 'text-destructive',
                            )}
                            data-numeric
                        >
                            {figure.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

function Figure({
    label,
    value,
    note,
}: {
    label: string;
    value: string;
    note: string;
}) {
    return (
        <div>
            <dt className="text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                {label}
            </dt>
            <dd
                className="mt-0.5 text-lg leading-tight font-extrabold"
                data-numeric
            >
                {value}
            </dd>
            <dd className="text-[0.6875rem] text-muted-foreground">{note}</dd>
        </div>
    );
}

function Panel({
    title,
    meta,
    icon: Icon,
    children,
}: {
    title: string;
    meta?: string;
    icon?: typeof Sparkles;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border bg-card p-4 shadow-lift sm:p-5">
            <div className="mb-3.5 flex items-baseline justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.01em]">
                    {Icon ? (
                        <Icon
                            className="size-4 shrink-0 text-primary"
                            strokeWidth={2}
                            aria-hidden
                        />
                    ) : null}
                    {title}
                </h2>
                {meta ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {meta}
                    </span>
                ) : null}
            </div>
            {children}
        </section>
    );
}
