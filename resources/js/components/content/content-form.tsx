import { router } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ChannelMarks } from '@/components/content/channel-marks';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { STATUS_DOT } from '@/components/content/status-mark';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { Field } from '@/components/leads/form-field';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ContentStatus, EditableContent } from '@/data/content';
import { toIso } from '@/data/content';
import { CHANNEL_LABELS, team } from '@/data/dashboard';
import type { ChannelKey } from '@/data/dashboard';
import { asDate, TODAY } from '@/data/leads';
import { useContentPlan } from '@/hooks/use-content-plan';
import { cn } from '@/lib/utils';
import {
    store as contentStore,
    update as contentUpdate,
} from '@/routes/content';

/** The hours this team actually publishes at; the field takes any other. */
const SLOTS = ['07:00', '09:00', '12:00', '17:00', '19:00'];

/** Neither select can carry an empty value; these stand for "not yet". */
const NOBODY = '__tanpa__';
const NO_PILLAR = '__belum__';

const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

type Errors = Partial<Record<string, string>>;

/**
 * The one form for a piece of content, in whichever frame is asking.
 *
 * A new piece is composed in a dialog over the calendar; an existing one is
 * changed inside its own panel, where the record it replaces was a moment
 * ago. Both are the same fields in the same order, so nobody has to learn
 * the form twice — only its chrome differs, and that is all `variant` sets.
 *
 * The columns follow the frame's own width rather than the window's: two
 * columns in the dialog, one in the narrower panel, with no breakpoint
 * having to know which host it is inside.
 */
export function ContentForm({
    content,
    seed,
    variant,
    onCancel,
    onSaved,
}: {
    /** The piece being changed, or null to compose a new one. */
    content: EditableContent | null;
    /** Where a new piece starts: the day clicked, the channel in filter —
     * and, from the idea backlog, the words the idea already has. */
    seed?: {
        scheduledFor: string;
        channel: ChannelKey;
        title?: string;
        brief?: string;
        referenceUrl?: string;
        ideaId?: number;
    };
    variant: 'dialog' | 'panel';
    onCancel: () => void;
    onSaved: () => void;
}) {
    const plan = useContentPlan();
    const allChannels = Object.keys(plan.channels) as ChannelKey[];

    const [title, setTitle] = useState(content?.title ?? seed?.title ?? '');
    const [channels, setChannels] = useState<ChannelKey[]>(
        content?.channels?.length
            ? content.channels
            : [seed?.channel ?? 'instagram'],
    );
    const [pillar, setPillar] = useState(content?.pillar ?? '');
    const [type, setType] = useState(
        content?.type ?? Object.keys(plan.types)[0] ?? '',
    );
    const [brief, setBrief] = useState(content?.brief ?? seed?.brief ?? '');
    const [caption, setCaption] = useState(content?.caption ?? '');
    const [referenceUrl, setReferenceUrl] = useState(
        content?.referenceUrl ?? seed?.referenceUrl ?? '',
    );
    const [scheduledFor, setScheduledFor] = useState<Date>(
        asDate(content?.scheduledFor ?? seed?.scheduledFor ?? toIso(TODAY)),
    );
    const [scheduledTime, setScheduledTime] = useState(
        content?.scheduledTime ?? '',
    );
    const [status, setStatus] = useState<ContentStatus>(
        content?.status ?? 'draft',
    );
    const [publishedAt, setPublishedAt] = useState<Date | undefined>(
        content?.publishedAt ? asDate(content.publishedAt) : undefined,
    );
    const [owner, setOwner] = useState(content?.owner ?? '');
    const [url, setUrl] = useState(content?.url ?? '');

    const [dateOpen, setDateOpen] = useState(false);
    const [publishedOpen, setPublishedOpen] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    /* The chip in the footer, and the tint the calendar will draw, follow
       whichever channel was ticked first. */
    const lead = channels[0] ?? 'instagram';

    // A team member who has since left still has to edit cleanly.
    const owners = team.map((member) => member.name);

    if (owner && !owners.includes(owner)) {
        owners.push(owner);
    }

    /* Ticking keeps the order they were ticked in, so the first channel
       chosen stays the one the piece is drawn as. */
    const toggleChannel = (key: ChannelKey) =>
        setChannels((current) =>
            current.includes(key)
                ? current.filter((item) => item !== key)
                : [...current, key],
        );

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const next: Errors = {};

        if (!title.trim()) {
            next.title = 'Judul konten wajib diisi.';
        }

        if (channels.length === 0) {
            next.channels = 'Pilih minimal satu channel.';
        }

        if (!type) {
            next.type = 'Pilih jenis kontennya.';
        }

        if (url && !/^https?:\/\/\S+$/.test(url.trim())) {
            next.url = 'Tautan harus berupa alamat lengkap, diawali https://.';
        }

        if (referenceUrl && !/^https?:\/\/\S+$/.test(referenceUrl.trim())) {
            next.reference_url =
                'Referensi harus berupa alamat lengkap, diawali https://.';
        }

        setErrors(next);

        if (Object.keys(next).length > 0) {
            toast.error('Beberapa isian belum lengkap', {
                description: 'Yang perlu diperbaiki ditandai merah.',
            });

            return;
        }

        router.post(
            content ? contentUpdate(content.id).url : contentStore().url,
            {
                title: title.trim(),
                channels,
                pillar,
                type,
                scheduled_for: toIso(scheduledFor),
                scheduled_time: scheduledTime,
                status,
                published_at:
                    status === 'published' && publishedAt
                        ? toIso(publishedAt)
                        : '',
                owner: owner.trim(),
                brief: brief.trim(),
                caption: caption.trim(),
                reference_url: referenceUrl.trim(),
                url: url.trim(),
                idea_id: content ? '' : (seed?.ideaId ?? ''),
            },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => onSaved(),
                onError: (serverErrors) => {
                    setErrors(serverErrors);

                    toast.error('Belum bisa disimpan', {
                        description:
                            Object.values(serverErrors)[0] ??
                            'Periksa lagi isiannya.',
                    });
                },
            },
        );
    };

    const saveLabel = saving
        ? 'Menyimpan…'
        : content
          ? 'Simpan Perubahan'
          : 'Simpan Konten';

    const formId = `content-form-${variant}`;

    const fields = (
        <form
            id={formId}
            onSubmit={submit}
            noValidate
            className="@container min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
        >
            <div className="grid gap-4 @lg:grid-cols-2">
                <Field
                    id="title"
                    label="Judul"
                    error={errors.title}
                    className="@lg:col-span-2"
                >
                    <Input
                        id="title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Batas Lapor SPT Badan"
                        autoFocus
                        aria-invalid={Boolean(errors.title)}
                        aria-describedby={
                            errors.title ? 'title-error' : undefined
                        }
                    />
                </Field>

                {/* One piece often goes to several places at once, so the
                    channels are ticked rather than picked. Laid out flat: six
                    options in a dropdown hides five of them behind a click
                    each, and the whole point here is seeing the set. */}
                <Field
                    id="channels"
                    label="Channel"
                    error={errors.channels}
                    className="@lg:col-span-2"
                    hint="Bisa lebih dari satu. Yang pertama dipilih jadi warna kontennya di kalender."
                >
                    <div
                        id="channels"
                        role="group"
                        aria-describedby="channels-hint"
                        className="flex flex-wrap gap-1.5"
                    >
                        {allChannels.map((key) => {
                            const on = channels.includes(key);

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleChannel(key)}
                                    aria-pressed={on}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors',
                                        on
                                            ? cn(
                                                  'border-transparent',
                                                  CHANNEL_TONE[key].filled,
                                              )
                                            : 'border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-secondary-foreground',
                                    )}
                                >
                                    <ChannelIcon
                                        channel={key}
                                        className="size-3.5 shrink-0"
                                    />
                                    {CHANNEL_LABELS[key]}
                                </button>
                            );
                        })}
                    </div>
                </Field>

                <Field
                    id="pillar"
                    label="Content pillar"
                    optional
                    error={errors.pillar}
                    hint="Untuk apa konten ini dibuat."
                >
                    <Select
                        value={pillar || NO_PILLAR}
                        onValueChange={(next) =>
                            setPillar(next === NO_PILLAR ? '' : next)
                        }
                    >
                        <SelectTrigger
                            id="pillar"
                            className="w-full"
                            aria-describedby="pillar-hint"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_PILLAR}>
                                Belum ditentukan
                            </SelectItem>
                            {Object.entries(plan.pillars).map(
                                ([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        {label}
                                    </SelectItem>
                                ),
                            )}
                        </SelectContent>
                    </Select>
                </Field>

                <Field
                    id="type"
                    label="Content type"
                    error={errors.type}
                    hint="Bentuknya: foto, carousel, video."
                >
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger
                            id="type"
                            className="w-full"
                            aria-invalid={Boolean(errors.type)}
                            aria-describedby="type-hint"
                        >
                            <SelectValue placeholder="Pilih jenis" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(plan.types).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field
                    id="scheduled"
                    label="Tanggal tayang"
                    error={errors.scheduled_for}
                >
                    <DatePick
                        id="scheduled"
                        open={dateOpen}
                        onOpenChange={setDateOpen}
                        value={scheduledFor}
                        onChange={(date) => {
                            if (date) {
                                setScheduledFor(date);
                            }
                        }}
                    />
                </Field>

                {/* The hour is its own decision and often made later, so it
                    is optional and never guessed at with a default. */}
                <Field
                    id="scheduled-time"
                    label="Jam tayang"
                    optional
                    error={errors.scheduled_time}
                >
                    {/* The browser's own control draws its clock; a second
                        one beside it would be the same word twice. */}
                    <Input
                        id="scheduled-time"
                        type="time"
                        step={300}
                        value={scheduledTime}
                        onChange={(event) =>
                            setScheduledTime(event.target.value)
                        }
                        aria-invalid={Boolean(errors.scheduled_time)}
                        aria-describedby="scheduled-time-note"
                    />
                </Field>

                {/* The hours this team actually publishes at, on a row of
                    their own under the pair. Tucked into the hour's own
                    field they made that half of the row twice as tall as
                    the date beside it, and left the date sitting over a
                    hole; across the full width they stay on one line
                    however wide the frame is. */}
                <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 @lg:col-span-2">
                    <p className="flex flex-wrap gap-1.5">
                        {SLOTS.map((slot) => (
                            <button
                                key={slot}
                                type="button"
                                onClick={() =>
                                    setScheduledTime(
                                        scheduledTime === slot ? '' : slot,
                                    )
                                }
                                aria-pressed={scheduledTime === slot}
                                className={cn(
                                    'rounded-md border px-2 py-1 text-[0.6875rem] font-bold transition-colors',
                                    scheduledTime === slot
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-card text-secondary-foreground hover:border-primary/35 hover:text-primary-deep',
                                )}
                                data-numeric
                            >
                                {slot.replace(':', '.')}
                            </button>
                        ))}
                    </p>

                    <p
                        id="scheduled-time-note"
                        className="text-xs leading-relaxed text-muted-foreground"
                    >
                        Jam dipakai untuk mengurutkan konten di hari yang sama.
                    </p>
                </div>

                <Field id="owner" label="Submitted by" optional>
                    <Select
                        value={owner || NOBODY}
                        onValueChange={(next) =>
                            setOwner(next === NOBODY ? '' : next)
                        }
                    >
                        <SelectTrigger id="owner" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NOBODY}>
                                Belum ditentukan
                            </SelectItem>
                            {owners.map((name) => (
                                <SelectItem key={name} value={name}>
                                    {name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field
                    id="status"
                    label="Status"
                    hint={
                        content
                            ? 'Mengubah status di sini mencatat perpindahan hari ini.'
                            : 'Biasanya Draft. Naikkan kalau sudah pernah dibahas.'
                    }
                >
                    <Select
                        value={status}
                        onValueChange={(next) =>
                            setStatus(next as ContentStatus)
                        }
                    >
                        <SelectTrigger
                            id="status"
                            className="w-full"
                            aria-describedby="status-hint"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {plan.statuses.map((item) => (
                                <SelectItem key={item.key} value={item.key}>
                                    <span
                                        className={cn(
                                            'size-2 shrink-0 rounded-full',
                                            STATUS_DOT[
                                                item.key as ContentStatus
                                            ],
                                        )}
                                    />
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                {status === 'published' ? (
                    <Field
                        id="published"
                        label="Tanggal tayang sebenarnya"
                        hint="Kosongkan kalau sama dengan hari ini."
                    >
                        <DatePick
                            id="published"
                            open={publishedOpen}
                            onOpenChange={setPublishedOpen}
                            value={publishedAt}
                            onChange={setPublishedAt}
                            placeholder="Hari ini"
                            disabled={{ after: TODAY }}
                        />
                    </Field>
                ) : null}

                <Field
                    id="brief"
                    label="Brief"
                    optional
                    className="@lg:col-span-2"
                    hint="Angle, poin yang harus ada, rujukan, ajakan di akhir."
                >
                    <Textarea
                        id="brief"
                        value={brief}
                        onChange={(event) => setBrief(event.target.value)}
                        placeholder="Angle: ambil dari pertanyaan yang paling sering masuk lewat WhatsApp bulan lalu…"
                        className="min-h-24"
                        aria-describedby="brief-hint"
                    />
                </Field>

                {/* The brief asks for the piece; this is the piece. Kept as
                    separate fields because the caption gets copied out of
                    here verbatim, and a brief mixed into it ships. */}
                <Field
                    id="caption"
                    label="Text copy / caption"
                    optional
                    className="@lg:col-span-2"
                    hint="Teks yang akan dipasang apa adanya, lengkap dengan hashtag."
                >
                    <Textarea
                        id="caption"
                        value={caption}
                        onChange={(event) => setCaption(event.target.value)}
                        placeholder={
                            'Batas lapor SPT Badan tinggal dua minggu lagi.\n\n#pajak #spt #konsultanpajak'
                        }
                        className="min-h-28"
                        aria-describedby="caption-hint"
                    />
                </Field>

                <Field
                    id="reference"
                    label="Referensi"
                    optional
                    error={errors.reference_url}
                    className="@lg:col-span-2"
                    hint="Sumber materinya: peraturan, artikel, atau postingan yang jadi acuan."
                >
                    <Input
                        id="reference"
                        type="url"
                        inputMode="url"
                        value={referenceUrl}
                        onChange={(event) =>
                            setReferenceUrl(event.target.value)
                        }
                        placeholder="https://pajak.go.id/…"
                        aria-invalid={Boolean(errors.reference_url)}
                        aria-describedby={
                            errors.reference_url
                                ? 'reference-error'
                                : 'reference-hint'
                        }
                    />
                </Field>

                <Field
                    id="url"
                    label="Tautan"
                    optional
                    error={errors.url}
                    className="@lg:col-span-2"
                    hint="Alamat postingan atau halaman setelah tayang."
                >
                    <Input
                        id="url"
                        type="url"
                        inputMode="url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://www.instagram.com/p/…"
                        aria-invalid={Boolean(errors.url)}
                        aria-describedby={errors.url ? 'url-error' : 'url-hint'}
                    />
                </Field>
            </div>
        </form>
    );

    const actions = (
        <div className="flex flex-1 gap-2 sm:flex-none">
            <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={onCancel}
                disabled={saving}
            >
                Batal
            </Button>
            <Button
                type="submit"
                form={formId}
                className="flex-1 shadow-teal sm:flex-none"
                disabled={saving}
            >
                <Check strokeWidth={2.5} aria-hidden />
                {saveLabel}
            </Button>
        </div>
    );

    /*
     | In the panel the toolbar keeps the shape the record had a moment ago —
     | one button top left, the rest to the right — so the two views read as
     | the same card in two states rather than two different screens. The way
     | out goes back to the record, not out of the panel.
     */
    if (variant === 'panel') {
        return (
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={saving}
                        className="grid size-9 place-items-center rounded-md text-secondary-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                    >
                        <ArrowLeft
                            className="size-4"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                        <span className="sr-only">Kembali ke rincian</span>
                    </button>

                    <p className="text-[0.8438rem] font-extrabold tracking-[-0.01em]">
                        Ubah konten
                    </p>
                </div>

                {fields}

                <div className="flex items-center justify-end border-t border-border px-4 py-3 sm:px-5">
                    {actions}
                </div>
            </div>
        );
    }

    return (
        <>
            <DialogHeader className="border-b border-border px-5 py-4 sm:px-6">
                <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                    Tambah Konten
                </DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                    Judul, channel, jenis, dan tanggal tayang yang wajib.
                    Sisanya bisa menyusul.
                </DialogDescription>
            </DialogHeader>

            {fields}

            {/* Consequence beside the decision: the chip the calendar will draw. */}
            <DialogFooter className="flex-row items-center gap-3 border-t border-border px-5 py-3.5 sm:justify-between sm:px-6">
                <p
                    className={cn(
                        'hidden max-w-[16rem] min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[0.6875rem] font-bold sm:flex',
                        status === 'published'
                            ? CHANNEL_TONE[lead].filled
                            : CHANNEL_TONE[lead].outlined,
                        !title && 'opacity-70',
                    )}
                    aria-hidden
                >
                    <ChannelMarks channels={channels} tinted={false} max={2} />
                    <span className="truncate">{title || 'Judul konten'}</span>
                </p>

                {actions}
            </DialogFooter>
        </>
    );
}

function DatePick({
    id,
    open,
    onOpenChange,
    value,
    onChange,
    placeholder = 'Pilih tanggal',
    disabled,
}: {
    id: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    value: Date | undefined;
    onChange: (date: Date | undefined) => void;
    placeholder?: string;
    disabled?: { after: Date };
}) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    id={id}
                    className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <CalendarDays
                        className="size-4 shrink-0 text-muted-foreground"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                    <span
                        className={cn(
                            'truncate',
                            !value && 'text-muted-foreground',
                        )}
                    >
                        {value ? dateLabel.format(value) : placeholder}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-3">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={(date) => {
                        onChange(date);
                        onOpenChange(false);
                    }}
                    disabled={disabled}
                    defaultMonth={value}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    );
}
