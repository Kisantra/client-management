import { router } from '@inertiajs/react';
import { ChevronDown, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { store as setField } from '@/routes/content/field';

/** What one field carries: a word, a set of them, or a day and an hour. */
export type FieldValue = string | string[] | { date: string; time: string };

/**
 * The one write behind every field on the record, and the states it passes
 * through on the way.
 *
 * `preserveState` keeps the panel open and whatever is half-typed in it; the
 * props still come back fresh, so the line being changed redraws with what the
 * server actually stored rather than with what was asked for.
 */
export function useFieldSave(contentId: number) {
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    const save = (field: string, value: FieldValue, onSaved?: () => void) => {
        router.post(
            setField(contentId).url,
            { field, value },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => {
                    setSaving(true);
                    setFailed(null);
                },
                onFinish: () => setSaving(false),
                onSuccess: () => onSaved?.(),
                onError: (errors) =>
                    setFailed(
                        Object.values(errors)[0] ??
                            'Perubahan tidak bisa disimpan.',
                    ),
            },
        );
    };

    return { save, saving, failed, forget: () => setFailed(null) };
}

/**
 * The beat that says a change landed here.
 *
 * Tracked against the last value rather than fired when the request goes out,
 * so it belongs to the change itself and never to one the server refused.
 * Arrays and pairs come in written out, which is enough to tell two of them
 * apart.
 */
export function useLanded(value: string) {
    const [was, setWas] = useState(value);
    const [landed, setLanded] = useState(false);

    if (value !== was) {
        setWas(value);
        setLanded(true);
    }

    return { landed, settled: () => setLanded(false) };
}

/**
 * The look of a value you can change.
 *
 * Two shapes, because the record's values have two: a chip that already
 * carries a fill of its own, and a plain zone around text, a face, a link or a
 * row of chips. The constant across both is the chevron and the teal that
 * answers a pointer — the shape follows the value rather than flattening nine
 * different facts into nine identical pills.
 *
 * A zone rests with no outline at all. Eight hairline boxes stacked down the
 * record would make a form of something whose first job is to be read.
 */
export function fieldTrigger({
    shape,
    empty = false,
    landed = false,
}: {
    shape: 'chip' | 'zone';
    empty?: boolean;
    landed?: boolean;
}) {
    return cn(
        'group/field inline-flex cursor-pointer items-center gap-1.5 border border-transparent text-left ring-1 outline-none',
        'transition-[background-color,color,box-shadow] duration-200 ease-out',
        'hover:ring-primary/45 focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:ring-2 data-[state=open]:ring-primary/55',
        'disabled:cursor-progress',
        shape === 'chip'
            ? cn(
                  'rounded-full py-1 pr-1.5 pl-2.5 text-xs font-bold whitespace-nowrap',
                  empty ? 'ring-foreground/10' : 'ring-foreground/12',
              )
            : cn(
                  '-mx-1.5 min-w-0 rounded-md px-1.5 py-1 ring-transparent',
                  'hover:bg-neutral-soft data-[state=open]:bg-neutral-soft data-[state=open]:ring-primary/55',
              ),
        empty && 'font-semibold text-muted-foreground',
        landed && 'animate-field-landed',
    );
}

/** The mark that says this opens — or, mid-write, that it is being saved. */
export function FieldChevron({ saving = false }: { saving?: boolean }) {
    if (saving) {
        return (
            <LoaderCircle
                className="size-3.5 shrink-0 animate-spin opacity-70"
                strokeWidth={2.5}
                aria-hidden
            />
        );
    }

    return (
        <ChevronDown
            className="size-3.5 shrink-0 opacity-45 transition-[rotate,opacity] duration-200 ease-out group-hover/field:opacity-100 group-data-[state=open]/field:rotate-180 group-data-[state=open]/field:opacity-100"
            strokeWidth={2.5}
            aria-hidden
        />
    );
}

/** Why the change did not take, under the field that would not take it. */
export function FieldError({ message }: { message: string | null }) {
    if (!message) {
        return null;
    }

    return (
        <span className="flex items-start gap-1.5 text-[0.6875rem] leading-snug font-semibold text-destructive">
            <TriangleAlert
                className="mt-px size-3 shrink-0"
                strokeWidth={2.5}
                aria-hidden
            />
            {message}
        </span>
    );
}

/** One field's cell: the control, and whatever it has to say underneath. */
export function FieldStack({ children }: { children: React.ReactNode }) {
    return (
        <span className="flex min-w-0 flex-col items-start gap-1.5">
            {children}
        </span>
    );
}

/** The heading over a list of options, in the app's own small-caps voice. */
export function MenuHeading({ children }: { children: React.ReactNode }) {
    return (
        <span className="block px-2 pt-0.5 pb-1.5 text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
            {children}
        </span>
    );
}
