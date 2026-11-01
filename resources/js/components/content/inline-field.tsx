import { router } from '@inertiajs/react';
import { Check, ChevronDown, Pencil, Plus } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toIso } from '@/data/content';
import { asDate } from '@/data/leads';
import { cn } from '@/lib/utils';
import { store as setField } from '@/routes/content/field';

/**
 * The record's own lines, editable where they stand.
 *
 * Reading a piece and correcting it used to be two screens: the pencil
 * swapped the whole record for its form, so the pillar nobody set cost a form
 * load, a hunt down the fields, and a save. This product's worth rests on the
 * data actually being filled in, which makes that round trip a standing risk
 * rather than a small inconvenience. Every line the panel shows is now its own
 * control, and each one writes exactly one field.
 *
 * Three kinds of question, three controls, and every one of them is a control
 * this app already uses: pick one of a set (the board's dropdown), pick
 * several (the form's channel toggles), write something (the form's fields).
 * The form is still the right tool for what it is best at — making a piece
 * from nothing, and changing six things in one sitting.
 *
 * At rest a line looks exactly like the fact it is; the affordance arrives on
 * hover, because eleven permanent chevrons down one column would turn a record
 * into a settings page. The exception is a line with nothing in it, which
 * advertises itself with a dashed invitation: those are the lines that most
 * need pressing, and they are what teaches the panel that its lines can be
 * pressed at all.
 */

/**
 * Escape has to mean the smaller thing first.
 *
 * The panel these lines live in listens for Escape on the document in the
 * capture phase, so a keystroke meant to abandon a half-typed line reaches the
 * panel before the line ever sees it, and the whole record closes over a
 * correction somebody was in the middle of making. The lines say when one of
 * them is open; the panel asks before it takes Escape as its own.
 */
const OpenLines = createContext<{ hold: () => () => void } | null>(null);

export const OpenLinesProvider = OpenLines.Provider;

/**
 * The panel's end of the arrangement: a tally it can read from inside an
 * event handler, and the token the lines take out while they are open.
 */
export function useOpenLines() {
    const openRef = useRef(0);

    return useMemo(
        () => ({
            holder: {
                hold: () => {
                    openRef.current += 1;

                    return () => {
                        openRef.current -= 1;
                    };
                },
            },
            holds: () => openRef.current > 0,
        }),
        [],
    );
}

function useHoldsEscape(active: boolean) {
    const lines = useContext(OpenLines);

    useEffect(
        () => (active && lines ? lines.hold() : undefined),
        [active, lines],
    );
}

/** The hours this team publishes at, the same five the form offers. */
const SLOTS = ['07:00', '09:00', '12:00', '17:00', '19:00'];

/** What a picker writes to clear a field: the server reads it as "not set". */
export const UNSET = '';

/**
 * Writes one field and keeps the panel where it is.
 *
 * The whole page comes back rather than the panel alone: a piece renamed or
 * rescheduled changes the calendar underneath it too, and the two disagreeing
 * for a beat is worse than one extra round trip on a screen nobody is typing
 * into.
 */
export function useFieldWriter(contentId: number) {
    const [pending, setPending] = useState<string | null>(null);

    const write = (
        field: string,
        value: string | string[],
        done?: () => void,
    ) => {
        router.post(
            setField(contentId).url,
            { field, value },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setPending(field),
                onFinish: () => setPending(null),
                onSuccess: () => done?.(),
                onError: (errors) =>
                    toast.error('Perubahan tidak tersimpan', {
                        description: errors.value ?? errors.field,
                    }),
            },
        );
    };

    return { write, pending };
}

/** The bed every editable line sits on: a fact at rest, a control on hover. */
function FieldTrigger({
    label,
    busy,
    quiet,
    className,
    children,
    ...props
}: ComponentProps<'button'> & {
    label: string;
    busy?: boolean;
    /** An empty line carries its own invitation, so it needs no chevron. */
    quiet?: boolean;
}) {
    return (
        <button
            type="button"
            aria-label={`Ubah ${label}`}
            className={cn(
                'group/field flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-neutral-soft data-[state=open]:bg-neutral-soft',
                busy && 'pointer-events-none opacity-55',
                className,
            )}
            {...props}
        >
            <span className="min-w-0 flex-1">{children}</span>
            {quiet ? null : (
                <ChevronDown
                    className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/field:opacity-100 group-focus-visible/field:opacity-100 group-data-[state=open]/field:opacity-100"
                    strokeWidth={2}
                    aria-hidden
                />
            )}
        </button>
    );
}

/** A line with nothing on it, asking to be filled. */
function Invite({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-input px-2 py-0.5 text-xs font-semibold text-muted-foreground transition-colors group-hover/field:border-primary/40 group-hover/field:text-primary-deep">
            <Plus className="size-3" strokeWidth={2.5} aria-hidden />
            {children}
        </span>
    );
}

export type Choice = {
    /** `UNSET` clears the field; the server reads it as "not decided". */
    value: string;
    label: string;
    /** A dot, an icon, an avatar: whatever the list is told apart by. */
    mark?: ReactNode;
};

/**
 * Pick one of a known set.
 *
 * The current choice is checked rather than disabled: a greyed-out row reads
 * as "unavailable", and the thing it names is the one thing that is certainly
 * true. Pressing it again is a no-op, which is what it should be.
 */
export function PickOne({
    label,
    heading,
    value,
    choices,
    busy,
    empty,
    onPick,
    children,
}: {
    label: string;
    /** Names the question inside the menu, e.g. "Pindah ke status". */
    heading: string;
    value: string;
    choices: Choice[];
    busy?: boolean;
    /** The words on the dashed invitation when nothing is set. */
    empty: string;
    onPick: (value: string) => void;
    /** How the value reads at rest; omitted when there is none. */
    children?: ReactNode;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <FieldTrigger label={label} busy={busy} quiet={!children}>
                    {children ?? <Invite>{empty}</Invite>}
                </FieldTrigger>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel className="text-xs">
                    {heading}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {choices.map((choice) => (
                    <DropdownMenuItem
                        key={choice.value || '__kosong__'}
                        className="gap-2"
                        onSelect={() =>
                            choice.value === value ? null : onPick(choice.value)
                        }
                    >
                        {choice.mark}
                        <span className="min-w-0 flex-1 truncate">
                            {choice.label}
                        </span>
                        {choice.value === value ? (
                            <Check
                                className="size-3.5 shrink-0"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                        ) : null}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Pick several, and write once.
 *
 * Ticking three boxes is one decision about the set, not three decisions about
 * three channels, so the write waits for the menu to close. The last tick
 * cannot be removed: a piece with no channel is not a plan.
 */
export function PickMany({
    label,
    heading,
    values,
    choices,
    busy,
    empty,
    onSave,
    children,
}: {
    label: string;
    heading: string;
    values: string[];
    choices: Choice[];
    busy?: boolean;
    empty: string;
    onSave: (values: string[]) => void;
    children?: ReactNode;
}) {
    const [draft, setDraft] = useState<string[] | null>(null);

    /* A save landing replaces the prop; the draft it came from is spent. */
    const [seen, setSeen] = useState(values);

    if (values !== seen) {
        setSeen(values);
        setDraft(null);
    }

    const shown = draft ?? values;

    const toggle = (key: string) => {
        if (shown.includes(key) && shown.length === 1) {
            toast.error('Konten tetap butuh satu channel', {
                description: 'Pilih channel penggantinya dulu.',
            });

            return;
        }

        setDraft(
            choices
                .map((choice) => choice.value)
                .filter((value) =>
                    shown.includes(value)
                        ? value !== key
                        : value === key || shown.includes(value),
                ),
        );
    };

    return (
        <DropdownMenu
            onOpenChange={(open) => {
                if (open || draft === null) {
                    return;
                }

                if (draft.join() !== values.join()) {
                    onSave(draft);

                    return;
                }

                setDraft(null);
            }}
        >
            <DropdownMenuTrigger asChild>
                <FieldTrigger label={label} busy={busy} quiet={!children}>
                    {children ?? <Invite>{empty}</Invite>}
                </FieldTrigger>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel className="text-xs">
                    {heading}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {choices.map((choice) => (
                    <DropdownMenuCheckboxItem
                        key={choice.value}
                        checked={shown.includes(choice.value)}
                        onCheckedChange={() => toggle(choice.value)}
                        onSelect={(event) => event.preventDefault()}
                        className="gap-2"
                    >
                        {choice.mark}
                        <span className="min-w-0 flex-1 truncate">
                            {choice.label}
                        </span>
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * The day and the hour, in one panel.
 *
 * They read as one line and they are one decision — when this goes out — but
 * they are two columns, so each writes on its own. The hour keeps the same
 * five slots the form offers, because a team that publishes at 09.00 should
 * not have to type it.
 */
export function PickSchedule({
    date,
    time,
    busy,
    onDate,
    onTime,
    children,
}: {
    date: string;
    time: string | null;
    busy?: boolean;
    onDate: (iso: string) => void;
    onTime: (time: string) => void;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <FieldTrigger label="jadwal tayang" busy={busy}>
                    {children}
                </FieldTrigger>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={asDate(date)}
                    defaultMonth={asDate(date)}
                    onSelect={(picked) => {
                        if (picked) {
                            onDate(toIso(picked));
                            setOpen(false);
                        }
                    }}
                    autoFocus
                    className="p-3"
                />

                <div className="border-t border-border p-3">
                    <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                        Jam tayang
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {SLOTS.map((slot) => (
                            <button
                                key={slot}
                                type="button"
                                onClick={() =>
                                    onTime(time === slot ? UNSET : slot)
                                }
                                aria-pressed={time === slot}
                                className={cn(
                                    'rounded-md border px-2 py-1 text-[0.6875rem] font-bold transition-colors',
                                    time === slot
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-card text-secondary-foreground hover:border-primary/35 hover:text-primary-deep',
                                )}
                                data-numeric
                            >
                                {slot.replace(':', '.')}
                            </button>
                        ))}

                        {/* Anything outside the five, and the way to any other. */}
                        <Input
                            type="time"
                            step={300}
                            value={time ?? ''}
                            onChange={(event) => onTime(event.target.value)}
                            aria-label="Jam lain"
                            className="h-8 w-28 text-xs"
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

/**
 * Write a short value in place: a link, a name, a line.
 *
 * Enter commits, Escape abandons, and leaving the field commits what is in it
 * — the same three keys every inline field in every tool answers to. A value
 * that did not change is never sent.
 */
export function WriteLine({
    label,
    value,
    placeholder,
    busy,
    empty,
    check,
    beside,
    className,
    inputClassName,
    onSave,
    children,
}: {
    label: string;
    value: string | null;
    placeholder?: string;
    busy?: boolean;
    empty: string;
    /** Client-side guard so a mistyped link never costs a round trip. */
    check?: (value: string) => string | undefined;
    /**
     * The value is already a control of its own — a link that people mean to
     * open — so the editor sits beside it rather than swallowing it. A button
     * wrapped around an anchor is both invalid and unopenable.
     */
    beside?: boolean;
    className?: string;
    inputClassName?: string;
    onSave: (value: string) => void;
    children?: ReactNode;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const abandoned = useRef(false);

    useHoldsEscape(editing);

    const commit = () => {
        if (abandoned.current) {
            abandoned.current = false;
            setEditing(false);

            return;
        }

        const next = draft.trim();

        if (next === (value ?? '')) {
            setEditing(false);

            return;
        }

        const complaint = next === '' ? undefined : check?.(next);

        if (complaint) {
            toast.error(complaint);

            return;
        }

        onSave(next);
        setEditing(false);
    };

    const start = () => {
        /* A cancel leaves its mark so the blur that follows it saves nothing.
           Clearing it here is what keeps that mark from outliving its own
           edit and swallowing the next one. */
        abandoned.current = false;
        setDraft(value ?? '');
        setEditing(true);
    };

    if (!editing && beside && children) {
        return (
            <span
                className={cn(
                    'group/field flex min-w-0 items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-neutral-soft',
                    busy && 'pointer-events-none opacity-55',
                    className,
                )}
            >
                <span className="min-w-0 flex-1">{children}</span>
                <button
                    type="button"
                    aria-label={`Ubah ${label}`}
                    onClick={start}
                    className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/field:opacity-100 focus-visible:opacity-100"
                >
                    <Pencil className="size-3.5" strokeWidth={2} aria-hidden />
                </button>
            </span>
        );
    }

    if (!editing) {
        return (
            <FieldTrigger
                label={label}
                busy={busy}
                quiet={!children}
                className={className}
                onClick={start}
            >
                {children ?? <Invite>{empty}</Invite>}
            </FieldTrigger>
        );
    }

    return (
        <Input
            autoFocus
            value={draft}
            placeholder={placeholder}
            aria-label={label}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    commit();
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    abandoned.current = true;
                    setEditing(false);
                }
            }}
            className={cn('h-8 text-[0.8438rem]', inputClassName)}
        />
    );
}

/**
 * Write the prose: the brief that asked for the piece, the copy that goes out.
 *
 * Enter is a newline here, so the commit is a button. The box that displays it
 * is the box that edits it — a paragraph that jumps into a dialog to be
 * corrected is how a typo survives.
 */
export function WriteProse({
    label,
    value,
    placeholder,
    hover,
    busy,
    rows = 6,
    onSave,
    children,
}: {
    label: string;
    value: string | null;
    placeholder: string;
    /** The tint the resting box takes on hover; each bed needs its own. */
    hover: string;
    busy?: boolean;
    rows?: number;
    onSave: (value: string) => void;
    children: ReactNode;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    useHoldsEscape(editing);

    const commit = () => {
        const next = draft.trim();

        if (next !== (value ?? '')) {
            onSave(next);
        }

        setEditing(false);
    };

    if (editing) {
        return (
            <div className="mt-1.5">
                <Textarea
                    autoFocus
                    rows={rows}
                    value={draft}
                    placeholder={placeholder}
                    aria-label={label}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setEditing(false);
                        }

                        if (
                            event.key === 'Enter' &&
                            (event.metaKey || event.ctrlKey)
                        ) {
                            event.preventDefault();
                            commit();
                        }
                    }}
                    className="text-[0.8438rem] leading-relaxed"
                />

                <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" onClick={commit}>
                        Simpan
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(false)}
                    >
                        Batal
                    </Button>
                    <span className="ml-auto text-[0.6875rem] text-muted-foreground">
                        Esc batal
                    </span>
                </div>
            </div>
        );
    }

    return (
        <button
            type="button"
            aria-label={`Ubah ${label}`}
            disabled={busy}
            onClick={() => {
                setDraft(value ?? '');
                setEditing(true);
            }}
            className={cn(
                'group/prose relative mt-1.5 block w-full rounded-md px-2 py-1.5 text-left transition-colors',
                hover,
                busy && 'pointer-events-none opacity-55',
            )}
        >
            {children}
            <Pencil
                className="absolute top-1.5 right-1.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/prose:opacity-100 group-focus-visible/prose:opacity-100"
                strokeWidth={2}
                aria-hidden
            />
        </button>
    );
}
