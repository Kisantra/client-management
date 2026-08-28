import { useState } from 'react';
import { cn } from '@/lib/utils';

export type LeadMonth = { month: string; value: number };

export function LeadChart({ months }: { months: LeadMonth[] }) {
    const monthlyLeads = months;
    const peak = Math.max(...monthlyLeads.map((m) => m.value), 1);
    const average = Math.round(
        monthlyLeads.reduce((sum, m) => sum + m.value, 0) /
            Math.max(monthlyLeads.length, 1),
    );

    /** Round the axis up to a readable ceiling so gridlines land on whole tens. */
    const step = peak > 200 ? 100 : 50;
    const ceiling = Math.ceil(peak / step) * step;
    const gridlines = Array.from(
        { length: ceiling / step + 1 },
        (_, i) => ceiling - i * step,
    );

    const lastIndex = monthlyLeads.length - 1;

    /** null means "no month pinned", which reads as the latest month. */
    const [pinned, setPinned] = useState<number | null>(null);
    const activeIndex = pinned ?? lastIndex;
    const active = monthlyLeads[activeIndex];
    const before = monthlyLeads[activeIndex - 1];
    const delta = before
        ? Math.round(((active.value - before.value) / before.value) * 100)
        : null;
    const gap = active.value - average;

    return (
        <figure className="m-0">
            <figcaption className="mb-5 flex min-h-9 flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="text-sm font-extrabold text-foreground">
                    {active.month}
                </span>
                <span
                    className="text-sm font-extrabold text-foreground"
                    data-numeric
                >
                    {active.value} lead
                </span>
                {delta === null ? null : (
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-[0.6875rem] font-extrabold',
                            delta >= 0
                                ? 'bg-primary-soft text-primary-deep'
                                : 'bg-destructive-soft text-destructive',
                        )}
                        data-numeric
                    >
                        {delta >= 0 ? '+' : ''}
                        {delta}% dari {before.month}
                    </span>
                )}
                <span>
                    {gap >= 0 ? 'di atas' : 'di bawah'} rata-rata{' '}
                    <span className="font-bold text-foreground" data-numeric>
                        {average}
                    </span>{' '}
                    ({gap >= 0 ? '+' : ''}
                    <span data-numeric>{gap}</span>)
                </span>
                {pinned === null ? null : (
                    <button
                        type="button"
                        onClick={() => setPinned(null)}
                        className="rounded-sm font-bold text-primary underline decoration-primary/40 hover:decoration-primary"
                    >
                        kembali ke {monthlyLeads[lastIndex].month}
                    </button>
                )}
            </figcaption>

            <div className="-mx-1 overflow-x-auto px-1 pt-7 pb-1">
                <div className="min-w-[26rem]">
                    <div className="flex gap-3">
                        {/* Without an axis the bars cannot be read without hovering. */}
                        <div
                            className="relative h-64 w-6 shrink-0 text-right"
                            aria-hidden
                        >
                            {gridlines.map((value, index) => (
                                <span
                                    key={value}
                                    className={cn(
                                        'absolute right-0 text-[0.6875rem] font-semibold text-muted-foreground',
                                        index === 0 && 'translate-y-0',
                                        index === gridlines.length - 1 &&
                                            '-translate-y-full',
                                        index > 0 &&
                                            index < gridlines.length - 1 &&
                                            '-translate-y-1/2',
                                    )}
                                    style={{
                                        top: `${(1 - value / ceiling) * 100}%`,
                                    }}
                                    data-numeric
                                >
                                    {value}
                                </span>
                            ))}
                        </div>

                        <div className="relative h-64 min-w-0 flex-1">
                            {gridlines.map((value) => (
                                <span
                                    key={value}
                                    className="absolute inset-x-0 border-t border-border"
                                    style={{
                                        top: `${(1 - value / ceiling) * 100}%`,
                                    }}
                                    aria-hidden
                                />
                            ))}

                            {/* The average is the counterweight every bar is read against. */}
                            <span
                                className="absolute inset-x-0 z-10 border-t border-dashed border-primary/50"
                                style={{
                                    top: `${(1 - average / ceiling) * 100}%`,
                                }}
                                aria-hidden
                            >
                                <span className="absolute -top-2.5 left-0 rounded-sm bg-primary-soft px-1.5 py-0.5 text-[0.6875rem] font-bold text-primary-deep">
                                    rata-rata
                                </span>
                            </span>

                            <div className="absolute inset-0 flex items-stretch gap-1.5">
                                {monthlyLeads.map((month, index) => {
                                    const isActive = index === activeIndex;
                                    const beatsAverage = month.value >= average;

                                    return (
                                        <button
                                            key={month.month}
                                            type="button"
                                            onClick={() =>
                                                setPinned(
                                                    index === pinned
                                                        ? null
                                                        : index,
                                                )
                                            }
                                            aria-pressed={isActive}
                                            aria-label={`${month.month}: ${month.value} lead`}
                                            className={cn(
                                                'group/bar relative flex flex-1 cursor-pointer items-end rounded-md transition-colors duration-200',
                                                isActive
                                                    ? 'bg-primary-soft'
                                                    : 'hover:bg-neutral-soft',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'animate-draw-up block w-full rounded-t-md transition-colors duration-200',
                                                    isActive
                                                        ? 'bg-primary'
                                                        : beatsAverage
                                                          ? 'bg-chart-2 group-hover/bar:bg-primary-bright'
                                                          : 'bg-chart-4 group-hover/bar:bg-chart-3',
                                                )}
                                                style={{
                                                    height: `${(month.value / ceiling) * 100}%`,
                                                    animationDelay: `${index * 45}ms`,
                                                }}
                                            />

                                            <span
                                                className={cn(
                                                    'pointer-events-none absolute inset-x-0 bottom-full z-10 mx-auto mb-1.5 w-max rounded-md px-2 py-1 text-[0.6875rem] font-extrabold shadow-lift transition-opacity duration-150',
                                                    isActive
                                                        ? 'bg-primary text-primary-foreground opacity-100'
                                                        : 'bg-foreground text-background opacity-0 group-hover/bar:opacity-100',
                                                )}
                                                data-numeric
                                            >
                                                {month.value}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="mt-2.5 flex gap-1.5 pl-9">
                        {monthlyLeads.map((month, index) => (
                            <span
                                key={month.month}
                                className={cn(
                                    'flex-1 text-center text-[0.6875rem] transition-colors',
                                    index === activeIndex
                                        ? 'font-extrabold text-foreground'
                                        : 'font-semibold text-muted-foreground',
                                )}
                            >
                                {month.month}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </figure>
    );
}
