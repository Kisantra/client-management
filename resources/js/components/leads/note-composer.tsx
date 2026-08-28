import { router } from '@inertiajs/react';
import { Paperclip, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { AttachmentField } from '@/components/leads/attachment-field';
import type { Attachment } from '@/components/leads/attachment-field';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { store as storeNote } from '@/routes/leads/notes';

/**
 * A note plus the evidence behind it. Attachments stay collapsed until asked
 * for, so the common case — a quick line of text — costs one field.
 */
export function NoteComposer({ leadId }: { leadId: number }) {
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<Attachment[]>([]);
    const [showFiles, setShowFiles] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    // A forwarded screenshot is a record even with nothing typed next to it.
    const empty = body.trim() === '' && files.length === 0;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (empty) {
            return;
        }

        router.post(
            storeNote(leadId).url,
            { body: body.trim(), files: files.map((item) => item.file) },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => {
                    setSaving(true);
                    setFailed(null);
                },
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    setBody('');
                    setFiles([]);
                    setShowFiles(false);
                },
                onError: (errors) =>
                    setFailed(
                        Object.values(errors)[0] ??
                            'Catatan tidak bisa disimpan.',
                    ),
            },
        );
    };

    return (
        <form onSubmit={submit} className="mb-5 border-b border-border pb-5">
            <label htmlFor="note-body" className="sr-only">
                Catatan baru
            </label>
            <Textarea
                id="note-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Tulis hasil percakapan, kesepakatan, atau hal yang perlu diingat…"
                className="min-h-24"
            />

            {showFiles ? (
                <div className="mt-3">
                    <AttachmentField items={files} onChange={setFiles} />
                </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <Button
                    type="submit"
                    disabled={empty || saving}
                    className="shadow-teal"
                >
                    <Send strokeWidth={2} aria-hidden />
                    {saving ? 'Menyimpan…' : 'Simpan catatan'}
                </Button>

                {showFiles ? null : (
                    <button
                        type="button"
                        onClick={() => setShowFiles(true)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-[0.8438rem] font-bold text-muted-foreground transition-colors hover:text-primary-deep"
                    >
                        <Paperclip
                            className="size-3.5"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                        Lampirkan berkas
                    </button>
                )}

                {files.length > 0 ? (
                    <span
                        className="text-xs font-semibold text-muted-foreground"
                        data-numeric
                    >
                        {files.length} berkas siap dilampirkan
                    </span>
                ) : null}
            </div>

            {failed ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                    <TriangleAlert
                        className="size-3.5 shrink-0"
                        strokeWidth={2.5}
                        aria-hidden
                    />
                    {failed}
                </p>
            ) : null}
        </form>
    );
}
