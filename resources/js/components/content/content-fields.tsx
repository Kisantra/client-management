import { usePage } from '@inertiajs/react';
import { Check, ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import {
    FieldChevron,
    FieldError,
    FieldStack,
    MenuHeading,
    fieldTrigger,
    useFieldSave,
    useLanded,
} from '@/components/content/field-control';
import { ReleasedList } from '@/components/content/link-picker';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { ContentDetail } from '@/data/content';
import { SLOTS, timeLabel, toIso } from '@/data/content';
import { CHANNEL_LABELS } from '@/data/dashboard';
import type { ChannelKey } from '@/data/dashboard';
import { asDate, longDate } from '@/data/leads';
import { useContentPlan } from '@/hooks/use-content-plan';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types/shared';

/*
 | Every line of the record, as the thing that changes it.
 |
 | The panel used to read a piece and send you elsewhere to change it: nine
 | fields opened to correct one, the record you were reading replaced by a form,
 | and the calendar behind it covered twice over. Correcting an hour is not
 | editing a piece of content and should not cost the same.
 |
 | So each line is its own control, in the shape the value already has: a chip
 | stays a chip, a date stays a date, a row of channel marks stays a row of
 | channel marks. What they share is the chevron that says a line opens, the
 | teal that answers a pointer, and the beat that says the change landed.
 |
 | Judul, brief and text copy are deliberately not here. They are long-form, and
 | a paragraph typed into a popover that closes on a stray click is a worse
 | offer than the form that holds it — the pencil in the toolbar still opens
 | that form, and it is the right door for them.
 */

/** The chip fill for values that are already chips on the record. */
const NEUTRAL_CHIP = 'bg-neutral-soft text-secondary-foreground';

/* ─────────────────────────────  Jadwal tayang  ───────────────────────────── */

/**
 * The day, and the hour when somebody has settled on one.
 *
 * One control for both: sent apart, a cleared hour and a moved day would be two
 * writes and two lines in the log for what was one decision. The five hours the
 * team actually publishes at sit under the calendar as one press each.
 */
export function ScheduleField({ content }: { content: ContentDetail }) {
    const { save, saving, failed, forget } = useFieldSave(content.id);
    const { landed, settled } = useLanded(
        `${content.scheduledFor}|${content.scheduledTime ?? ''}`,
    );

    const [open, setOpen] = useState(false);
    const [date, setDate] = useState(() => asDate(content.scheduledFor));
    const [time, setTime] = useState(content.scheduledTime ?? '');

    const start = (next: boolean) => {
        /* Opening always starts from what is stored, never from an edit that
           was abandoned last time. */
        if (next) {
            setDate(asDate(content.scheduledFor));
            setTime(content.scheduledTime ?? '');
            forget();
        }

        setOpen(next);
    };

    return (
        <FieldStack>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <Popover open={open} onOpenChange={start}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            disabled={saving}
                            onAnimationEnd={settled}
                            aria-label={`Jadwal tayang ${longDate(content.scheduledFor)}, ubah`}
                            className={fieldTrigger({ shape: 'zone', landed })}
                        >
                            <span data-numeric>
                                {longDate(content.scheduledFor)}
                                {content.scheduledTime
                                    ? `, ${timeLabel(content.scheduledTime)}`
                                    : ''}
                            </span>
                            <FieldChevron saving={saving} />
                        </button>
                    </PopoverTrigger>

                    <PopoverContent
                        align="start"
                        collisionPadding={12}
                        className="w-auto p-0"
                    >
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(picked) => picked && setDate(picked)}
                            defaultMonth={date}
                            autoFocus
                            className="p-3"
                        />

                        <div className="border-t border-border px-3 py-2.5">
                            <span className="flex items-center gap-2">
                                <Input
                                    type="time"
                                    step={300}
                                    value={time}
                                    onChange={(event) =>
                                        setTime(event.target.value)
                                    }
                                    aria-label="Jam tayang"
                                    className="h-8 w-[7.5rem] text-[0.8438rem]"
                                />
                                {SLOTS.map((slot) => (
                                    <button
                                        key={slot}
                                        type="button"
                                        onClick={() =>
                                            setTime(time === slot ? '' : slot)
                                        }
                                        aria-pressed={time === slot}
                                        className={cn(
                                            'rounded-md border px-1.5 py-1 text-[0.6875rem] font-bold transition-colors',
                                            time === slot
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border bg-card text-secondary-foreground hover:border-primary/35 hover:text-primary-deep',
                                        )}
                                        data-numeric
                                    >
                                        {slot.replace(':', '.')}
                                    </button>
                                ))}
                            </span>
                            <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                                Jam boleh dikosongkan; dipakai untuk mengurutkan
                                konten di hari yang sama.
                            </p>
                        </div>

                        <Footer
                            saving={saving}
                            onCancel={() => setOpen(false)}
                            onSave={() =>
                                save(
                                    'schedule',
                                    { date: toIso(date), time },
                                    () => setOpen(false),
                                )
                            }
                        />
                    </PopoverContent>
                </Popover>

                {/* Not editable, and not the same fact: when it actually went
                    out, against the day it was meant to. */}
                {content.publishedAt &&
                content.publishedAt !== content.scheduledFor ? (
                    <span
                        className="text-xs font-normal text-muted-foreground"
                        data-numeric
                    >
                        tayang {longDate(content.publishedAt)}
                    </span>
                ) : content.publishedAt ? (
                    <span className="text-xs font-normal text-muted-foreground">
                        tayang tepat waktu
                    </span>
                ) : null}
            </span>

            <FieldError message={failed} />
        </FieldStack>
    );
}

/* ───────────────────────────────  Channel  ──────────────────────────────── */

/**
 * Where the piece goes out, all of it at once.
 *
 * The set is one decision, so it is written once, when the menu closes, rather
 * than a line in the log for every tick. The last channel cannot be unticked:
 * a piece with nowhere to go is not a state the calendar can draw.
 */
export function ChannelField({ content }: { content: ContentDetail }) {
    const { channels } = useContentPlan();
    const { save, saving, failed, forget } = useFieldSave(content.id);
    const { landed, settled } = useLanded(content.channels.join('|'));

    const [open, setOpen] = useState(false);
    const [picked, setPicked] = useState<ChannelKey[]>(content.channels);

    const start = (next: boolean) => {
        if (next) {
            setPicked(content.channels);
            forget();
        } else if (picked.join('|') !== content.channels.join('|')) {
            save('channels', picked);
        }

        setOpen(next);
    };

    /* Ticking keeps the order they were ticked in, so the first channel chosen
       stays the one the calendar draws the piece as. */
    const toggle = (key: ChannelKey) =>
        setPicked((current) =>
            current.includes(key)
                ? current.filter((item) => item !== key)
                : [...current, key],
        );

    return (
        <FieldStack>
            <DropdownMenu open={open} onOpenChange={start}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={saving}
                        onAnimationEnd={settled}
                        aria-label={`Channel: ${content.channels.map((key) => CHANNEL_LABELS[key]).join(', ')}. Ubah`}
                        className={cn(
                            fieldTrigger({ shape: 'zone', landed }),
                            'flex-wrap gap-y-1.5',
                        )}
                    >
                        {content.channels.map((channel) => (
                            <span
                                key={channel}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs font-bold',
                                    CHANNEL_TONE[channel].filled,
                                )}
                            >
                                <ChannelIcon channel={channel} />
                                {CHANNEL_LABELS[channel]}
                            </span>
                        ))}
                        <FieldChevron saving={saving} />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                    className="w-[min(15rem,calc(100vw-2rem))] p-1.5"
                >
                    <MenuHeading>Tayang di</MenuHeading>

                    {Object.entries(channels).map(([key, label]) => {
                        const channel = key as ChannelKey;
                        const on = picked.includes(channel);
                        const last = on && picked.length === 1;

                        return (
                            <DropdownMenuItem
                                key={key}
                                disabled={last}
                                onSelect={(event) => {
                                    // Ticking a set means staying open for the
                                    // next tick.
                                    event.preventDefault();
                                    toggle(channel);
                                }}
                                className={cn(
                                    'gap-2.5 rounded-md px-2 py-1.5 text-[0.8438rem] font-semibold',
                                    last && 'data-[disabled]:opacity-100',
                                )}
                            >
                                <span
                                    className={cn(
                                        'grid size-4 shrink-0 place-items-center rounded-[0.3125rem] border transition-colors',
                                        on
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-input',
                                    )}
                                    aria-hidden
                                >
                                    {on ? (
                                        <Check
                                            className="size-3"
                                            strokeWidth={3.5}
                                        />
                                    ) : null}
                                </span>
                                <ChannelIcon channel={channel} />
                                {label}
                            </DropdownMenuItem>
                        );
                    })}

                    <p className="mt-1 border-t border-border px-2 pt-2 text-[0.6875rem] leading-snug text-muted-foreground">
                        Channel yang dipilih pertama menentukan warna kartunya
                        di kalender.
                    </p>
                </DropdownMenuContent>
            </DropdownMenu>

            <FieldError message={failed} />
        </FieldStack>
    );
}

/* ────────────────────────────  Jenis & Pillar  ──────────────────────────── */

/** The shape the piece takes. Every piece has one; there is nothing to clear. */
export function TypeField({ content }: { content: ContentDetail }) {
    const { types } = useContentPlan();

    return (
        <ChoiceField
            content={content}
            field="type"
            heading="Jenis konten"
            options={types}
            value={content.type}
            label={content.typeLabel}
        />
    );
}

/** What the piece is for. One per piece, and it may honestly be undecided. */
export function PillarField({ content }: { content: ContentDetail }) {
    const { pillars } = useContentPlan();

    return (
        <ChoiceField
            content={content}
            field="pillar"
            heading="Pillar"
            options={pillars}
            value={content.pillar ?? ''}
            label={content.pillarLabel ?? 'Belum ditentukan'}
            clearable="Belum ditentukan"
        />
    );
}

/** One word out of a short list, on a chip that already looks like one. */
function ChoiceField({
    content,
    field,
    heading,
    options,
    value,
    label,
    clearable,
}: {
    content: ContentDetail;
    field: string;
    heading: string;
    options: Record<string, string>;
    value: string;
    label: string;
    /** The words for "not set", on fields where that is a real answer. */
    clearable?: string;
}) {
    const { save, saving, failed, forget } = useFieldSave(content.id);
    const { landed, settled } = useLanded(value);

    const empty = value === '';

    return (
        <FieldStack>
            <DropdownMenu onOpenChange={(next) => next && forget()}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={saving}
                        onAnimationEnd={settled}
                        aria-label={`${heading} ${label}, ubah`}
                        className={cn(
                            fieldTrigger({ shape: 'chip', empty, landed }),
                            empty ? 'bg-card' : NEUTRAL_CHIP,
                        )}
                    >
                        {label}
                        <FieldChevron saving={saving} />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                    className="max-h-(--radix-dropdown-menu-content-available-height) w-[min(15rem,calc(100vw-2rem))] overflow-y-auto p-1.5"
                >
                    <MenuHeading>{heading}</MenuHeading>

                    {clearable ? (
                        <Choice
                            label={clearable}
                            current={empty}
                            muted
                            onPick={() => save(field, '')}
                        />
                    ) : null}

                    {Object.entries(options).map(([key, name]) => (
                        <Choice
                            key={key}
                            label={name}
                            current={key === value}
                            onPick={() => save(field, key)}
                        />
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <FieldError message={failed} />
        </FieldStack>
    );
}

function Choice({
    label,
    current,
    muted = false,
    onPick,
    children,
}: {
    label: string;
    current: boolean;
    muted?: boolean;
    onPick: () => void;
    children?: React.ReactNode;
}) {
    return (
        <DropdownMenuItem
            disabled={current}
            onSelect={onPick}
            className={cn(
                'gap-2.5 rounded-md px-2 py-1.5 text-[0.8438rem] font-semibold',
                muted && !current && 'text-muted-foreground',
                current && 'bg-neutral-soft data-[disabled]:opacity-100',
            )}
        >
            {children}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {current ? (
                <Check
                    className="size-3.5 shrink-0 text-primary-deep"
                    strokeWidth={3}
                    aria-hidden
                />
            ) : null}
        </DropdownMenuItem>
    );
}

/* ─────────────────────────────  Submitted by  ───────────────────────────── */

/**
 * Whose piece it is.
 *
 * The real team, shared on every page. Somebody who has since left still has to
 * read and edit cleanly, so a name already on the piece stays in the list even
 * when it is no longer offered to anybody else.
 */
export function OwnerField({ content }: { content: ContentDetail }) {
    const { save, saving, failed, forget } = useFieldSave(content.id);
    const { landed, settled } = useLanded(content.owner ?? '');
    const initials = useInitials();

    const team = (usePage<SharedProps>().props.team ?? []).map(
        (member) => member.name,
    );
    const owners =
        content.owner && !team.includes(content.owner)
            ? [...team, content.owner]
            : team;

    const empty = !content.owner;

    return (
        <FieldStack>
            <DropdownMenu onOpenChange={(next) => next && forget()}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={saving}
                        onAnimationEnd={settled}
                        aria-label={`Submitted by ${content.owner ?? 'belum ditentukan'}, ubah`}
                        className={fieldTrigger({
                            shape: 'zone',
                            empty,
                            landed,
                        })}
                    >
                        {content.owner ? (
                            <>
                                <span
                                    className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.6875rem] font-extrabold text-primary-deep"
                                    aria-hidden
                                >
                                    {initials(content.owner)}
                                </span>
                                {content.owner}
                            </>
                        ) : (
                            'Belum ditentukan'
                        )}
                        <FieldChevron saving={saving} />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                    className="max-h-(--radix-dropdown-menu-content-available-height) w-[min(15rem,calc(100vw-2rem))] overflow-y-auto p-1.5"
                >
                    <MenuHeading>Submitted by</MenuHeading>

                    <Choice
                        label="Belum ditentukan"
                        current={empty}
                        muted
                        onPick={() => save('owner', '')}
                    />

                    {owners.map((name) => (
                        <Choice
                            key={name}
                            label={name}
                            current={name === content.owner}
                            onPick={() => save('owner', name)}
                        >
                            <span
                                className="grid size-5 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.6875rem] font-extrabold text-primary-deep"
                                aria-hidden
                            >
                                {initials(name)}
                            </span>
                        </Choice>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <FieldError message={failed} />
        </FieldStack>
    );
}

/* ────────────────────────────  Referensi & Tautan  ──────────────────────── */

/** Where the idea came from. A plain address, typed or pasted. */
export function ReferenceField({ content }: { content: ContentDetail }) {
    return (
        <AddressField
            content={content}
            field="reference_url"
            heading="Referensi"
            value={content.referenceUrl}
            placeholder="https://…"
        />
    );
}

/**
 * Where the piece went live.
 *
 * Every address this field wants is in the app already — Performa pulls each
 * post the moment it goes out — so the list comes first and the box underneath
 * is the way in for everything Performa does not follow.
 */
export function LinkField({ content }: { content: ContentDetail }) {
    return (
        <AddressField
            content={content}
            field="url"
            heading="Tautan"
            value={content.url}
            placeholder="https://www.instagram.com/p/…"
            released
        />
    );
}

function AddressField({
    content,
    field,
    heading,
    value,
    placeholder,
    released = false,
}: {
    content: ContentDetail;
    field: string;
    heading: string;
    value: string | null;
    placeholder: string;
    /** Offers what Performa already scraped above the box. */
    released?: boolean;
}) {
    const { save, saving, failed, forget } = useFieldSave(content.id);
    const { landed, settled } = useLanded(value ?? '');

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value ?? '');

    const start = (next: boolean) => {
        if (next) {
            setDraft(value ?? '');
            forget();
        }

        setOpen(next);
    };

    return (
        <FieldStack>
            {/* The row takes the whole cell so the address inside it has a
                width to be measured against: left to hug its own content, the
                button and every ancestor size to the shortest thing in them,
                and a truncating child's shortest is nothing at all. */}
            <span className="flex w-full min-w-0 items-center gap-1">
                <Popover open={open} onOpenChange={start}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            disabled={saving}
                            onAnimationEnd={settled}
                            aria-label={`${heading} ${value ?? 'belum ada'}, ubah`}
                            className={fieldTrigger({
                                shape: 'zone',
                                empty: !value,
                                landed,
                            })}
                        >
                            <span className="truncate">
                                {value
                                    ? value.replace(/^https?:\/\/(www\.)?/, '')
                                    : 'Belum ada'}
                            </span>
                            <FieldChevron saving={saving} />
                        </button>
                    </PopoverTrigger>

                    <PopoverContent
                        align="start"
                        collisionPadding={12}
                        className="flex max-h-(--radix-popover-content-available-height) w-[min(24rem,calc(100vw-2rem))] flex-col p-0"
                    >
                        {released ? (
                            <ReleasedList
                                value={draft}
                                onPick={(url) =>
                                    save(field, url, () => setOpen(false))
                                }
                            />
                        ) : null}

                        <div className="shrink-0 border-t border-border p-2.5 first:border-t-0">
                            <Input
                                type="url"
                                inputMode="url"
                                value={draft}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        save(field, draft, () =>
                                            setOpen(false),
                                        );
                                    }
                                }}
                                placeholder={placeholder}
                                aria-label={heading}
                                className="text-[0.8438rem]"
                            />
                        </div>

                        <Footer
                            saving={saving}
                            onCancel={() => setOpen(false)}
                            onSave={() =>
                                save(field, draft, () => setOpen(false))
                            }
                            onClear={
                                value
                                    ? () =>
                                          save(field, '', () => setOpen(false))
                                    : undefined
                            }
                        />
                    </PopoverContent>
                </Popover>

                {/* Reading the address and changing it are two different
                    errands, so they are two targets rather than one that
                    guesses. */}
                {value ? (
                    <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Buka ${heading.toLowerCase()}`}
                        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-primary-deep"
                    >
                        <ExternalLink
                            className="size-3.5"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <span className="sr-only">
                            Buka {heading.toLowerCase()}
                        </span>
                    </a>
                ) : null}
            </span>

            <FieldError message={failed} />
        </FieldStack>
    );
}

/** The way out of a popover that holds a change until it is committed. */
function Footer({
    saving,
    onCancel,
    onSave,
    onClear,
}: {
    saving: boolean;
    onCancel: () => void;
    onSave: () => void;
    /** Present only where emptying the field is a real answer. */
    onClear?: () => void;
}) {
    return (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-2.5">
            {onClear ? (
                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={onClear}
                    disabled={saving}
                    className="mr-auto text-destructive hover:bg-destructive-soft hover:text-destructive"
                >
                    <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
                    Kosongkan
                </Button>
            ) : null}

            <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onCancel}
                disabled={saving}
            >
                Batal
            </Button>
            <Button
                size="sm"
                type="button"
                onClick={onSave}
                disabled={saving}
                className="shadow-teal"
            >
                {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
        </div>
    );
}
