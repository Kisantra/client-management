import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarPlus,
    Check,
    ChevronRight,
    ExternalLink,
    Lightbulb,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { ContentDialog } from '@/components/content/content-dialog';
import type { Compose } from '@/components/content/content-dialog';
import { StatusPill } from '@/components/content/status-mark';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { Field } from '@/components/leads/form-field';
import { Button } from '@/components/ui/button';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toIso } from '@/data/content';
import { CHANNEL_LABELS } from '@/data/dashboard';
import type { ChannelKey } from '@/data/dashboard';
import type { ContentIdea } from '@/data/ideas';
import { entryDate, TODAY } from '@/data/leads';
import { useContentPlan } from '@/hooks/use-content-plan';
import { cn } from '@/lib/utils';
import { content as contentIndex } from '@/routes';
import { ideas as ideasIndex } from '@/routes/content';
import {
    destroy as destroyIdea,
    store as storeIdea,
} from '@/routes/content/ideas';

/** The channel select cannot carry an empty value; this stands for "any". */
const ANY_CHANNEL = '__bebas__';

type Props = {
    ideas: ContentIdea[];
};

export default function ContentIdeasPage({ ideas }: Props) {
    const fresh = ideas.filter((idea) => idea.content === null);
    const used = ideas.filter((idea) => idea.content !== null);

    /* Scheduling an idea opens the calendar's own form, prefilled from it.
       Saving links the piece back, so the idea moves to "done" by itself. */
    const [compose, setCompose] = useState<Compose | null>(null);
    const [deleting, setDeleting] = useState<ContentIdea | null>(null);

    const schedule = (idea: ContentIdea) =>
        setCompose({
            scheduledFor: toIso(TODAY),
            channel: idea.channel ?? 'instagram',
            title: idea.title,
            brief: idea.note ?? undefined,
            referenceUrl: idea.sourceUrl ?? undefined,
            ideaId: idea.id,
        });

    return (
        <>
            <Head title="Ide Konten" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Ide Konten
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {fresh.length}
                                </span>{' '}
                                ide menunggu
                            </span>
                            <span>
                                ·{' '}
                                <span
                                    className="font-bold text-foreground"
                                    data-numeric
                                >
                                    {used.length}
                                </span>{' '}
                                sudah dijadwalkan
                            </span>
                            <span
                                className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-secondary-foreground uppercase"
                                title="Isi awalnya data contoh hasil seeding. Tambah, jadwalkan, dan hapus sudah tersimpan sungguhan."
                            >
                                Data contoh
                            </span>
                        </p>
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr] xl:items-start">
                    {/* Writing one down costs a title; the rest can wait. */}
                    <IdeaComposer />

                    <div className="flex min-w-0 flex-col gap-5">
                        <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6">
                            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                Menunggu dijadwalkan
                            </h2>
                            <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">
                                Jadwalkan membuka form konten yang sudah terisi
                                dari idenya.
                            </p>

                            {fresh.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-10 text-center">
                                    <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                                        <Lightbulb
                                            className="size-5"
                                            strokeWidth={1.75}
                                            aria-hidden
                                        />
                                    </span>
                                    <p className="text-sm font-bold">
                                        Tidak ada ide yang menunggu
                                    </p>
                                    <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
                                        Tulis yang terlintas di sebelah, atau
                                        ambil bahan dari Berita Terbaru.
                                    </p>
                                </div>
                            ) : (
                                <ul className="flex flex-col">
                                    {fresh.map((idea) => (
                                        <li
                                            key={idea.id}
                                            className="border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[0.8438rem] leading-snug font-bold">
                                                        {idea.title}
                                                    </p>
                                                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                        {idea.channel ? (
                                                            <span
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 font-bold',
                                                                    CHANNEL_TONE[
                                                                        idea
                                                                            .channel
                                                                    ].filled,
                                                                )}
                                                            >
                                                                <ChannelIcon
                                                                    channel={
                                                                        idea.channel
                                                                    }
                                                                    className="size-3"
                                                                />
                                                                {
                                                                    CHANNEL_LABELS[
                                                                        idea
                                                                            .channel
                                                                    ]
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span className="rounded-full bg-neutral-soft px-2 py-0.5 font-bold text-secondary-foreground">
                                                                Channel bebas
                                                            </span>
                                                        )}
                                                        <span>
                                                            {idea.author ??
                                                                'Tanpa nama'}
                                                        </span>
                                                        <span aria-hidden>
                                                            ·
                                                        </span>
                                                        <span data-numeric>
                                                            {entryDate(
                                                                idea.createdAt,
                                                            )}
                                                        </span>
                                                        {idea.sourceUrl ? (
                                                            <a
                                                                href={
                                                                    idea.sourceUrl
                                                                }
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 font-bold text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                                                            >
                                                                sumber
                                                                <ExternalLink
                                                                    className="size-3"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    aria-hidden
                                                                />
                                                            </a>
                                                        ) : null}
                                                    </p>
                                                    {idea.note ? (
                                                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-secondary-foreground">
                                                            {idea.note}
                                                        </p>
                                                    ) : null}
                                                </div>

                                                <div className="flex shrink-0 items-center gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        className="shadow-teal"
                                                        onClick={() =>
                                                            schedule(idea)
                                                        }
                                                    >
                                                        <CalendarPlus
                                                            strokeWidth={2}
                                                            aria-hidden
                                                        />
                                                        <span className="hidden sm:inline">
                                                            Jadwalkan
                                                        </span>
                                                    </Button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setDeleting(idea)
                                                        }
                                                        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                                                    >
                                                        <Trash2
                                                            className="size-4"
                                                            strokeWidth={2}
                                                            aria-hidden
                                                        />
                                                        <span className="sr-only">
                                                            Hapus {idea.title}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {used.length > 0 ? (
                            <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6">
                                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                    Sudah dijadwalkan
                                </h2>
                                <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">
                                    Ide yang sudah menjadi konten di kalender.
                                </p>
                                <ul className="flex flex-col">
                                    {used.map((idea) => (
                                        <li key={idea.id}>
                                            <Link
                                                href={contentIndex({
                                                    query: {
                                                        konten: String(
                                                            idea.content?.id ??
                                                                '',
                                                        ),
                                                    },
                                                })}
                                                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-neutral-soft"
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[0.8438rem] font-bold text-secondary-foreground">
                                                        {idea.title}
                                                    </span>
                                                    <span
                                                        className="mt-0.5 block text-xs text-muted-foreground"
                                                        data-numeric
                                                    >
                                                        Tayang{' '}
                                                        {entryDate(
                                                            idea.content
                                                                ?.scheduledFor ??
                                                                idea.createdAt,
                                                        )}
                                                    </span>
                                                </span>
                                                {idea.content ? (
                                                    <StatusPill
                                                        status={
                                                            idea.content.status
                                                        }
                                                    />
                                                ) : null}
                                                <ChevronRight
                                                    className="size-4 shrink-0 text-muted-foreground"
                                                    strokeWidth={2}
                                                    aria-hidden
                                                />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ) : null}
                    </div>
                </div>
            </div>

            <ContentDialog
                compose={compose}
                open={compose !== null}
                onOpenChange={(next) => {
                    if (!next) {
                        setCompose(null);
                    }
                }}
            />

            <DeleteIdeaDialog
                idea={deleting}
                onOpenChange={(next) => {
                    if (!next) {
                        setDeleting(null);
                    }
                }}
            />
        </>
    );
}

/** Title first, everything else optional: the cost of writing one down. */
function IdeaComposer() {
    const { channels } = useContentPlan();

    const [title, setTitle] = useState('');
    const [channel, setChannel] = useState(ANY_CHANNEL);
    const [note, setNote] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!title.trim()) {
            setError('Tulis dulu idenya, satu kalimat cukup.');

            return;
        }

        setError(null);

        router.post(
            storeIdea().url,
            {
                title: title.trim(),
                channel: channel === ANY_CHANNEL ? '' : channel,
                note: note.trim(),
                source_url: sourceUrl.trim(),
            },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    setTitle('');
                    setChannel(ANY_CHANNEL);
                    setNote('');
                    setSourceUrl('');
                },
                onError: (errors) =>
                    setError(
                        Object.values(errors)[0] ?? 'Ide belum bisa disimpan.',
                    ),
            },
        );
    };

    return (
        <form
            onSubmit={submit}
            noValidate
            className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6 xl:sticky xl:top-6"
        >
            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                Tulis ide
            </h2>
            <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">
                Selagi ingat. Hanya judul yang wajib; sisanya bisa menyusul saat
                dijadwalkan.
            </p>

            <div className="flex flex-col gap-4">
                <Field id="idea-title" label="Ide" error={error ?? undefined}>
                    <Input
                        id="idea-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Serial 60 detik paham Coretax"
                        aria-invalid={Boolean(error)}
                    />
                </Field>

                <Field id="idea-channel" label="Channel" optional>
                    <Select value={channel} onValueChange={setChannel}>
                        <SelectTrigger id="idea-channel" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY_CHANNEL}>
                                Bebas, belum ditentukan
                            </SelectItem>
                            {(Object.keys(channels) as ChannelKey[]).map(
                                (key) => (
                                    <SelectItem key={key} value={key}>
                                        <ChannelIcon channel={key} />
                                        {CHANNEL_LABELS[key]}
                                    </SelectItem>
                                ),
                            )}
                        </SelectContent>
                    </Select>
                </Field>

                <Field
                    id="idea-note"
                    label="Catatan"
                    optional
                    hint="Angle, contoh, atau alasan ide ini layak dibuat."
                >
                    <Textarea
                        id="idea-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Satu fitur per episode, bahasa awam…"
                        className="min-h-20"
                        aria-describedby="idea-note-hint"
                    />
                </Field>

                <Field id="idea-source" label="Sumber" optional>
                    <Input
                        id="idea-source"
                        type="url"
                        inputMode="url"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                        placeholder="https://…"
                    />
                </Field>

                <Button
                    type="submit"
                    className="w-full shadow-teal"
                    disabled={saving}
                >
                    <Check strokeWidth={2.5} aria-hidden />
                    {saving ? 'Menyimpan…' : 'Simpan Ide'}
                </Button>
            </div>
        </form>
    );
}

function DeleteIdeaDialog({
    idea,
    onOpenChange,
}: {
    idea: ContentIdea | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [last, setLast] = useState<ContentIdea | null>(idea);

    if (idea && idea !== last) {
        setLast(idea);
    }

    const shown = idea ?? last;
    const [deleting, setDeleting] = useState(false);

    const submit = () => {
        if (!shown) {
            return;
        }

        router.delete(destroyIdea(shown.id).url, {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={idea !== null} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                        Hapus ide
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {shown?.title} akan hilang dari daftar. Ide yang sudah
                        pernah dijadwalkan tetap tercatat di kontennya.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => onOpenChange(false)}
                        disabled={deleting}
                    >
                        Batal
                    </Button>
                    {/* Ink, not red: deleting is a decision, not a breach. */}
                    <Button
                        type="button"
                        onClick={submit}
                        disabled={deleting}
                        className="bg-ink-panel text-white hover:bg-ink-panel/90"
                    >
                        <Trash2 strokeWidth={2} aria-hidden />
                        {deleting ? 'Menghapus…' : 'Hapus ide'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

ContentIdeasPage.layout = {
    breadcrumbs: [
        { title: 'Konten', href: contentIndex() },
        { title: 'Ide Konten', href: ideasIndex() },
    ],
};
