import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * The project a letter is about, typed or picked.
 *
 * Projects are not records here, so anything may be typed; the list under
 * the field is only the office's services and what earlier letters used,
 * so the common names are one click away and spelled the same every time.
 */
export function ProjectPicker({
    id,
    value,
    suggestions,
    onChange,
    disabled = false,
}: {
    id: string;
    value: string;
    suggestions: string[];
    onChange: (next: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);

    const needle = value.trim().toLowerCase();
    const shown = (
        needle
            ? suggestions.filter((name) => name.toLowerCase().includes(needle))
            : suggestions
    ).slice(0, 40);

    const pick = (name: string) => {
        onChange(name);
        setOpen(false);
    };

    return (
        <Popover open={open && !disabled} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div className="relative">
                    <Input
                        id={id}
                        role="combobox"
                        aria-expanded={open}
                        aria-autocomplete="list"
                        autoComplete="off"
                        value={value}
                        onChange={(event) => {
                            onChange(event.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setOpen(false);
                            }
                        }}
                        placeholder="Pilih atau ketik nama proyek"
                        disabled={disabled}
                        className="pr-16"
                    />
                    <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5">
                        {value && !disabled ? (
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                                aria-label="Kosongkan proyek"
                            >
                                <X className="size-3.5" strokeWidth={2.5} />
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setOpen(!open)}
                            disabled={disabled}
                            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                            aria-label="Tampilkan daftar proyek"
                            tabIndex={-1}
                        >
                            <ChevronsUpDown
                                className="size-4"
                                strokeWidth={2}
                            />
                        </button>
                    </span>
                </div>
            </PopoverAnchor>
            <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-1"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onInteractOutside={(event) => {
                    if (
                        event.target instanceof Node &&
                        document
                            .getElementById(id)
                            ?.parentElement?.contains(event.target)
                    ) {
                        event.preventDefault();
                    }
                }}
            >
                <ul className="max-h-64 overflow-y-auto" role="listbox">
                    {shown.length === 0 ? (
                        <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                            Tidak ada di daftar. &quot;{value.trim()}&quot;
                            dipakai apa adanya.
                        </li>
                    ) : (
                        shown.map((name) => {
                            const active =
                                name.toLowerCase() ===
                                value.trim().toLowerCase();

                            return (
                                <li
                                    key={name}
                                    role="option"
                                    aria-selected={active}
                                >
                                    <button
                                        type="button"
                                        onClick={() => pick(name)}
                                        className={cn(
                                            'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-neutral-soft',
                                            active &&
                                                'bg-primary-soft font-bold text-primary-deep',
                                        )}
                                    >
                                        <span className="truncate">{name}</span>
                                        {active ? (
                                            <Check
                                                className="size-4 shrink-0"
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
            </PopoverContent>
        </Popover>
    );
}
