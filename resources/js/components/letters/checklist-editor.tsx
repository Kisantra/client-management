import { router } from '@inertiajs/react';
import { Check, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/leads/form-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { entryDate } from '@/data/leads';
import type {
    DocumentTypeGroup,
    LetterField,
    RequestedDocument,
} from '@/data/letters';
import { cn } from '@/lib/utils';
import {
    destroy as destroyDocument,
    receive as receiveDocument,
    store as storeDocument,
    update as updateDocument,
} from '@/routes/letters/documents';

/**
 * The documents a letter asks the client for, one row each.
 *
 * While the letter is a draft the list is part of its words: rows are
 * picked from the office's list or typed, annotated, and removed. Once it
 * is issued the list is fixed, and what is left to do is tick off each
 * document as it arrives — which is recorded, but never reopens the letter.
 */
export function ChecklistEditor({
    letterId,
    field,
    items,
    groups,
    editable,
    trackable,
    asAttachment,
    error,
    beforeVisit,
}: {
    letterId: number;
    field: LetterField;
    items: RequestedDocument[];
    groups: DocumentTypeGroup[];
    /** Rows can be added, annotated and removed. */
    editable: boolean;
    /** Rows can be ticked as received. */
    trackable: boolean;
    /** Printed as a LAMPIRAN page rather than inside the body. */
    asAttachment: boolean;
    error?: string;
    /** Lets the page save its pending draft before this list writes. */
    beforeVisit: (go: () => void) => void;
}) {
    const received = items.filter((item) => item.receivedAt).length;

    const visit = (
        method: 'post' | 'patch' | 'delete',
        url: string,
        data: Record<string, string | number | null> = {},
        onSuccess?: () => void,
    ) =>
        beforeVisit(() =>
            router.visit(url, {
                method,
                data,
                preserveScroll: true,
                preserveState: true,
                onSuccess,
                onError: (errors) =>
                    toast.error('Belum bisa disimpan', {
                        description: Object.values(errors)[0],
                    }),
            }),
        );

    const add = (
        payload: { type_id?: number; name?: string },
        done?: () => void,
    ) =>
        visit(
            'post',
            storeDocument(letterId).url,
            { field: field.key, ...payload },
            done,
        );

    return (
        <Field
            id={`checklist-${field.key}`}
            label={field.label}
            hint={
                field.help ??
                (asAttachment
                    ? 'Dicetak sebagai tabel di halaman Lampiran.'
                    : undefined)
            }
            error={error}
            optional={!field.required}
        >
            <div className="rounded-lg border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                        {trackable && items.length > 0 ? (
                            <>
                                <span
                                    className="font-extrabold text-foreground"
                                    data-numeric
                                >
                                    {received}
                                </span>{' '}
                                dari <span data-numeric>{items.length}</span>{' '}
                                dokumen diterima
                            </>
                        ) : (
                            <>
                                <span
                                    className="font-extrabold text-foreground"
                                    data-numeric
                                >
                                    {items.length}
                                </span>{' '}
                                dokumen diminta
                            </>
                        )}
                    </span>
                    {editable ? (
                        <DocumentPicker
                            id={`checklist-${field.key}`}
                            groups={groups}
                            taken={items}
                            onPick={add}
                        />
                    ) : null}
                </div>

                {items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Belum ada dokumen. Pilih dari daftar kantor atau ketik
                        sendiri.
                    </p>
                ) : (
                    <ol className="divide-y divide-border">
                        {items.map((item, n) => (
                            <ChecklistRow
                                key={item.id}
                                number={n + 1}
                                item={item}
                                editable={editable}
                                trackable={trackable}
                                onNote={(note) =>
                                    visit(
                                        'patch',
                                        updateDocument([letterId, item.id]).url,
                                        { note },
                                    )
                                }
                                onRemove={() =>
                                    visit(
                                        'delete',
                                        destroyDocument([letterId, item.id])
                                            .url,
                                    )
                                }
                                onReceive={() =>
                                    visit(
                                        'post',
                                        receiveDocument([letterId, item.id])
                                            .url,
                                    )
                                }
                            />
                        ))}
                    </ol>
                )}
            </div>
        </Field>
    );
}

function ChecklistRow({
    number,
    item,
    editable,
    trackable,
    onNote,
    onRemove,
    onReceive,
}: {
    number: number;
    item: RequestedDocument;
    editable: boolean;
    trackable: boolean;
    onNote: (note: string) => void;
    onRemove: () => void;
    onReceive: () => void;
}) {
    const [note, setNote] = useState(item.note ?? '');

    return (
        <li className="flex items-start gap-3 px-3 py-2.5">
            {trackable ? (
                <Checkbox
                    checked={item.receivedAt !== null}
                    onCheckedChange={onReceive}
                    className="mt-0.5"
                    aria-label={`${item.name} sudah diterima`}
                />
            ) : (
                <span
                    className="mt-0.5 w-4 shrink-0 text-right text-xs font-bold text-muted-foreground"
                    data-numeric
                >
                    {number}.
                </span>
            )}

            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        'text-[0.8438rem] font-bold',
                        item.receivedAt &&
                            'text-muted-foreground line-through decoration-1',
                    )}
                >
                    {item.name}
                </p>

                {editable ? (
                    <Input
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        onBlur={() => {
                            if (note.trim() !== (item.note ?? '')) {
                                onNote(note);
                            }
                        }}
                        placeholder={
                            item.description ??
                            'Rincian, mis. Januari–Desember 2025'
                        }
                        className="mt-1.5 h-8 text-xs"
                        aria-label={`Rincian ${item.name}`}
                    />
                ) : item.note || item.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.note ?? item.description}
                    </p>
                ) : null}

                {item.receivedAt ? (
                    <p className="mt-0.5 text-xs text-primary-deep">
                        Diterima {entryDate(item.receivedAt)}
                        {item.receivedBy ? ` · ${item.receivedBy}` : ''}
                    </p>
                ) : null}
            </div>

            {editable ? (
                <button
                    type="button"
                    onClick={onRemove}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                    aria-label={`Hapus ${item.name}`}
                >
                    <X className="size-3.5" strokeWidth={2.5} />
                </button>
            ) : null}
        </li>
    );
}

/** The office's document list, searchable, with a way out for anything not on it. */
function DocumentPicker({
    id,
    groups,
    taken,
    onPick,
}: {
    id: string;
    groups: DocumentTypeGroup[];
    taken: RequestedDocument[];
    onPick: (
        payload: { type_id?: number; name?: string },
        done?: () => void,
    ) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const takenIds = new Set(taken.map((item) => item.typeId));
    const takenNames = new Set(taken.map((item) => item.name.toLowerCase()));
    const needle = query.trim().toLowerCase();
    const shown = groups
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) => !needle || item.name.toLowerCase().includes(needle),
            ),
        }))
        .filter((group) => group.items.length > 0);
    const typed = query.trim();
    const canAddTyped =
        typed.length >= 2 && !takenNames.has(typed.toLowerCase());

    const close = () => {
        setOpen(false);
        setQuery('');
    };

    return (
        <Popover
            open={open}
            onOpenChange={(next) => (next ? setOpen(true) : close())}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    id={`${id}-add`}
                >
                    <Plus strokeWidth={2.5} aria-hidden />
                    Tambah dokumen
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-[min(26rem,calc(100vw-2rem))] p-0"
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
                        onKeyDown={(event) => {
                            if (
                                event.key === 'Enter' &&
                                canAddTyped &&
                                shown.length === 0
                            ) {
                                event.preventDefault();
                                onPick({ name: typed }, close);
                            }
                        }}
                        placeholder="Cari atau ketik nama dokumen"
                        className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        autoFocus
                    />
                </div>

                <div className="max-h-80 overflow-y-auto p-1">
                    {shown.map((group) => (
                        <div key={group.key} className="pb-1">
                            <p className="px-2.5 pt-2 pb-1 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                {group.label}
                            </p>
                            <ul>
                                {group.items.map((item) => {
                                    const isTaken =
                                        takenIds.has(item.id) ||
                                        takenNames.has(item.name.toLowerCase());

                                    return (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                disabled={isTaken}
                                                onClick={() =>
                                                    onPick({ type_id: item.id })
                                                }
                                                className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-neutral-soft disabled:cursor-default disabled:hover:bg-transparent"
                                            >
                                                <span
                                                    className={cn(
                                                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border',
                                                        isTaken
                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                            : 'border-input',
                                                    )}
                                                    aria-hidden
                                                >
                                                    {isTaken ? (
                                                        <Check
                                                            className="size-3"
                                                            strokeWidth={3}
                                                        />
                                                    ) : null}
                                                </span>
                                                <span className="min-w-0">
                                                    <span
                                                        className={cn(
                                                            'block',
                                                            isTaken &&
                                                                'text-muted-foreground',
                                                        )}
                                                    >
                                                        {item.name}
                                                    </span>
                                                    {item.description ? (
                                                        <span className="block text-xs text-muted-foreground">
                                                            {item.description}
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}

                    {shown.length === 0 && !canAddTyped ? (
                        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                            {groups.length === 0
                                ? 'Daftar dokumen kantor masih kosong. Ketik nama dokumennya.'
                                : 'Tidak ada yang cocok.'}
                        </p>
                    ) : null}
                </div>

                {canAddTyped ? (
                    <div className="border-t border-border p-1">
                        <button
                            type="button"
                            onClick={() => onPick({ name: typed }, close)}
                            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-bold text-primary-deep transition-colors hover:bg-primary-soft"
                        >
                            <Plus
                                className="size-4 shrink-0"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            <span className="truncate">
                                Tambahkan &quot;{typed}&quot;
                            </span>
                        </button>
                    </div>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}
