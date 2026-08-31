import type { Share } from '@/data/clients';
import { shortRupiah } from '@/data/leads';
import { cn } from '@/lib/utils';

/**
 * A rail of bars, one per person, scaled to the widest.
 *
 * Every row is also the filter for what it counts, so reading "who holds our
 * clients" and asking "show me only theirs" are the same gesture, the way the
 * stage chips on the Leads page work.
 */
export function ShareList({
    items,
    active,
    onPick,
    columnLabel,
}: {
    items: Share[];
    /** The key currently filtered on, if any. */
    active: string | null;
    onPick: (key: string | null) => void;
    columnLabel: string;
}) {
    const widest = Math.max(...items.map((item) => item.count), 1);

    if (items.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-6 text-center text-xs text-muted-foreground">
                Belum ada client yang bisa dibagi.
            </p>
        );
    }

    return (
        <>
            <p className="mb-1 flex items-center gap-3 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                <span className="w-[5.5rem] shrink-0">{columnLabel}</span>
                <span className="min-w-0 flex-1" />
                <span className="w-7 shrink-0 text-right">Client</span>
                <span className="w-16 shrink-0 text-right">Nilai</span>
            </p>

            <ul className="flex flex-col">
                {items.map((item) => {
                    const on = active === item.key;
                    const share =
                        item.count === 0
                            ? 0
                            : Math.max(
                                  Math.round((item.count / widest) * 100),
                                  3,
                              );

                    return (
                        <li key={item.key}>
                            <button
                                type="button"
                                onClick={() => onPick(on ? null : item.key)}
                                aria-pressed={on}
                                className={cn(
                                    'group/share -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-1.5 text-left text-[0.8438rem] transition-colors',
                                    on
                                        ? 'bg-primary-soft'
                                        : 'hover:bg-neutral-soft',
                                )}
                            >
                                <span
                                    className={cn(
                                        'w-[5.5rem] shrink-0 truncate font-bold transition-colors',
                                        on
                                            ? 'text-primary-deep'
                                            : 'text-secondary-foreground group-hover/share:text-primary-deep',
                                    )}
                                >
                                    {item.label}
                                </span>

                                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-soft">
                                    <span
                                        className={cn(
                                            'block h-full rounded-full',
                                            on
                                                ? 'bg-primary-deep'
                                                : 'bg-primary',
                                        )}
                                        style={{ width: `${share}%` }}
                                    />
                                </span>

                                <span
                                    className={cn(
                                        'w-7 shrink-0 text-right font-extrabold',
                                        item.count === 0 &&
                                            'text-muted-foreground',
                                    )}
                                    data-numeric
                                >
                                    {item.count}
                                </span>

                                <span
                                    className="w-16 shrink-0 text-right text-xs text-muted-foreground"
                                    data-numeric
                                >
                                    {item.count > 0
                                        ? shortRupiah(item.value)
                                        : '—'}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
