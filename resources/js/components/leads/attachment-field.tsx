import { FileText, ImageIcon, Paperclip, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type Attachment = {
    id: number;
    file: File;
    /** Object URL for images; revoked when the file is removed. */
    preview?: string;
};

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';

function readableSize(bytes: number) {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
    }

    return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
}

const DEFAULT_HINT =
    'Screenshot chat, kartu nama, atau dokumen awal · JPG, PNG, WebP, PDF · maks 10 MB per berkas';

export function AttachmentField({
    items,
    onChange,
    /** What belongs here differs by context; a contract is not a chat screenshot. */
    hint = DEFAULT_HINT,
    className,
}: {
    items: Attachment[];
    onChange: (items: Attachment[]) => void;
    hint?: string;
    className?: string;
}) {
    const input = useRef<HTMLInputElement>(null);
    const nextId = useRef(1);
    const [dragging, setDragging] = useState(false);
    const [rejected, setRejected] = useState<string[]>([]);

    /**
     * Object URLs outlive the component unless they are handed back, but the
     * revoking must happen only on unmount: keying the cleanup to `items` would
     * revoke every existing preview the moment another file is added, breaking
     * the thumbnails already on screen. `remove` handles the per-file case.
     */
    const latest = useRef(items);

    useEffect(() => {
        latest.current = items;
    }, [items]);

    useEffect(
        () => () => {
            latest.current.forEach((item) => {
                if (item.preview) {
                    URL.revokeObjectURL(item.preview);
                }
            });
        },
        [],
    );

    const add = (files: FileList | null) => {
        if (!files || files.length === 0) {
            return;
        }

        const tooBig: string[] = [];
        const accepted: Attachment[] = [];

        Array.from(files).forEach((file) => {
            if (file.size > MAX_BYTES) {
                tooBig.push(file.name);

                return;
            }

            nextId.current += 1;

            accepted.push({
                id: nextId.current,
                file,
                preview: file.type.startsWith('image/')
                    ? URL.createObjectURL(file)
                    : undefined,
            });
        });

        setRejected(tooBig);
        onChange([...items, ...accepted]);
    };

    const remove = (id: number) => {
        const target = items.find((item) => item.id === id);

        if (target?.preview) {
            URL.revokeObjectURL(target.preview);
        }

        onChange(items.filter((item) => item.id !== id));
    };

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    add(event.dataTransfer.files);
                }}
                className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center transition-colors',
                    dragging
                        ? 'border-primary bg-primary-soft'
                        : 'border-border bg-neutral-soft/60 hover:border-primary/40 hover:bg-neutral-soft',
                )}
            >
                <span className="grid size-10 place-items-center rounded-lg bg-card text-secondary-foreground shadow-lift">
                    <Upload className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-[0.8438rem] font-bold">
                    Seret berkas ke sini, atau klik untuk memilih
                </span>
                <span className="text-xs text-muted-foreground">{hint}</span>
            </button>

            <input
                ref={input}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                onChange={(event) => {
                    add(event.target.files);
                    // Re-selecting the same file must still fire a change.
                    event.target.value = '';
                }}
            />

            {rejected.length > 0 ? (
                <p className="text-xs font-semibold text-destructive">
                    Lebih dari 10 MB, tidak dilampirkan: {rejected.join(', ')}
                </p>
            ) : null}

            {items.length > 0 ? (
                <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 shadow-lift"
                        >
                            {item.preview ? (
                                <img
                                    src={item.preview}
                                    alt=""
                                    className="size-10 shrink-0 rounded-md object-cover"
                                />
                            ) : (
                                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-neutral-soft text-secondary-foreground">
                                    {item.file.type === 'application/pdf' ? (
                                        <FileText
                                            className="size-4"
                                            strokeWidth={1.75}
                                            aria-hidden
                                        />
                                    ) : (
                                        <ImageIcon
                                            className="size-4"
                                            strokeWidth={1.75}
                                            aria-hidden
                                        />
                                    )}
                                </span>
                            )}

                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.8438rem] font-bold">
                                    {item.file.name}
                                </span>
                                <span
                                    className="block text-xs text-muted-foreground"
                                    data-numeric
                                >
                                    {readableSize(item.file.size)}
                                </span>
                            </span>

                            <button
                                type="button"
                                onClick={() => remove(item.id)}
                                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                            >
                                <X
                                    className="size-4"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                                <span className="sr-only">
                                    Hapus {item.file.name}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Paperclip
                        className="size-3.5"
                        strokeWidth={2}
                        aria-hidden
                    />
                    Belum ada lampiran.
                </p>
            )}
        </div>
    );
}
