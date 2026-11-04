import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Check, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/leads/form-field';
import { LeadPicker } from '@/components/letters/lead-picker';
import { Button } from '@/components/ui/button';
import { byCategory } from '@/data/letters';
import type { LeadOption, TemplateOption } from '@/data/letters';
import { cn } from '@/lib/utils';
import { letters } from '@/routes';
import { store as letterStore } from '@/routes/letters';
import { seed as seedTemplates } from '@/routes/letters/templates';

type Props = {
    templates: TemplateOption[];
    categories: Record<string, string>;
    leads: LeadOption[];
    /** Opened from a lead's page: that lead, already chosen. */
    leadId: number | null;
};

/**
 * A new letter needs two decisions and nothing else: which kind, and to
 * whom. Everything after that is filled in on the letter itself, where the
 * page can be seen taking shape.
 */
export default function LetterCreatePage({
    templates,
    categories,
    leads,
    leadId,
}: Props) {
    const [templateId, setTemplateId] = useState<number | null>(
        templates.length === 1 ? templates[0].id : null,
    );
    const [lead, setLead] = useState<number | null>(leadId);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    /* A choice made after a failed submit answers its own error; leaving
       "Pilih client yang dituju." under a picked client reads as a fault. */
    const clearError = (key: string) =>
        setErrors((current) => {
            const next = { ...current };
            delete next[key];

            return next;
        });
    const pickLead = (id: number) => {
        setLead(id);
        clearError('lead_id');
    };
    const pickTemplate = (id: number) => {
        setTemplateId(id);
        clearError('template_id');
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const next: Record<string, string> = {};

        if (!templateId) {
            next.template_id = 'Pilih jenis suratnya dulu.';
        }

        if (!lead) {
            next.lead_id = 'Pilih client yang dituju.';
        }

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        router.post(
            letterStore().url,
            { template_id: templateId, lead_id: lead },
            {
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onError: (serverErrors) => {
                    setErrors(serverErrors);
                    toast.error('Belum bisa dibuat', {
                        description: Object.values(serverErrors)[0],
                    });
                },
            },
        );
    };

    const pickedTemplate = templates.find((t) => t.id === templateId) ?? null;
    const pickedLead = leads.find((l) => l.id === lead) ?? null;

    /* Rendered twice on purpose: inside the summary that rides along at
       `xl`, and at the foot of the form below it, where it follows the
       choice the reader has just made. */
    const actions = (className: string) => (
        <div className={className}>
            <Button type="button" variant="outline" size="lg" asChild>
                <Link href={letters()}>Batal</Link>
            </Button>
            <Button
                type="submit"
                size="lg"
                className="shadow-teal"
                disabled={saving || templates.length === 0}
            >
                {saving ? 'Membuat…' : 'Buat draft'}
            </Button>
        </div>
    );

    return (
        <>
            <Head title="Buat Surat" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
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
                        Buat surat
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Pilih client yang dituju dan jenis suratnya. Isinya
                        dilengkapi di halaman berikutnya sambil melihat hasilnya
                        di atas kop.
                    </p>
                </div>

                {/* Same split as the letter and template editors: the long
                    choice takes the wide column, the short one and the
                    action ride along beside it so "Buat draft" never sits
                    a whole catalogue below the client it was picked for.
                    Below `xl` the DOM order reads client, kind, action. */}
                <form
                    onSubmit={submit}
                    className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,1.2fr)] xl:items-start"
                >
                    <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1">
                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6">
                            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                Client yang dituju
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Nama, PIC, dan inisialnya masuk ke surat dan ke
                                nomor. Lead yang sudah ditutup tidak ditawarkan.
                            </p>

                            <div className="mt-5">
                                <Field
                                    id="lead"
                                    label="Client"
                                    error={errors.lead_id}
                                    hint={
                                        leads.length === 0
                                            ? 'Belum ada lead aktif. Tambahkan dulu di halaman Leads.'
                                            : undefined
                                    }
                                >
                                    <LeadPicker
                                        id="lead"
                                        leads={leads}
                                        value={lead}
                                        onChange={pickLead}
                                    />
                                </Field>
                            </div>
                        </section>

                        {/* What is about to be made, and the one action
                            that makes it. Only beside the catalogue: on a
                            narrower screen the choices are already in view
                            directly above the buttons. */}
                        <section className="hidden rounded-xl border border-border bg-card shadow-lift xl:block">
                            <dl className="flex flex-col gap-4 p-5 sm:p-6">
                                <div>
                                    <dt className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                        Client
                                    </dt>
                                    <dd
                                        className={cn(
                                            'mt-1 text-[0.8438rem] font-bold',
                                            !pickedLead &&
                                                'font-normal text-muted-foreground',
                                        )}
                                    >
                                        {pickedLead
                                            ? pickedLead.name
                                            : 'Belum dipilih'}
                                        {pickedLead?.pic ? (
                                            <span className="block text-xs font-normal text-muted-foreground">
                                                PIC {pickedLead.pic}
                                            </span>
                                        ) : null}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                        Jenis surat
                                    </dt>
                                    <dd
                                        className={cn(
                                            'mt-1 text-[0.8438rem] font-bold',
                                            !pickedTemplate &&
                                                'font-normal text-muted-foreground',
                                        )}
                                    >
                                        {pickedTemplate
                                            ? pickedTemplate.name
                                            : 'Belum dipilih'}
                                        {pickedTemplate ? (
                                            <span
                                                className="mt-1.5 block w-fit rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold text-secondary-foreground"
                                                data-numeric
                                            >
                                                Nomor {pickedTemplate.prefix}-…
                                            </span>
                                        ) : null}
                                    </dd>
                                </div>
                            </dl>
                            {actions(
                                'flex gap-2.5 border-t border-border p-5 sm:px-6 [&>*]:flex-1',
                            )}
                        </section>
                    </aside>

                    <section className="@container min-w-0 rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6 xl:col-start-1 xl:row-start-1">
                        <h2 className="text-base font-extrabold tracking-[-0.02em]">
                            Jenis surat
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Redaksinya diambil dari template; yang bisa diubah
                            per surat adalah poin-poin isiannya.
                        </p>

                        {templates.length === 0 ? (
                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-soft p-4">
                                <p className="text-[0.8438rem] text-primary-deep">
                                    Belum ada template. Pasang redaksi bawaan
                                    kantor dulu.
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
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
                            </div>
                        ) : (
                            <div className="mt-6 flex flex-col gap-6">
                                {byCategory(templates, categories).map(
                                    (group) => (
                                        <div key={group.key}>
                                            <h3 className="mb-3 flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                                {group.label}
                                                <span
                                                    className="rounded-full bg-neutral-soft px-1.5 py-px tracking-normal"
                                                    data-numeric
                                                >
                                                    {group.items.length}
                                                </span>
                                            </h3>
                                            {/* The panel, not the window,
                                                decides the columns: three
                                                across only where the panel
                                                itself is wide enough. */}
                                            <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
                                                {group.items.map((template) => {
                                                    const picked =
                                                        template.id ===
                                                        templateId;

                                                    return (
                                                        <label
                                                            key={template.id}
                                                            className={cn(
                                                                'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                                                                picked
                                                                    ? 'border-primary bg-primary-soft'
                                                                    : 'border-border bg-card hover:border-primary/35',
                                                            )}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="template"
                                                                value={
                                                                    template.id
                                                                }
                                                                checked={picked}
                                                                onChange={() =>
                                                                    pickTemplate(
                                                                        template.id,
                                                                    )
                                                                }
                                                                className="sr-only"
                                                            />
                                                            <span
                                                                className={cn(
                                                                    'grid size-8 shrink-0 place-items-center rounded-md',
                                                                    picked
                                                                        ? 'bg-primary text-primary-foreground'
                                                                        : 'bg-neutral-soft text-muted-foreground',
                                                                )}
                                                                aria-hidden
                                                            >
                                                                {picked ? (
                                                                    <Check
                                                                        className="size-4"
                                                                        strokeWidth={
                                                                            2.5
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <FileText
                                                                        className="size-4"
                                                                        strokeWidth={
                                                                            1.75
                                                                        }
                                                                    />
                                                                )}
                                                            </span>
                                                            <span className="flex min-w-0 flex-1 flex-col self-stretch">
                                                                <span
                                                                    className={cn(
                                                                        'block text-[0.8438rem] leading-snug font-bold',
                                                                        picked &&
                                                                            'text-primary-deep',
                                                                    )}
                                                                >
                                                                    {
                                                                        template.name
                                                                    }
                                                                </span>
                                                                <span className="mt-1 mb-2.5 block text-xs leading-relaxed text-muted-foreground">
                                                                    {template.description ??
                                                                        template.subject}
                                                                </span>
                                                                {/* Pinned to the foot so the
                                                                    numbers line up across a row
                                                                    of cards of uneven length. */}
                                                                <span
                                                                    className={cn(
                                                                        'mt-auto w-fit rounded-full px-2 py-0.5 text-[0.6875rem] font-bold text-secondary-foreground',
                                                                        picked
                                                                            ? 'bg-card'
                                                                            : 'bg-neutral-soft',
                                                                    )}
                                                                    data-numeric
                                                                >
                                                                    Nomor{' '}
                                                                    {
                                                                        template.prefix
                                                                    }
                                                                    -…
                                                                </span>
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        )}

                        {errors.template_id ? (
                            <p className="mt-3 text-xs font-semibold text-destructive">
                                {errors.template_id}
                            </p>
                        ) : null}
                    </section>

                    {actions('flex flex-wrap justify-end gap-2.5 xl:hidden')}
                </form>
            </div>
        </>
    );
}
