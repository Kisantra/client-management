import { router } from '@inertiajs/react';
import { CalendarDays, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { STATUS_DOT } from '@/components/content/status-mark';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { Field } from '@/components/leads/form-field';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogContent,
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

/** What the dialog is for: a new piece on a day, or an existing one. */
export type Compose =
    | { mode: 'create'; scheduledFor: string; channel: ChannelKey }
    | { mode: 'edit'; content: EditableContent };

/** The owner select cannot carry an empty value; this stands for "nobody yet". */
const NOBODY = '__tanpa__';

const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

type Errors = Partial<Record<string, string>>;

/**
 * The form for a piece, over the calendar rather than instead of it. The
 * month stays in view underneath, so the day being planned is never lost.
 */
export function ContentDialog({
    compose,
    open,
    onOpenChange,
}: {
    compose: Compose | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    /* The last request stays on screen while the dialog fades out, instead
       of the form emptying a beat before it leaves. */
    const [last, setLast] = useState<Compose | null>(compose);

    if (compose && compose !== last) {
        setLast(compose);
    }

    const shown = compose ?? last;

    // A fresh form for every request: new day, new piece, new state.
    const key = !shown
        ? 'none'
        : shown.mode === 'edit'
          ? `edit-${shown.content.id}`
          : `create-${shown.scheduledFor}-${shown.channel}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-x-hidden overflow-y-hidden p-0 sm:max-w-2xl sm:p-0">
                {shown ? (
                    <FormBody
                        key={key}
                        compose={shown}
                        onCancel={() => onOpenChange(false)}
                        onSaved={() => onOpenChange(false)}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function FormBody({
    compose,
    onCancel,
    onSaved,
}: {
    compose: Compose;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const plan = useContentPlan();
    const channels = plan.channels as ChannelKey[];
    const content = compose.mode === 'edit' ? compose.content : null;

    const [title, setTitle] = useState(content?.title ?? '');
    const [channel, setChannel] = useState<ChannelKey>(
        content?.channel ??
            (compose.mode === 'create' ? compose.channel : 'instagram'),
    );
    const [format, setFormat] = useState(
        content?.format ?? Object.keys(plan.formats[channel] ?? {})[0] ?? '',
    );
    const [brief, setBrief] = useState(content?.brief ?? '');
    const [scheduledFor, setScheduledFor] = useState<Date>(
        asDate(
            content?.scheduledFor ??
                (compose.mode === 'create'
                    ? compose.scheduledFor
                    : toIso(TODAY)),
        ),
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

    const formats = plan.formats[channel] ?? {};

    // A team member who has since left still has to edit cleanly.
    const owners = team.map((member) => member.name);

    if (owner && !owners.includes(owner)) {
        owners.push(owner);
    }

    const pickChannel = (next: ChannelKey) => {
        setChannel(next);
        setFormat(Object.keys(plan.formats[next] ?? {})[0] ?? '');
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const next: Errors = {};

        if (!title.trim()) {
            next.title = 'Judul konten wajib diisi.';
        }

        if (!format) {
            next.format = 'Pilih format kontennya.';
        }

        if (url && !/^https?:\/\/\S+$/.test(url.trim())) {
            next.url = 'Tautan harus berupa alamat lengkap, diawali https://.';
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
                channel,
                format,
                scheduled_for: toIso(scheduledFor),
                status,
                published_at:
                    status === 'published' && publishedAt
                        ? toIso(publishedAt)
                        : '',
                owner: owner.trim(),
                brief: brief.trim(),
                url: url.trim(),
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

    return (
        <>
            <DialogHeader className="border-b border-border px-5 py-4 sm:px-6">
                <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                    {content ? 'Ubah Konten' : 'Tambah Konten'}
                </DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                    {content
                        ? `Mengubah ${content.title}. Perubahan status dari sini tercatat di riwayatnya.`
                        : 'Judul, channel, format, dan tanggal tayang yang wajib. Brief bisa menyusul.'}
                </DialogDescription>
            </DialogHeader>

            <form
                id="content-form"
                onSubmit={submit}
                noValidate
                className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        id="title"
                        label="Judul"
                        error={errors.title}
                        className="sm:col-span-2"
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

                    <Field id="channel" label="Channel" error={errors.channel}>
                        <Select
                            value={channel}
                            onValueChange={(next) =>
                                pickChannel(next as ChannelKey)
                            }
                        >
                            <SelectTrigger id="channel" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {channels.map((key) => (
                                    <SelectItem key={key} value={key}>
                                        <ChannelIcon channel={key} />
                                        {CHANNEL_LABELS[key]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field id="format" label="Format" error={errors.format}>
                        <Select value={format} onValueChange={setFormat}>
                            <SelectTrigger
                                id="format"
                                className="w-full"
                                aria-invalid={Boolean(errors.format)}
                            >
                                <SelectValue placeholder="Pilih format" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(formats).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field
                        id="brief"
                        label="Brief"
                        optional
                        className="sm:col-span-2"
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

                    <Field id="owner" label="Penanggung jawab" optional>
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
                        id="url"
                        label="Tautan"
                        optional
                        error={errors.url}
                        className="sm:col-span-2"
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
                            aria-describedby={
                                errors.url ? 'url-error' : 'url-hint'
                            }
                        />
                    </Field>
                </div>
            </form>

            {/* Consequence beside the decision: the chip the calendar will draw. */}
            <DialogFooter className="flex-row items-center gap-3 border-t border-border px-5 py-3.5 sm:justify-between sm:px-6">
                <p
                    className={cn(
                        'hidden max-w-[16rem] min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[0.6875rem] font-bold sm:flex',
                        status === 'published'
                            ? CHANNEL_TONE[channel].filled
                            : CHANNEL_TONE[channel].outlined,
                        !title && 'opacity-70',
                    )}
                    aria-hidden
                >
                    <ChannelIcon
                        channel={channel}
                        className="size-3 shrink-0"
                    />
                    <span className="truncate">{title || 'Judul konten'}</span>
                </p>

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
                        form="content-form"
                        className="flex-1 shadow-teal sm:flex-none"
                        disabled={saving}
                    >
                        <Check strokeWidth={2.5} aria-hidden />
                        {saveLabel}
                    </Button>
                </div>
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
