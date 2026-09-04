import { router } from '@inertiajs/react';
import {
    Check,
    MessageSquareText,
    RotateCcw,
    Send,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ContentComment } from '@/data/content';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import {
    destroy as destroyComment,
    store as storeComment,
    update as updateComment,
} from '@/routes/content/comments';

const stamp = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
});

/**
 * The review, said out loud: notes from whoever checked the piece, each one
 * open until somebody acts on it and signs it off. The open ones sit on top
 * because they are the work; the settled ones stay below as the record.
 */
export function CommentThread({
    contentId,
    comments,
}: {
    contentId: number;
    comments: ContentComment[];
}) {
    const open = comments.filter((comment) => !comment.resolved);
    const resolved = comments.filter((comment) => comment.resolved);

    return (
        <div className="flex flex-col gap-4">
            <Composer contentId={contentId} />

            {comments.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                        <MessageSquareText
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    </span>
                    <p className="text-sm font-bold">Belum ada catatan</p>
                    <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
                        Yang mereview menulis di sini apa yang harus diperbaiki
                        sebelum konten naik status.
                    </p>
                </div>
            ) : (
                <ul className="flex flex-col gap-4">
                    {open.map((comment) => (
                        <CommentRow
                            key={comment.id}
                            contentId={contentId}
                            comment={comment}
                        />
                    ))}

                    {resolved.length > 0 ? (
                        <li aria-hidden>
                            <p className="flex items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                                Selesai
                                <span className="h-px flex-1 bg-border" />
                            </p>
                        </li>
                    ) : null}

                    {resolved.map((comment) => (
                        <CommentRow
                            key={comment.id}
                            contentId={contentId}
                            comment={comment}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

function Composer({ contentId }: { contentId: number }) {
    const [body, setBody] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!body.trim()) {
            setError('Tulis dulu catatannya.');

            return;
        }

        setError(null);

        router.post(
            storeComment(contentId).url,
            { body: body.trim() },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setBody(''),
                onError: (errors) =>
                    setError(
                        Object.values(errors)[0] ??
                            'Catatan belum bisa disimpan.',
                    ),
            },
        );
    };

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-2">
            <label htmlFor="comment-body" className="sr-only">
                Catatan review
            </label>
            <Textarea
                id="comment-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Apa yang harus diperbaiki? Misalnya: angka di slide 3 belum sesuai PMK terbaru…"
                className="min-h-20"
                aria-invalid={Boolean(error)}
            />
            {error ? (
                <p className="text-xs font-semibold text-destructive">
                    {error}
                </p>
            ) : null}
            <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={saving}>
                    <Send strokeWidth={2} aria-hidden />
                    {saving ? 'Menyimpan…' : 'Kirim Catatan'}
                </Button>
            </div>
        </form>
    );
}

function CommentRow({
    contentId,
    comment,
}: {
    contentId: number;
    comment: ContentComment;
}) {
    const initials = useInitials();
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const toggle = () =>
        router.patch(
            updateComment([contentId, comment.id]).url,
            { resolved: !comment.resolved },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
            },
        );

    const remove = () =>
        router.delete(destroyComment([contentId, comment.id]).url, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });

    return (
        <li className="flex items-start gap-3">
            <span
                className={cn(
                    'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[0.6875rem] font-extrabold',
                    comment.resolved
                        ? 'bg-neutral-soft text-muted-foreground'
                        : 'bg-primary-soft text-primary-deep',
                )}
                aria-hidden
            >
                {initials(comment.author)}
            </span>

            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                        className={cn(
                            'text-[0.8438rem] font-bold',
                            comment.resolved && 'text-muted-foreground',
                        )}
                    >
                        {comment.author}
                    </span>
                    <span
                        className="text-xs text-muted-foreground"
                        data-numeric
                    >
                        {stamp.format(new Date(comment.at))}
                    </span>
                    {comment.resolved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-extrabold text-muted-foreground">
                            <Check
                                className="size-3"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            Selesai
                            {comment.resolvedBy
                                ? ` · ${comment.resolvedBy}`
                                : ''}
                        </span>
                    ) : null}
                </p>

                <p
                    className={cn(
                        'mt-1 text-[0.8438rem] leading-relaxed whitespace-pre-line',
                        comment.resolved
                            ? 'text-muted-foreground'
                            : 'text-secondary-foreground',
                    )}
                >
                    {comment.body}
                </p>

                <p className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={toggle}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-md bg-neutral-soft px-2.5 py-1.5 text-xs font-bold text-secondary-foreground transition-colors hover:bg-primary-soft hover:text-primary-deep disabled:opacity-50"
                    >
                        {comment.resolved ? (
                            <>
                                <RotateCcw
                                    className="size-3"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                                Buka lagi
                            </>
                        ) : (
                            <>
                                <Check
                                    className="size-3"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                                Tandai selesai
                            </>
                        )}
                    </button>

                    {confirming ? (
                        <>
                            <button
                                type="button"
                                onClick={remove}
                                disabled={busy}
                                className="rounded-md bg-ink-panel px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-ink-panel/90 disabled:opacity-50"
                            >
                                Yakin hapus?
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                className="rounded-md px-2 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Batal
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirming(true)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                        >
                            <Trash2
                                className="size-3"
                                strokeWidth={2}
                                aria-hidden
                            />
                            Hapus
                        </button>
                    )}
                </p>
            </div>
        </li>
    );
}
