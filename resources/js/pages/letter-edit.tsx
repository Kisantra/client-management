import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    Check,
    CircleDashed,
    Download,
    ExternalLink,
    Loader2,
    Send,
    Trash2,
    Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Field } from '@/components/leads/form-field';
import { ConfirmDialog } from '@/components/letters/confirm-dialog';
import { FieldEditor } from '@/components/letters/field-editor';
import { Paper } from '@/components/letters/paper';
import { StatusPill } from '@/components/letters/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { longDate, rupiah } from '@/data/leads';
import type {
    FieldValue,
    LetterDetail,
    LetterField,
    LetterValues,
    Preview,
} from '@/data/letters';
import { cn } from '@/lib/utils';
import { letters } from '@/routes';
import { show as leadShow } from '@/routes/leads';
import {
    cancel as cancelLetter,
    destroy as destroyLetter,
    pdf as letterPdf,
    update as updateLetter,
} from '@/routes/letters';
import {
    destroy as unissueLetter,
    store as issueLetter,
} from '@/routes/letters/issue';

type Props = {
    letter: LetterDetail;
    fields: LetterField[];
    preview: Preview;
    /** Labels of required blanks still empty; the letter cannot issue until none. */
    missing: string[];
    total: number;
    nextNumber: string;
};

type Draft = {
    subject: string;
    recipient: string;
    letter_date: string;
    signer_name: string;
    signer_title: string;
    values: LetterValues;
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';

const SAVE_DELAY = 600;

/**
 * One letter: the blanks on the left, the page on the right.
 *
 * The draft saves itself a moment after each change and the page is
 * re-rendered by the server from what was saved, so the preview is always
 * of the record and never of an unsaved screen. Issuing needs every
 * required blank filled; after that the words are frozen and the actions
 * change to the ones an issued letter has.
 */
export default function LetterEditPage({
    letter,
    fields,
    preview,
    missing,
    total,
    nextNumber,
}: Props) {
    const editable = letter.status === 'draft';

    const [draft, setDraft] = useState<Draft>(() => ({
        subject: letter.subject,
        recipient: letter.recipient,
        letter_date: letter.date,
        signer_name: letter.signerName,
        signer_title: letter.signerTitle,
        values: { ...letter.values },
    }));
    const [save, setSave] = useState<SaveState>('idle');
    const [errors, setErrors] = useState<Record<string, string>>({});

    /* The draft to send next, and whether anything has changed since the
       last save. Refs, because the timer must read the latest without
       restarting on every keystroke. */
    const pending = useRef<Draft | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [confirm, setConfirm] = useState<
        'issue' | 'unissue' | 'cancel' | 'delete' | null
    >(null);
    const [busy, setBusy] = useState(false);

    const flush = (then?: () => void) => {
        const body = pending.current;

        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }

        if (!body) {
            then?.();

            return;
        }

        pending.current = null;

        router.patch(updateLetter(letter.id).url, body, {
            preserveState: true,
            preserveScroll: true,
            onStart: () => setSave('saving'),
            onSuccess: () => {
                setErrors({});
                setSave(pending.current ? 'dirty' : 'saved');
                then?.();
            },
            onError: (serverErrors) => {
                setErrors(serverErrors);
                setSave('failed');
            },
        });
    };

    const change = (patch: Partial<Draft>) => {
        const next = { ...draft, ...patch };

        setDraft(next);
        setSave('dirty');
        pending.current = next;

        if (timer.current) {
            clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => flush(), SAVE_DELAY);
    };

    const changeValue = (key: string, value: FieldValue) =>
        change({ values: { ...draft.values, [key]: value } });

    /*
     | Leaving the page must not lose the last few keystrokes. This is a plain
     | request rather than an Inertia visit: a visit would follow the redirect
     | and drag the reader back to the letter they just walked away from.
     */
    useEffect(() => {
        const url = updateLetter(letter.id).url;

        return () => {
            if (timer.current && pending.current) {
                clearTimeout(timer.current);
                saveQuietly(url, pending.current);
                pending.current = null;
            }
        };
    }, [letter.id]);

    const act = (
        method: 'post' | 'delete',
        url: string,
        options: { redirect?: boolean } = {},
    ) => {
        const visit = {
            preserveScroll: !options.redirect,
            onStart: () => setBusy(true),
            onFinish: () => {
                setBusy(false);
                setConfirm(null);
            },
        };

        const run = () =>
            method === 'post'
                ? router.post(url, {}, visit)
                : router.delete(url, visit);

        flush(run);
    };

    const canIssue = editable && missing.length === 0 && save !== 'failed';

    return (
        <>
            <Head title={letter.number ?? letter.subject} />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0">
                        <Link
                            href={letters()}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary-deep"
                        >
                            <ArrowLeft
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            Kembali ke Surat
                        </Link>
                        <h1 className="mt-2 truncate text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            {draft.subject || letter.template.name}
                        </h1>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
                            <StatusPill
                                status={letter.status}
                                label={letter.statusLabel}
                            />
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {letter.number ??
                                    `${nextNumber} (setelah terbit)`}
                            </span>
                            <span aria-hidden>·</span>
                            <Link
                                href={leadShow(letter.client.id)}
                                prefetch
                                className="font-bold underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                            >
                                {letter.client.name}
                            </Link>
                            <span aria-hidden>·</span>
                            <span>{letter.template.name}</span>
                        </p>
                    </div>

                    <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
                        {editable ? (
                            <>
                                {letter.canDelete ? (
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="flex-1 sm:flex-none"
                                        onClick={() => setConfirm('delete')}
                                    >
                                        <Trash2 strokeWidth={2} aria-hidden />
                                        Hapus
                                    </Button>
                                ) : (
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="flex-1 sm:flex-none"
                                        onClick={() => setConfirm('cancel')}
                                    >
                                        <Ban strokeWidth={2} aria-hidden />
                                        Batalkan
                                    </Button>
                                )}
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="flex-1 sm:flex-none"
                                    asChild
                                >
                                    <a
                                        href={
                                            letterPdf(letter.id, {
                                                query: { lihat: 1 },
                                            }).url
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink
                                            strokeWidth={2}
                                            aria-hidden
                                        />
                                        Lihat PDF
                                    </a>
                                </Button>
                                <Button
                                    size="lg"
                                    className="flex-1 shadow-teal sm:flex-none"
                                    disabled={!canIssue || busy}
                                    onClick={() => setConfirm('issue')}
                                    title={
                                        missing.length
                                            ? `Lengkapi dulu: ${missing.join(', ')}`
                                            : undefined
                                    }
                                >
                                    <Send strokeWidth={2} aria-hidden />
                                    Terbitkan
                                </Button>
                            </>
                        ) : (
                            <>
                                {letter.status === 'terbit' ? (
                                    <>
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="flex-1 sm:flex-none"
                                            onClick={() => setConfirm('cancel')}
                                        >
                                            <Ban strokeWidth={2} aria-hidden />
                                            Batalkan
                                        </Button>
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="flex-1 sm:flex-none"
                                            onClick={() =>
                                                setConfirm('unissue')
                                            }
                                        >
                                            <Undo2
                                                strokeWidth={2}
                                                aria-hidden
                                            />
                                            Ubah lagi
                                        </Button>
                                    </>
                                ) : null}
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="flex-1 sm:flex-none"
                                    asChild
                                >
                                    <a
                                        href={
                                            letterPdf(letter.id, {
                                                query: { lihat: 1 },
                                            }).url
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink
                                            strokeWidth={2}
                                            aria-hidden
                                        />
                                        Lihat PDF
                                    </a>
                                </Button>
                                <Button
                                    size="lg"
                                    className="flex-1 shadow-teal sm:flex-none"
                                    asChild
                                >
                                    <a href={letterPdf(letter.id).url}>
                                        <Download strokeWidth={2} aria-hidden />
                                        Unduh PDF
                                    </a>
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(20rem,2fr)_3fr] xl:items-start">
                    <div className="flex min-w-0 flex-col gap-5">
                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <header className="mb-4 flex items-center justify-between gap-3">
                                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                    Kepala surat
                                </h2>
                                <SaveBadge state={save} editable={editable} />
                            </header>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    id="subject"
                                    label="Perihal"
                                    error={errors.subject}
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="subject"
                                        value={draft.subject}
                                        onChange={(event) =>
                                            change({
                                                subject: event.target.value,
                                            })
                                        }
                                        disabled={!editable}
                                    />
                                </Field>
                                <Field
                                    id="recipient"
                                    label="Yth."
                                    error={errors.recipient}
                                    hint="Boleh memakai {{klien}}, {{klien_kapital}}, atau {{pic}}."
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="recipient"
                                        value={draft.recipient}
                                        onChange={(event) =>
                                            change({
                                                recipient: event.target.value,
                                            })
                                        }
                                        disabled={!editable}
                                    />
                                </Field>
                                <Field
                                    id="letter_date"
                                    label="Tanggal surat"
                                    error={errors.letter_date}
                                    hint={
                                        editable && !letter.number
                                            ? 'Bulan dan tahunnya masuk ke nomor.'
                                            : undefined
                                    }
                                >
                                    <Input
                                        id="letter_date"
                                        type="date"
                                        value={draft.letter_date}
                                        onChange={(event) =>
                                            change({
                                                letter_date: event.target.value,
                                            })
                                        }
                                        disabled={!editable}
                                    />
                                </Field>
                                <Field
                                    id="signer_name"
                                    label="Ditandatangani oleh"
                                    error={errors.signer_name}
                                >
                                    <Input
                                        id="signer_name"
                                        value={draft.signer_name}
                                        onChange={(event) =>
                                            change({
                                                signer_name: event.target.value,
                                            })
                                        }
                                        disabled={!editable}
                                    />
                                </Field>
                                <Field
                                    id="signer_title"
                                    label="Jabatan"
                                    error={errors.signer_title}
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="signer_title"
                                        value={draft.signer_title}
                                        onChange={(event) =>
                                            change({
                                                signer_title:
                                                    event.target.value,
                                            })
                                        }
                                        disabled={!editable}
                                    />
                                </Field>
                            </div>
                        </section>

                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <header className="mb-4 flex items-center justify-between gap-3">
                                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                    Isi surat
                                </h2>
                                <span className="shrink-0 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                    <span data-numeric>{fields.length}</span>{' '}
                                    isian
                                </span>
                            </header>

                            <div className="flex flex-col gap-5">
                                {fields.map((field) => (
                                    <FieldEditor
                                        key={field.key}
                                        field={field}
                                        value={draft.values[field.key]}
                                        onChange={(value) =>
                                            changeValue(field.key, value)
                                        }
                                        error={errors[`values.${field.key}`]}
                                        disabled={!editable}
                                    />
                                ))}
                            </div>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                                <span>
                                    Total biaya{' '}
                                    <span
                                        className="font-extrabold text-foreground"
                                        data-numeric
                                    >
                                        {rupiah.format(total)}
                                    </span>
                                </span>
                                {editable ? (
                                    missing.length > 0 ? (
                                        <span className="font-semibold text-destructive">
                                            Belum lengkap: {missing.join(', ')}
                                        </span>
                                    ) : (
                                        <span className="font-semibold text-primary-deep">
                                            Siap diterbitkan
                                        </span>
                                    )
                                ) : (
                                    <span>
                                        Isian terkunci sejak{' '}
                                        {letter.issuedAt
                                            ? longDate(letter.issuedAt)
                                            : 'diterbitkan'}
                                        .
                                    </span>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="min-w-0 xl:sticky xl:top-6">
                        <Paper preview={preview} busy={save === 'saving'} />
                        <p className="mt-3 text-center text-xs text-muted-foreground">
                            Tampilan ini dirender dari data tersimpan, sama
                            persis dengan PDF-nya.
                        </p>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={confirm === 'issue'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Terbitkan surat"
                description={`Surat mendapat nomor ${nextNumber} dan isinya dikunci. Kalau masih ada yang salah, surat bisa ditarik lagi ke draft tanpa mengubah nomornya.`}
                action="Terbitkan"
                busy={busy}
                onConfirm={() => act('post', issueLetter(letter.id).url)}
            />

            <ConfirmDialog
                open={confirm === 'unissue'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Ubah lagi"
                description={`Surat kembali menjadi draft supaya isinya bisa diperbaiki. Nomor ${letter.number ?? ''} tetap dipakai saat diterbitkan lagi.`}
                action="Tarik ke draft"
                busy={busy}
                onConfirm={() => act('delete', unissueLetter(letter.id).url)}
            />

            <ConfirmDialog
                open={confirm === 'cancel'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Batalkan surat"
                description={`Surat berstatus dibatalkan dan tidak bisa diterbitkan lagi. Nomor ${letter.number ?? ''} tetap tercatat dan tidak dipakai surat lain.`}
                action="Batalkan surat"
                busy={busy}
                onConfirm={() => act('post', cancelLetter(letter.id).url)}
            />

            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Hapus draft"
                description="Draft ini belum bernomor, jadi tidak ada urutan yang terpakai. Isiannya hilang dan tidak bisa dikembalikan."
                action="Hapus draft"
                busy={busy}
                destructive
                onConfirm={() =>
                    act('delete', destroyLetter(letter.id).url, {
                        redirect: true,
                    })
                }
            />
        </>
    );
}

/**
 * The draft, sent without navigating: same endpoint, same session, the
 * CSRF token read from the cookie Laravel sets for exactly this. keepalive
 * lets the request outlive the page it was sent from.
 */
function saveQuietly(url: string, body: Draft): void {
    const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    void fetch(url, {
        method: 'PATCH',
        credentials: 'same-origin',
        keepalive: true,
        redirect: 'manual',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
        },
        body: JSON.stringify(body),
    }).catch(() => undefined);
}

/** Where the draft stands: typing, saving, saved, or refused. */
function SaveBadge({
    state,
    editable,
}: {
    state: SaveState;
    editable: boolean;
}) {
    if (!editable) {
        return (
            <span className="shrink-0 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Terkunci
            </span>
        );
    }

    const shown: Record<
        SaveState,
        { label: string; icon: React.ReactNode; tone: string }
    > = {
        idle: {
            label: 'Tersimpan otomatis',
            icon: (
                <CircleDashed
                    className="size-3"
                    strokeWidth={2.5}
                    aria-hidden
                />
            ),
            tone: 'bg-neutral-soft text-muted-foreground',
        },
        dirty: {
            label: 'Mengetik…',
            icon: (
                <CircleDashed
                    className="size-3"
                    strokeWidth={2.5}
                    aria-hidden
                />
            ),
            tone: 'bg-neutral-soft text-muted-foreground',
        },
        saving: {
            label: 'Menyimpan…',
            icon: (
                <Loader2
                    className="size-3 animate-spin"
                    strokeWidth={2.5}
                    aria-hidden
                />
            ),
            tone: 'bg-neutral-soft text-muted-foreground',
        },
        saved: {
            label: 'Tersimpan',
            icon: <Check className="size-3" strokeWidth={3} aria-hidden />,
            tone: 'bg-primary-soft text-primary-deep',
        },
        failed: {
            label: 'Belum tersimpan',
            icon: <Ban className="size-3" strokeWidth={2.5} aria-hidden />,
            tone: 'bg-destructive-soft text-destructive',
        },
    };

    const { label, icon, tone } = shown[state];

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                tone,
            )}
            aria-live="polite"
        >
            {icon}
            {label}
        </span>
    );
}
