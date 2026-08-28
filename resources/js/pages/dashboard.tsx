import { Head, Link, usePage } from '@inertiajs/react';
import { Plus, Upload } from 'lucide-react';
import { ChannelTable } from '@/components/dashboard/channel-table';
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
import { TaskList } from '@/components/dashboard/task-list';
import { TeamLoad } from '@/components/dashboard/team-load';
import { Button } from '@/components/ui/button';
import { summary, todayTasks } from '@/data/dashboard';
import { clients, content, dashboard, leads, tasks } from '@/routes';
import { create as leadsCreate } from '@/routes/leads';

const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
}).format(new Date());

const lateCount = todayTasks.filter((task) => task.state === 'late').length;

type Props = {
    pipeline: PipelineStage[];
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

export default function Dashboard({
    pipeline,
    summary: figures,
    monthlyLeads,
    monthlyClients,
    closed,
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
                                {today} · {todayTasks.length} tugas hari ini
                            </span>
                            {lateCount > 0 ? (
                                <span className="font-semibold text-destructive">
                                    · {lateCount} terlambat
                                </span>
                            ) : null}
                            <span
                                className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-secondary-foreground uppercase"
                                title="Angka lead dan client sudah dari data yang tersimpan. Konten, tugas, dan beban tim masih contoh — modulnya belum dibangun."
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
                        hint="Konten yang sudah tayang bulan ini, dibanding target bulanan."
                        value={summary.published.value}
                        valueSuffix={
                            <span className="text-base font-medium text-muted-foreground">
                                {' '}
                                / {summary.published.target}
                            </span>
                        }
                        href={content()}
                        delay={180}
                        compare={`sisa ${summary.published.target - summary.published.value} dalam ${summary.published.workingDaysLeft} hari kerja`}
                        delta={{
                            text: `${Math.round((summary.published.value / summary.published.target) * 100)}%`,
                            direction: 'flat',
                        }}
                        viz={
                            <MiniRing
                                value={summary.published.value}
                                max={summary.published.target}
                                trackClassName="stroke-neutral-soft"
                                arcClassName="stroke-primary"
                                label={`${summary.published.value} dari ${summary.published.target} konten tayang`}
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

                    <Panel
                        title="Tugas hari ini"
                        className="order-1 xl:order-2"
                        action={
                            <Link
                                href={tasks()}
                                className="shrink-0 rounded-md bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-deep transition-colors hover:bg-accent"
                            >
                                Lihat semua
                            </Link>
                        }
                    >
                        <TaskList />
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
