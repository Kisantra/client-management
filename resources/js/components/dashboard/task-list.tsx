import { CalendarPlus } from 'lucide-react';
import { CHANNEL_LABELS, todayTasks } from '@/data/dashboard';
import type { Task } from '@/data/dashboard';
import { cn } from '@/lib/utils';

/** Urgency, not clock order: what is already breached reads before what is coming. */
const URGENCY: Record<Task['state'], number> = {
    late: 0,
    running: 1,
    waiting: 2,
    done: 3,
};

const ordered = [...todayTasks].sort(
    (a, b) => URGENCY[a.state] - URGENCY[b.state],
);

const doneCount = todayTasks.filter((task) => task.state === 'done').length;
const firstDoneIndex = ordered.findIndex((task) => task.state === 'done');

export function TaskList() {
    if (todayTasks.length === 0) {
        return <TaskListEmpty />;
    }

    return (
        <div>
            <div className="mb-4">
                <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                        <span
                            className="font-bold text-foreground"
                            data-numeric
                        >
                            {doneCount}
                        </span>{' '}
                        dari <span data-numeric>{todayTasks.length}</span>{' '}
                        selesai
                    </span>
                    <span className="font-semibold text-muted-foreground">
                        {todayTasks.length - doneCount} tersisa
                    </span>
                </div>
                <div
                    className="h-1.5 overflow-hidden rounded-full bg-neutral-soft"
                    role="progressbar"
                    aria-valuenow={doneCount}
                    aria-valuemin={0}
                    aria-valuemax={todayTasks.length}
                    aria-label="Tugas selesai hari ini"
                >
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{
                            width: `${(doneCount / todayTasks.length) * 100}%`,
                        }}
                    />
                </div>
            </div>

            <ul className="flex flex-col gap-0.5">
                {ordered.map((task, index) => (
                    <li key={task.id}>
                        {index === firstDoneIndex ? (
                            <p className="mt-3 mb-1.5 flex items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                                Selesai
                                <span
                                    className="h-px flex-1 bg-border"
                                    aria-hidden
                                />
                            </p>
                        ) : null}
                        <TaskRow task={task} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TaskRow({ task }: { task: Task }) {
    const isLate = task.state === 'late';
    const isDone = task.state === 'done';
    const isRunning = task.state === 'running';
    const isPlain = !isLate && !isRunning && !isDone;

    return (
        <div
            className={cn(
                '-mx-2 flex items-start gap-3.5 rounded-md px-2.5 py-2.5 transition-colors',
                isLate && 'bg-destructive-soft',
                isRunning && 'bg-primary-soft',
                (isPlain || isDone) && 'hover:bg-neutral-soft',
            )}
        >
            {/* The clock time anchors the row; the day reads as a schedule. */}
            <span
                className={cn(
                    'w-14 shrink-0 self-center text-base leading-none font-extrabold',
                    isLate && 'text-destructive',
                    isRunning && 'text-primary-deep',
                    isDone && 'text-muted-foreground',
                    isPlain && 'text-foreground',
                )}
                data-numeric
            >
                {task.time}
            </span>

            <span className="min-w-0 flex-1">
                <span
                    className={cn(
                        'line-clamp-2 block text-[0.8438rem] leading-snug font-bold',
                        isDone && 'text-muted-foreground',
                    )}
                >
                    {task.title}
                </span>
                <span
                    className={cn(
                        'mt-1 block truncate text-xs',
                        isLate ? 'text-destructive' : 'text-muted-foreground',
                    )}
                >
                    {CHANNEL_LABELS[task.channel]} · {task.owner}
                    {task.stuckAt ? ` · tertahan di ${task.stuckAt}` : ''}
                </span>
            </span>

            {isLate ? (
                <span className="mt-px shrink-0 rounded-full bg-destructive px-2.5 py-1 text-[0.6875rem] font-extrabold whitespace-nowrap text-destructive-foreground">
                    Telat {task.lateDays} hari
                </span>
            ) : isRunning ? (
                <span className="mt-px shrink-0 rounded-full bg-primary px-2.5 py-1 text-[0.6875rem] font-extrabold whitespace-nowrap text-primary-foreground">
                    Sedang jalan
                </span>
            ) : null}
        </div>
    );
}

function TaskListEmpty() {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                <CalendarPlus
                    className="size-5"
                    strokeWidth={1.75}
                    aria-hidden
                />
            </span>
            <p className="text-sm font-bold">Tidak ada tugas hari ini</p>
            <p className="max-w-[34ch] text-xs leading-relaxed text-muted-foreground">
                Jadwalkan konten dari kalender, atau tarik tugas yang tenggatnya
                minggu ini supaya tidak menumpuk.
            </p>
        </div>
    );
}
