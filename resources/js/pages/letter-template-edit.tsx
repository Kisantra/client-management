import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Copy, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/leads/form-field';
import { ConfirmDialog } from '@/components/letters/confirm-dialog';
import { FieldEditor } from '@/components/letters/field-editor';
import { Paper } from '@/components/letters/paper';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
    FieldValue,
    LetterField,
    PlaceholderReference,
    Preview,
    TemplateDetail,
} from '@/data/letters';
import { useClipboard } from '@/hooks/use-clipboard';
import { usePipeline } from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { templates as templatesIndex } from '@/routes/letters';
import {
    restore as restoreTemplate,
    update as updateTemplate,
} from '@/routes/letters/templates';

type Props = {
    template: TemplateDetail;
    placeholders: PlaceholderReference;
    fieldTypes: Record<string, string>;
    preview: Preview;
};

type EditableField = LetterField & { default: FieldValue };

/** The select cannot carry an empty value; this stands for "no stage". */
const NO_STAGE = '__tidak__';

/**
 * One template's wording, edited beside a sample of the letter it makes.
 *
 * The words are the office's to change: paragraphs, the default Perihal,
 * the addressee line, and what each blank is called and starts as. The
 * kind of each blank is not, so a fee table cannot be turned into a
 * sentence from here and break every letter that follows.
 */
export default function LetterTemplateEditPage({
    template,
    placeholders,
    fieldTypes,
    preview,
}: Props) {
    const [name, setName] = useState(template.name);
    const [description, setDescription] = useState(template.description ?? '');
    const [prefix, setPrefix] = useState(template.prefix);
    const [subject, setSubject] = useState(template.subject);
    const [recipient, setRecipient] = useState(template.recipient);
    const [stageOnIssue, setStageOnIssue] = useState<string | null>(
        template.stageOnIssue,
    );
    const { stages } = usePipeline();
    const [body, setBody] = useState(template.body);
    const [active, setActive] = useState(template.active);
    const [fields, setFields] = useState<EditableField[]>(() =>
        template.fields.map((field) => ({
            ...field,
            default: normaliseDefault(field),
        })),
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [, copy] = useClipboard();

    const patchField = (key: string, patch: Partial<EditableField>) =>
        setFields(
            fields.map((field) =>
                field.key === key ? { ...field, ...patch } : field,
            ),
        );

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        router.patch(
            updateTemplate(template.id).url,
            {
                name,
                description,
                number_prefix: prefix,
                subject,
                recipient,
                stage_on_issue: stageOnIssue ?? '',
                body,
                is_active: active,
                fields: fields.map((field) => ({
                    key: field.key,
                    label: field.label,
                    help: field.help ?? '',
                    placeholder: field.placeholder ?? '',
                    required: field.required,
                    default: field.default,
                })),
            },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setErrors({}),
                onError: (serverErrors) => {
                    setErrors(serverErrors);
                    toast.error('Belum bisa disimpan', {
                        description: Object.values(serverErrors)[0],
                    });
                },
            },
        );
    };

    const insert = async (key: string) => {
        const token = `{{${key}}}`;

        if (await copy(token)) {
            toast.success(`${token} disalin`, {
                description: 'Tempel di isi surat, tujuan, atau isian teks.',
            });
        }
    };

    return (
        <>
            <Head title={`Template · ${template.name}`} />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0">
                        <Link
                            href={templatesIndex()}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary-deep"
                        >
                            <ArrowLeft
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            Kembali ke Template
                        </Link>
                        <h1 className="mt-2 truncate text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            {template.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            <span data-numeric>{template.letters}</span> surat
                            dibuat dari template ini. Yang sudah terbit tidak
                            ikut berubah.
                        </p>
                    </div>

                    <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
                        {template.hasDefault ? (
                            <Button
                                size="lg"
                                variant="outline"
                                className="flex-1 sm:flex-none"
                                onClick={() => setRestoring(true)}
                            >
                                <RotateCcw strokeWidth={2} aria-hidden />
                                Pulihkan bawaan
                            </Button>
                        ) : null}
                        <Button
                            size="lg"
                            className="flex-1 shadow-teal sm:flex-none"
                            form="template-form"
                            type="submit"
                            disabled={saving}
                        >
                            {saving ? 'Menyimpan…' : 'Simpan template'}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(22rem,3fr)_2fr] xl:items-start">
                    <form
                        id="template-form"
                        onSubmit={submit}
                        className="flex min-w-0 flex-col gap-5"
                    >
                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                Identitas
                            </h2>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <Field
                                    id="name"
                                    label="Nama jenis surat"
                                    error={errors.name}
                                >
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field
                                    id="prefix"
                                    label="Awalan nomor"
                                    error={errors.number_prefix}
                                    hint="PEN menghasilkan PEN-001/KSN-MS/IX/2026."
                                >
                                    <Input
                                        id="prefix"
                                        value={prefix}
                                        onChange={(event) =>
                                            setPrefix(
                                                event.target.value.toUpperCase(),
                                            )
                                        }
                                        maxLength={8}
                                        className="uppercase"
                                    />
                                </Field>
                                <Field
                                    id="description"
                                    label="Keterangan"
                                    optional
                                    error={errors.description}
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="description"
                                        value={description}
                                        onChange={(event) =>
                                            setDescription(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field
                                    id="subject"
                                    label="Perihal bawaan"
                                    error={errors.subject}
                                >
                                    <Input
                                        id="subject"
                                        value={subject}
                                        onChange={(event) =>
                                            setSubject(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field
                                    id="recipient"
                                    label="Yth. bawaan"
                                    error={errors.recipient}
                                    hint="Placeholder boleh dipakai di sini."
                                >
                                    <Input
                                        id="recipient"
                                        value={recipient}
                                        onChange={(event) =>
                                            setRecipient(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field
                                    id="stage-on-issue"
                                    label="Setelah terbit, lead pindah ke tahap"
                                    error={errors.stage_on_issue}
                                    hint="Surat ini dianggap dokumen tahap tersebut: PDF-nya dilampirkan ke lead saat pindah. Hanya maju, tidak pernah mundur."
                                    className="sm:col-span-2"
                                >
                                    <Select
                                        value={stageOnIssue ?? NO_STAGE}
                                        onValueChange={(next) =>
                                            setStageOnIssue(
                                                next === NO_STAGE ? null : next,
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            id="stage-on-issue"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NO_STAGE}>
                                                Tidak memindahkan tahap
                                            </SelectItem>
                                            {stages.map((stage) => (
                                                <SelectItem
                                                    key={stage.key}
                                                    value={stage.key}
                                                >
                                                    {stage.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <label className="flex items-center gap-2.5 text-[0.8438rem] font-bold text-secondary-foreground sm:col-span-2">
                                    <Checkbox
                                        checked={active}
                                        onCheckedChange={(checked) =>
                                            setActive(checked === true)
                                        }
                                    />
                                    Ditawarkan saat membuat surat baru
                                </label>
                            </div>
                        </section>

                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                Isi surat
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Paragraf dipisah baris kosong. Baris berawalan
                                &quot;- &quot; menjadi butir, **teks** menjadi
                                tebal, dan paragraf yang hanya berisi{' '}
                                <code className="rounded bg-neutral-soft px-1">
                                    {'{{isian}}'}
                                </code>{' '}
                                bertipe daftar atau rincian dicetak sebagai
                                blok.
                            </p>
                            <div className="mt-4">
                                <Field
                                    id="body"
                                    label="Redaksi"
                                    error={errors.body}
                                >
                                    <Textarea
                                        id="body"
                                        value={body}
                                        onChange={(event) =>
                                            setBody(event.target.value)
                                        }
                                        rows={18}
                                        className="font-mono leading-relaxed"
                                    />
                                </Field>
                            </div>
                        </section>

                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                Isian
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Nama, petunjuk, dan isi awal tiap blank.
                                Jenisnya tetap: itu yang menjaga bentuk
                                suratnya.
                            </p>

                            <ol className="mt-4 flex flex-col gap-4">
                                {fields.map((field) => (
                                    <li
                                        key={field.key}
                                        className="rounded-lg border border-border p-4"
                                    >
                                        <div className="mb-3 flex flex-wrap items-center gap-2">
                                            <code
                                                className="rounded bg-neutral-soft px-1.5 py-0.5 text-xs font-bold text-secondary-foreground"
                                                data-numeric
                                            >
                                                {`{{${field.key}}}`}
                                            </code>
                                            <span className="text-xs text-muted-foreground">
                                                {fieldTypes[field.type] ??
                                                    field.type}
                                            </span>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <Field
                                                id={`label-${field.key}`}
                                                label="Nama isian"
                                                error={
                                                    errors[
                                                        `fields.${fields.indexOf(field)}.label`
                                                    ]
                                                }
                                            >
                                                <Input
                                                    id={`label-${field.key}`}
                                                    value={field.label}
                                                    onChange={(event) =>
                                                        patchField(field.key, {
                                                            label: event.target
                                                                .value,
                                                        })
                                                    }
                                                />
                                            </Field>
                                            <Field
                                                id={`help-${field.key}`}
                                                label="Petunjuk"
                                                optional
                                            >
                                                <Input
                                                    id={`help-${field.key}`}
                                                    value={field.help ?? ''}
                                                    onChange={(event) =>
                                                        patchField(field.key, {
                                                            help: event.target
                                                                .value,
                                                        })
                                                    }
                                                />
                                            </Field>
                                            {field.type === 'items' ||
                                            field.type === 'select' ? null : (
                                                <Field
                                                    id={`placeholder-${field.key}`}
                                                    label="Contoh di kotak isian"
                                                    optional
                                                >
                                                    <Input
                                                        id={`placeholder-${field.key}`}
                                                        value={
                                                            field.placeholder ??
                                                            ''
                                                        }
                                                        onChange={(event) =>
                                                            patchField(
                                                                field.key,
                                                                {
                                                                    placeholder:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                },
                                                            )
                                                        }
                                                    />
                                                </Field>
                                            )}
                                            <label className="flex items-center gap-2.5 self-end pb-2 text-[0.8438rem] font-bold text-secondary-foreground">
                                                <Checkbox
                                                    checked={field.required}
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        patchField(field.key, {
                                                            required:
                                                                checked ===
                                                                true,
                                                        })
                                                    }
                                                />
                                                Wajib diisi sebelum terbit
                                            </label>
                                            <div className="sm:col-span-2">
                                                <FieldEditor
                                                    field={field}
                                                    value={field.default}
                                                    onChange={(value) =>
                                                        patchField(field.key, {
                                                            default: value,
                                                        })
                                                    }
                                                    idPrefix="default"
                                                    labelOverride="Isi awal"
                                                />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    </form>

                    <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6">
                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                Placeholder
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Klik untuk menyalin, lalu tempel di redaksi.
                            </p>
                            <PlaceholderList
                                title="Terisi otomatis"
                                items={placeholders.builtin}
                                onPick={insert}
                            />
                            <PlaceholderList
                                title="Dari isian"
                                items={placeholders.fields}
                                onPick={insert}
                            />
                        </section>

                        <div>
                            <Paper preview={preview} />
                            <p className="mt-3 text-center text-xs text-muted-foreground">
                                Contoh dengan isi awal, dirender dari redaksi
                                yang tersimpan. Simpan untuk memperbaruinya.
                            </p>
                        </div>
                    </aside>
                </div>
            </div>

            <ConfirmDialog
                open={restoring}
                onOpenChange={setRestoring}
                title="Pulihkan redaksi bawaan"
                description="Nama, perihal, redaksi, dan isi awal tiap isian kembali ke bawaan kantor. Perubahan yang belum disimpan ikut hilang."
                action="Pulihkan"
                onConfirm={() =>
                    router.post(
                        restoreTemplate(template.id).url,
                        {},
                        {
                            onFinish: () => setRestoring(false),
                        },
                    )
                }
            />
        </>
    );
}

function PlaceholderList({
    title,
    items,
    onPick,
}: {
    title: string;
    items: { key: string; help: string }[];
    onPick: (key: string) => void;
}) {
    return (
        <div className="mt-4">
            <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {title}
            </p>
            <ul className="mt-2 flex flex-col divide-y divide-border">
                {items.map((item) => (
                    <li key={item.key}>
                        <button
                            type="button"
                            onClick={() => onPick(item.key)}
                            className={cn(
                                'group flex w-full items-start gap-2.5 py-2 text-left transition-colors hover:text-primary-deep',
                            )}
                        >
                            <code className="shrink-0 rounded bg-neutral-soft px-1.5 py-0.5 text-xs font-bold text-secondary-foreground group-hover:bg-primary-soft group-hover:text-primary-deep">
                                {`{{${item.key}}}`}
                            </code>
                            <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                                {item.help}
                            </span>
                            <Copy
                                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                                strokeWidth={2}
                                aria-hidden
                            />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** A stored default in the shape the editor's control expects. */
function normaliseDefault(field: LetterField): FieldValue {
    if (field.type === 'items') {
        return Array.isArray(field.default) ? field.default : [];
    }

    return typeof field.default === 'string' ? field.default : null;
}
