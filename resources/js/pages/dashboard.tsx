import { Head, Link, usePage } from '@inertiajs/react';
import { Plus, Upload } from 'lucide-react';
import { ChannelTable } from '@/components/dashboard/channel-table';
import { ContentQueue } from '@/components/dashboard/content-queue';
import type { Queue } from '@/components/dashboard/content-queue';
import { LeadChart } from '@/components/dashboard/lead-chart';
import type { LeadMonth } from '@/components/dashboard/lead-chart';
import { Panel } from '@/components/dashboard/panel';
import { PipelineList } from '@/components/dashboard/pipeline-list';
import type {
    ClosedSummary,
    PipelineStage,
} from '@/components/dashboard/pipeline-list';
import { StatTile } from '@/components/dashboard/stat-tile';
import { MiniBars, MiniLine, MiniRing } from '@/components/dashboard/stat-viz';
import { TeamLoad } from '@/components/dashboard/team-load';
import { Button } from '@/components/ui/button';
import { clients, content, dashboard, leads } from '@/routes';
import { create as leadsCreate } from '@/routes/leads';

const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
}).format(new Date());

type Props = {
    pipeline: PipelineStage[];
    /** What the content calendar owes this week. */
    queue: Queue;
    summary: {
        leads: {
            value: number;
            deltaPercent: number | null;
            comparedTo: string;
        };
        activeClients: { value: number; delta: number; comparedTo: string };
        stalled: {
            value: number;
            afterDays: number;
            worstStage: string | null;
            worstDays: number | null;
        };
        /** Live this month against the month's own plan. */
        published: { value: number; planned: number; workingDaysLeft: number };
    };
    monthlyLeads: LeadMonth[];
    monthlyClients: number[];
    closed: ClosedSummary;
};

/** A signed figure reads as a change; an unsigned one reads as a total. */
function signed(value: number): string {
    return value > 0 ? `+${value}` : String(value);
}

function greeting(hour: number) {
    if (hour < 11) {
        return 'Selamat pagi';
    }

    if (hour < 15) {
        return 'Selamat siang';
    }

    if (hour < 18) {
        return 'Selamat sore';
    }

    return 'Selamat malam';
}

/**
 * The line under the queue, always present so it pins.
 *
 * A panel in a two-column row keeps the height of whatever stands beside it,
 * and a list that ends early leaves that height as a hole. Closing it with a
 * summary turns the hole into a margin.
 */
function QueueFooter({ queue }: { queue: Queue }) {
    return (
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs leading-relaxed text-muted-foreground">
            {queue.rest > 0 ? (
                <>
                    <span
                        className="font-bold text-secondary-foreground"
                        data-numeric
                    >
                        {queue.rest}
                    </span>{' '}
                    konten lain di antrean —{' '}
                    <Link
                        href={content()}
                        prefetch
                        className="font-bold text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                    >
                        lihat semuanya di kalender
                    </Link>
                </>
            ) : (
                <>
                    <span
                        className="font-bold text-secondary-foreground"
                        data-numeric
                    >
                        {queue.planned}
                    </span>{' '}
                    konten dijadwalkan minggu ini. Yang lewat tanggal tayang
                    tetap muncul di sini sampai ditayangkan.
                </>
            )}
        </p>
    );
}

export default function Dashboard({
    pipeline,
    summary: figures,
    monthlyLeads,
    monthlyClients,
    closed,
    queue,
}: Props) {
    const { auth } = usePage().props;
    const firstName = auth.user?.name?.split(' ')[0] ?? '';

    /** The same six months each spark plots, so the tiles agree with the chart. */
    const recentLeads = monthlyLeads.slice(-6).map((month) => month.value);
    const stalledByStage = pipeline
        .filter((stage) => stage.stalled > 0)
        .map((stage) => stage.stalled);

    return (
        <>
            <Head title="Dashboard" />

            <div className="animate-settle flex flex-1 flex-col gap-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            {greeting(new Date().getHours())}
                            {firstName ? `, ${firstName}` : ''}
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                {today} ·{' '}
                                <span data-numeric>{queue.planned}</span> konten
                                minggu ini
                            </span>
                            {queue.late > 0 ? (
                                <span className="font-semibold text-destructive">
                                    · <span data-numeric>{queue.late}</span>{' '}
                                    terlambat
                                </span>
                            ) : null}
                            <span
                                className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-secondary-foreground uppercase"
                                title="Angka lead, client, dan konten sudah dari data yang tersimpan. Tugas dan beban tim masih contoh — modulnya belum dibangun."
                            >
                                Sebagian contoh
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                        <Button size="lg" className="shadow-teal" asChild>
                            <Link href={leadsCreate()}>
                                <Plus strokeWidth={2} aria-hidden />
                                Tambah Lead
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline">
                            <Upload strokeWidth={1.75} aria-hidden />
                            Import Data
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                    <StatTile
                        tone="anchor"
                        label="Total Lead"
                        hint="Lead yang masuk bulan ini dari seluruh channel."
                        value={figures.leads.value}
                        href={leads()}
                        delay={0}
                        compare={`vs ${figures.leads.comparedTo}`}
                        delta={
                            figures.leads.deltaPercent === null
                                ? undefined
                                : {
                                      text: `${signed(figures.leads.deltaPercent)}%`,
                                      direction:
                                          figures.leads.deltaPercent >= 0
                                              ? 'up'
                                              : 'down',
                                  }
                        }
                        viz={
                            <MiniBars
                                values={recentLeads}
                                barClassName="bg-white/70"
                                label={`Lead enam bulan terakhir, bulan ini ${figures.leads.value}`}
                            />
                        }
                    />
                    <StatTile
                        label="Client Aktif"
                        hint="Client yang kerja samanya sedang berjalan."
                        value={figures.activeClients.value}
                        href={clients()}
                        delay={90}
                        compare={`vs ${figures.activeClients.comparedTo}`}
                        delta={
                            figures.activeClients.delta === 0
                                ? undefined
                                : {
                                      text: signed(figures.activeClients.delta),
                                      direction:
                                          figures.activeClients.delta > 0
                                              ? 'up'
                                              : 'down',
                                  }
                        }
                        viz={
                            <MiniLine
                                values={monthlyClients}
                                strokeClassName="stroke-primary text-primary"
                                fillClassName="fill-primary/12"
                                label={`Client aktif enam bulan terakhir, kini ${figures.activeClients.value}`}
                            />
                        }
                    />
                    <StatTile
                        label="Konten Tayang"
                        hint="Konten yang sudah tayang bulan ini, dibanding semua yang dijadwalkan bulan ini."
                        value={figures.published.value}
                        valueSuffix={
                            <span className="text-base font-medium text-muted-foreground">
                                {' '}
                                / {figures.published.planned}
                            </span>
                        }
                        href={content()}
                        delay={180}
                        compare={
                            figures.published.planned > figures.published.value
                                ? `sisa ${figures.published.planned - figures.published.value} dalam ${figures.published.workingDaysLeft} hari kerja`
                                : 'semua yang direncanakan sudah tayang'
                        }
                        delta={{
                            text: `${figures.published.planned === 0 ? 0 : Math.round((figures.published.value / figures.published.planned) * 100)}%`,
                            direction: 'flat',
                        }}
                        viz={
                            <MiniRing
                                value={figures.published.value}
                                max={figures.published.planned || 1}
                                trackClassName="stroke-neutral-soft"
                                arcClassName="stroke-primary"
                                label={`${figures.published.value} dari ${figures.published.planned} konten tayang`}
                            />
                        }
                    />
                    <StatTile
                        label="Perlu Perhatian"
                        hint="Lead yang berhenti bergerak melewati batas wajar tahapnya."
                        value={figures.stalled.value}
                        href={leads({ query: { status: 'mandek' } })}
                        delay={270}
                        compare={
                            figures.stalled.worstStage
                                ? `terparah di ${figures.stalled.worstStage}, ${figures.stalled.worstDays} hari`
                                : 'semua tahap masih dalam batas'
                        }
                        viz={
                            <MiniBars
                                values={stalledByStage}
                                barClassName="bg-destructive"
                                label="Lead mandek per tahap"
                            />
                        }
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                    <Panel
                        title="Lead per bulan"
                        meta="12 bulan terakhir"
                        footer={
                            <PipelineList stages={pipeline} closed={closed} />
                        }
                        className="order-2 xl:order-1"
                    >
                        <LeadChart months={monthlyLeads} />
                    </Panel>

                    {/*
                     | The morning question, answered from the calendar this
                     | app actually keeps rather than from a task module that
                     | has no model behind it. The footer is pinned, so the
                     | height this row obliges the panel to keep reads as a
                     | margin under a summary instead of a hole under a list.
                     */}
                    <Panel
                        title="Konten minggu ini"
                        className="order-1 xl:order-2"
                        bodyClassName="flex-1"
                        action={
                            <Link
                                href={content()}
                                className="shrink-0 rounded-md bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-deep transition-colors hover:bg-accent"
                            >
                                Buka kalender
                            </Link>
                        }
                        footer={<QueueFooter queue={queue} />}
                    >
                        <ContentQueue queue={queue} />
                    </Panel>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                    <Panel
                        title="Konten yang menghasilkan lead"
                        action={
                            <Link
                                href={leads()}
                                className="shrink-0 rounded-md bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-deep transition-colors hover:bg-accent"
                            >
                                Lihat detail
                            </Link>
                        }
                    >
                        <ChannelTable />
                    </Panel>

                    <Panel title="Beban tim minggu ini" meta="kapasitas 8">
                        <TeamLoad />
                    </Panel>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
