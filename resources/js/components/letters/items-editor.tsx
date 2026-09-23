import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { rupiah } from '@/data/leads';
import { digits, sumSections, thousands } from '@/data/letters';
import type { ItemSection } from '@/data/letters';
import { cn } from '@/lib/utils';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * The fee table, edited as it prints: lettered sections, numbered rows,
 * and a total the writer never types.
 */
export function ItemsEditor({
    id,
    value,
    onChange,
    disabled = false,
}: {
    id: string;
    value: ItemSection[];
    onChange: (next: ItemSection[]) => void;
    disabled?: boolean;
}) {
    const patchSection = (index: number, patch: Partial<ItemSection>) =>
        onChange(
            value.map((section, i) =>
                i === index ? { ...section, ...patch } : section,
            ),
        );

    const patchRow = (
        sectionIndex: number,
        rowIndex: number,
        patch: Partial<ItemSection['rows'][number]>,
    ) =>
        patchSection(sectionIndex, {
            rows: value[sectionIndex].rows.map((row, i) =>
                i === rowIndex ? { ...row, ...patch } : row,
            ),
        });

    const total = sumSections(value);

    return (
        <div className="flex flex-col gap-3">
            {value.map((section, s) => (
                <fieldset
                    key={s}
                    className="rounded-lg border border-border bg-neutral-soft/50 p-3"
                    disabled={disabled}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className="grid size-7 shrink-0 place-items-center rounded-md bg-primary-soft text-xs font-extrabold text-primary-deep"
                            aria-hidden
                        >
                            {LETTERS[s] ?? s + 1}
                        </span>
                        <Input
                            id={s === 0 ? id : `${id}-${s}`}
                            value={section.title}
                            onChange={(event) =>
                                patchSection(s, { title: event.target.value })
                            }
                            placeholder="Nama jasa, mis. Pendampingan SP2DK"
                            className="bg-card font-bold"
                            aria-label={`Judul bagian ${LETTERS[s] ?? s + 1}`}
                        />
                        <IconButton
                            label="Hapus bagian"
                            onClick={() =>
                                onChange(value.filter((_, i) => i !== s))
                            }
                            disabled={disabled}
                        >
                            <Trash2 className="size-3.5" strokeWidth={2} />
                        </IconButton>
                    </div>

                    <ol className="mt-2.5 flex flex-col gap-1.5">
                        {section.rows.map((row, r) => (
                            <li
                                key={r}
                                className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 sm:grid-cols-[1.5rem_1fr_9.5rem_auto]"
                            >
                                <span
                                    className="text-center text-xs font-bold text-muted-foreground"
                                    data-numeric
                                    aria-hidden
                                >
                                    {r + 1}
                                </span>
                                <Input
                                    value={row.name}
                                    onChange={(event) =>
                                        patchRow(s, r, {
                                            name: event.target.value,
                                        })
                                    }
                                    placeholder="Keterangan"
                                    className="bg-card"
                                    aria-label={`Keterangan baris ${r + 1}`}
                                />
                                <div className="relative col-span-2 sm:col-span-1">
                                    <span
                                        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-bold text-muted-foreground"
                                        aria-hidden
                                    >
                                        Rp
                                    </span>
                                    <Input
                                        inputMode="numeric"
                                        value={
                                            row.amount
                                                ? thousands(row.amount)
                                                : ''
                                        }
                                        onChange={(event) =>
                                            patchRow(s, r, {
                                                amount: digits(
                                                    event.target.value,
                                                ),
                                            })
                                        }
                                        placeholder="0"
                                        className="bg-card pl-9 text-right"
                                        aria-label={`Biaya baris ${r + 1}`}
                                        data-numeric
                                    />
                                </div>
                                <IconButton
                                    label="Hapus baris"
                                    onClick={() =>
                                        patchSection(s, {
                                            rows: section.rows.filter(
                                                (_, i) => i !== r,
                                            ),
                                        })
                                    }
                                    disabled={disabled}
                                    className="col-start-3 row-start-1 sm:col-start-4"
                                >
                                    <Trash2
                                        className="size-3.5"
                                        strokeWidth={2}
                                    />
                                </IconButton>
                            </li>
                        ))}
                    </ol>

                    <button
                        type="button"
                        onClick={() =>
                            patchSection(s, {
                                rows: [
                                    ...section.rows,
                                    { name: '', amount: 0 },
                                ],
                            })
                        }
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold text-primary-deep transition-colors hover:bg-primary-soft disabled:opacity-50"
                        disabled={disabled}
                    >
                        <Plus
                            className="size-3.5"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                        Tambah baris
                    </button>
                </fieldset>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() =>
                        onChange([
                            ...value,
                            { title: '', rows: [{ name: '', amount: 0 }] },
                        ])
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-3 py-2 text-[0.8438rem] font-bold text-primary-deep transition-colors hover:bg-accent disabled:opacity-50"
                    disabled={disabled}
                >
                    <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
                    Tambah bagian
                </button>
                <p className="text-xs text-muted-foreground">
                    Total{' '}
                    <span
                        className="font-extrabold text-foreground"
                        data-numeric
                    >
                        {rupiah.format(total)}
                    </span>
                </p>
            </div>
        </div>
    );
}

function IconButton({
    label,
    onClick,
    disabled,
    className,
    children,
}: {
    label: string;
    onClick: () => void;
    disabled: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive disabled:opacity-40',
                className,
            )}
        >
            {children}
            <span className="sr-only">{label}</span>
        </button>
    );
}
