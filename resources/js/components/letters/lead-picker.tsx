import { Link } from '@inertiajs/react';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { STAGE_DOT } from '@/components/leads/stage-mark';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { LeadOption } from '@/data/letters';
import { useStageLabels } from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { create as leadsCreate } from '@/routes/leads';

/**
 * Who the letter goes to, found by typing.
 *
 * A select of every lead on the books is a list of hundreds; this is a
 * search box that narrows it, with the stage beside each name so a letter
 * is not sent to a prospect when a client of the same name was meant.
 */
export function LeadPicker({
    id,
    leads,
    value,
    onChange,
}: {
    id: string;
    leads: LeadOption[];
    value: number | null;
    onChange: (id: number) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const labels = useStageLabels();

    const picked = leads.find((lead) => lead.id === value) ?? null;
    const needle = query.trim().toLowerCase();
    const shown = (
        needle
            ? leads.filter(
                  (lead) =>
                      lead.name.toLowerCase().includes(needle) ||
                      lead.pic.toLowerCase().includes(needle),
              )
            : leads
    ).slice(0, 60);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    id={id}
                    role="combobox"
                    aria-expanded={open}
                    className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    {picked ? (
                        <span className="flex min-w-0 items-center gap-2">
                            <span
                                className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    STAGE_DOT[picked.stage],
                                )}
                                aria-hidden
                            />
                            <span className="truncate font-bold">
                                {picked.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                {picked.pic}
                            </span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">
                            Cari nama client atau PIC…
                        </span>
                    )}
                    <ChevronsUpDown
                        className="size-4 shrink-0 text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
            >
                <div className="flex items-center gap-2 border-b border-border px-3">
                    <Search
                        className="size-4 shrink-0 text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                    />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Ketik untuk mencari"
                        className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        autoFocus
                    />
                </div>
                <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
                    {shown.length === 0 ? (
                        <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                            {needle
                                ? `Tidak ada lead aktif bernama "${query.trim()}".`
                                : 'Belum ada lead aktif.'}
                        </li>
                    ) : (
                        shown.map((lead) => {
                            const active = lead.id === value;

                            return (
                                <li
                                    key={lead.id}
                                    role="option"
                                    aria-selected={active}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(lead.id);
                                            setOpen(false);
                                            setQuery('');
                                        }}
                                        className={cn(
                                            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-neutral-soft',
                                            active && 'bg-primary-soft',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'size-2 shrink-0 rounded-full',
                                                STAGE_DOT[lead.stage],
                                            )}
                                            aria-hidden
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-bold">
                                                {lead.name}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {lead.pic} · {lead.service} ·{' '}
                                                {labels[lead.stage] ??
                                                    lead.stage}
                                            </span>
                                        </span>
                                        {active ? (
                                            <Check
                                                className="size-4 shrink-0 text-primary-deep"
                                                strokeWidth={2.5}
                                                aria-hidden
                                            />
                                        ) : null}
                                    </button>
                                </li>
                            );
                        })
                    )}
                </ul>
                {/* Not on the books yet: the lead form, which comes back
                    here with the new client already chosen. */}
                <div className="border-t border-border p-1">
                    <Link
                        href={leadsCreate({ query: { lanjut: 'surat' } })}
                        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-bold text-primary-deep transition-colors hover:bg-primary-soft"
                    >
                        <Plus
                            className="size-4 shrink-0"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                        Tambah client baru
                        {needle ? (
                            <span className="truncate font-normal text-muted-foreground">
                                · &quot;{query.trim()}&quot;
                            </span>
                        ) : null}
                    </Link>
                </div>
            </PopoverContent>
        </Popover>
    );
}
