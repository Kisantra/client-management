import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TemplateSummary } from '@/data/letters';
import { rowLink } from '@/lib/row-link';
import { letters } from '@/routes';
import {
    edit as templateEdit,
    seed as seedTemplates,
} from '@/routes/letters/templates';

type Props = {
    templates: TemplateSummary[];
    /** Built-in templates not yet on this install. */
    missingDefaults: number;
};

/**
 * The kinds of letter the office sends, each with its own wording.
 */
export default function LetterTemplatesPage({
    templates,
    missingDefaults,
}: Props) {
    return (
        <>
            <Head title="Template Surat" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
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
                        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Template surat
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Redaksi tiap jenis surat. Mengubahnya mengubah surat
                            yang dibuat setelahnya; surat yang sudah terbit
                            tetap seperti saat dikirim.
                        </p>
                    </div>

                    {missingDefaults > 0 ? (
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={() =>
                                router.post(
                                    seedTemplates().url,
                                    {},
                                    {
                                        preserveScroll: true,
                                    },
                                )
                            }
                        >
                            Pasang template bawaan
                        </Button>
                    ) : null}
                </div>

                <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                    {templates.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-10 text-center text-xs text-muted-foreground">
                            Belum ada template. Pasang yang bawaan dari tombol
                            di atas.
                        </p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-border">
                            {templates.map((template) => (
                                <li
                                    key={template.id}
                                    {...rowLink(templateEdit(template.id))}
                                    className="flex cursor-pointer items-center gap-4 py-4 transition-colors first:pt-0 last:pb-0 hover:bg-neutral-soft/60"
                                >
                                    <span
                                        className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-deep"
                                        aria-hidden
                                    >
                                        <FileText
                                            className="size-4.5"
                                            strokeWidth={1.75}
                                        />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <Link
                                                href={templateEdit(template.id)}
                                                prefetch
                                                className="text-[0.8438rem] font-bold underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                                            >
                                                {template.name}
                                            </Link>
                                            <span
                                                className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold text-secondary-foreground"
                                                data-numeric
                                            >
                                                {template.prefix}-…
                                            </span>
                                            {template.active ? null : (
                                                <span className="rounded-full bg-ink-panel px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                                                    Nonaktif
                                                </span>
                                            )}
                                        </span>
                                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                            {template.description ??
                                                template.subject}
                                        </span>
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                            <span data-numeric>
                                                {template.fields}
                                            </span>{' '}
                                            isian ·{' '}
                                            <span data-numeric>
                                                {template.letters}
                                            </span>{' '}
                                            surat dibuat
                                        </span>
                                    </span>
                                    <ChevronRight
                                        className="size-4 shrink-0 text-muted-foreground"
                                        strokeWidth={2}
                                        aria-hidden
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}
