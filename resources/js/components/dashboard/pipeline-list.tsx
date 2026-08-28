import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { leads } from '@/routes';

export type PipelineStage = {
    key: string;
    label: string;
    count: number;
    /** Leads here that have not moved for longer than the stage allows. */
    stalled: number;
    stalledAfterDays: number;
};

export type ClosedSummary = {
    value: number;
    worstStage: string | null;
    worstStageCount: number;
    topReason: string | null;
};

export function PipelineList({
    stages,
    closed,
}: {
    stages: PipelineStage[];
    closed: ClosedSummary;
}) {
    const widest = Math.max(...stages.map((stage) => stage.count), 1);

    return (
        <>
            {/* Without this row the mobile column reads as a bare red numeral. */}
            <p className="mb-1 flex items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase sm:gap-3">
                <span className="w-[4.75rem] shrink-0">Tahap</span>
                <span className="min-w-0 flex-1" />
                <span className="w-9 shrink-0 text-right">Total</span>
                <span className="w-12 shrink-0 text-right sm:w-[7.5rem]">
                    Mandek
                </span>
            </p>

            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-destructive">Mandek</span> =
                lead yang berhenti bergerak melewati batas wajar tahapnya.
            </p>

            <ul className="flex flex-col">
                {stages.map((stage, index) => {
                    const share = Math.max(
                        Math.round((stage.count / widest) * 100),
                        3,
                    );
                    const stalledShare = stage.count
                        ? (stage.stalled / stage.count) * 100
                        : 0;

                    return (
                        <li key={stage.key}>
                            <Link
                                href={leads({ query: { tahap: stage.key } })}
                                prefetch
                                className="group/stage -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1 text-[0.8438rem] transition-colors hover:bg-neutral-soft sm:gap-3"
                            >
                                <span className="w-[4.75rem] shrink-0 font-bold text-secondary-foreground transition-colors group-hover/stage:text-primary-deep">
                                    {stage.label}
                                </span>

                                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-soft">
                                    <span
                                        className="animate-draw-across flex h-full overflow-hidden rounded-full"
                                        style={{
                                            width: `${share}%`,
                                            animationDelay: `${360 + index * 70}ms`,
                                        }}
                                    >
                                        <span className="h-full flex-1 bg-primary transition-colors group-hover/stage:bg-primary-bright" />
                                        {stage.stalled > 0 ? (
                                            <span
                                                className="h-full shrink-0 bg-destructive"
                                                style={{
                                                    width: `${stalledShare}%`,
                                                }}
                                            />
                                        ) : null}
                                    </span>
                                </span>

                                <span
                                    className="w-9 shrink-0 text-right font-extrabold"
                                    data-numeric
                                >
                                    {stage.count}
                                </span>

                                <span
                                    className={cn(
                                        'shrink-0 text-right text-xs',
                                        'w-12 sm:w-[7.5rem]',
                                        stage.stalled > 0
                                            ? 'text-destructive'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    <span className="sm:hidden" data-numeric>
                                        {stage.stalled > 0
                                            ? stage.stalled
                                            : '—'}
                                    </span>
                                    <span className="hidden sm:inline">
                                        {stage.stalled > 0 ? (
                                            <>
                                                <span
                                                    className="font-bold"
                                                    data-numeric
                                                >
                                                    {stage.stalled}
                                                </span>{' '}
                                                lewat{' '}
                                                <span data-numeric>
                                                    {stage.stalledAfterDays}
                                                </span>{' '}
                                                hari
                                            </>
                                        ) : (
                                            'lancar'
                                        )}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {/* What left the pipeline, read beside it: the stage a lead dies at
                is the only thing that says which part of the work is failing. */}
            <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                {closed.value === 0 ? (
                    'Belum ada lead yang ditutup bulan ini.'
                ) : (
                    <>
                        <Link
                            href={leads({ query: { tampil: 'tutup' } })}
                            prefetch
                            className="font-bold text-foreground underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                        >
                            <span data-numeric>{closed.value}</span> lead tidak
                            lanjut
                        </Link>{' '}
                        bulan ini
                        {closed.worstStage ? (
                            <>
                                , paling banyak berhenti di{' '}
                                <span className="font-semibold text-secondary-foreground">
                                    {closed.worstStage}
                                </span>{' '}
                                (
                                <span data-numeric>
                                    {closed.worstStageCount}
                                </span>
                                )
                            </>
                        ) : null}
                        {closed.topReason ? (
                            <>
                                {' '}
                                · terbanyak karena{' '}
                                <span className="font-semibold text-secondary-foreground">
                                    {closed.topReason.toLowerCase()}
                                </span>
                            </>
                        ) : null}
                        .
                    </>
                )}
            </p>
        </>
    );
}
