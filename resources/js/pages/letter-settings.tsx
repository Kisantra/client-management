import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Hash, PenLine, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/leads/form-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import { letters } from '@/routes';
import { update as updateCounter } from '@/routes/letters/counters';
import {
    image as signerImage,
    store as storeSigner,
    update as updateSigner,
} from '@/routes/letters/signers';
import {
    seed as seedTypes,
    store as storeType,
    update as updateType,
} from '@/routes/letters/types';

type Signer = {
    id: number;
    name: string;
    title: string;
    isDefault: boolean;
    active: boolean;
    hasSignature: boolean;
    /** Changes whenever the record does, so a new image is not served from cache. */
    imageVersion: number | null;
};

type DocumentType = {
    id: number;
    name: string;
    category: string;
    description: string | null;
    active: boolean;
    used: number;
};

type Counter = {
    prefix: string;
    year: number;
    last: number;
    /** The highest number already printed; the counter cannot go below it. */
    highest: number;
    next: string;
    templates: string[];
};

type Props = {
    signers: Signer[];
    documentTypes: DocumentType[];
    documentCategories: Record<string, string>;
    missingDocumentTypes: number;
    counters: Counter[];
    numberFormat: string;
};

/**
 * What every letter draws on and nobody sets per letter: who signs and with
 * which signature, where each number sequence stands, and the documents a
 * request letter picks from.
 */
export default function LetterSettingsPage({
    signers,
    documentTypes,
    documentCategories,
    missingDocumentTypes,
    counters,
    numberFormat,
}: Props) {
    const [editing, setEditing] = useState<Signer | 'new' | null>(null);

    return (
        <>
            <Head title="Pengaturan Surat" />

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
                        Pengaturan surat
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Berlaku untuk semua surat kantor. Surat yang sudah
                        terbit tidak ikut berubah.
                    </p>
                </div>

                <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
                    <div className="flex min-w-0 flex-col gap-5">
                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <header className="mb-1 flex items-center justify-between gap-3">
                                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                    Penanda tangan
                                </h2>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditing('new')}
                                >
                                    <Plus strokeWidth={2.5} aria-hidden />
                                    Tambah
                                </Button>
                            </header>
                            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                                Dipilih di tiap surat sesuai kolom tanda
                                tangannya; gambarnya langsung tercetak tanpa
                                persetujuan terpisah. Gambar disimpan di luar
                                folder publik.
                            </p>

                            <ul className="flex flex-col divide-y divide-border">
                                {signers.map((signer) => (
                                    <li
                                        key={signer.id}
                                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                                    >
                                        <span className="grid h-14 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white">
                                            {signer.hasSignature ? (
                                                <img
                                                    src={`${signerImage(signer.id).url}?v=${signer.imageVersion ?? 0}`}
                                                    alt={`Tanda tangan ${signer.name}`}
                                                    className="max-h-12 max-w-24 object-contain"
                                                />
                                            ) : (
                                                <span className="px-2 text-center text-[0.6875rem] text-muted-foreground">
                                                    Belum ada gambar
                                                </span>
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span
                                                    className={cn(
                                                        'text-[0.8438rem] font-bold',
                                                        !signer.active &&
                                                            'text-muted-foreground',
                                                    )}
                                                >
                                                    {signer.name}
                                                </span>
                                                {signer.isDefault ? (
                                                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-bold text-primary-deep">
                                                        Utama
                                                    </span>
                                                ) : null}
                                                {signer.active ? null : (
                                                    <span className="rounded-full bg-ink-panel px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                                                        Nonaktif
                                                    </span>
                                                )}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {signer.title}
                                            </span>
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditing(signer)}
                                        >
                                            Ubah
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                                Penomoran
                            </h2>
                            <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">
                                Format{' '}
                                <code
                                    className="rounded bg-neutral-soft px-1.5 py-0.5 font-bold text-secondary-foreground"
                                    data-numeric
                                >
                                    {numberFormat}
                                </code>
                                . Urutan berjalan per awalan dan mulai dari 1
                                tiap tahun. Kalau kantor melanjutkan buku agenda
                                kertas, isi nomor terakhir yang sudah terpakai
                                di sana.
                            </p>

                            <ul className="flex flex-col divide-y divide-border">
                                {counters.map((counter) => (
                                    <CounterRow
                                        key={counter.prefix}
                                        counter={counter}
                                    />
                                ))}
                            </ul>
                        </section>
                    </div>

                    <DocumentTypes
                        types={documentTypes}
                        categories={documentCategories}
                        missing={missingDocumentTypes}
                    />
                </div>
            </div>

            <SignerDialog signer={editing} onClose={() => setEditing(null)} />
        </>
    );
}

function CounterRow({ counter }: { counter: Counter }) {
    const [last, setLast] = useState(String(counter.last));
    const [error, setError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const changed = Number(last) !== counter.last;

    const save = (event: React.FormEvent) => {
        event.preventDefault();

        router.patch(
            updateCounter().url,
            { prefix: counter.prefix, year: counter.year, last: Number(last) },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setError(undefined),
                onError: (errors) => setError(errors.last),
            },
        );
    };

    return (
        <li className="py-3 first:pt-0 last:pb-0">
            <form onSubmit={save} className="flex flex-wrap items-start gap-3">
                <span
                    className="grid size-10 shrink-0 place-items-center rounded-md bg-neutral-soft text-[0.8438rem] font-extrabold text-secondary-foreground"
                    data-numeric
                >
                    {counter.prefix}
                </span>
                <span className="min-w-0 flex-1 basis-48">
                    <span className="block text-[0.8438rem] font-bold">
                        Berikutnya{' '}
                        <span className="whitespace-nowrap" data-numeric>
                            {counter.next}
                        </span>
                    </span>
                    <span
                        className="line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                        title={counter.templates.join(', ')}
                    >
                        <span data-numeric>{counter.templates.length}</span>{' '}
                        jenis surat: {counter.templates.join(', ')}
                    </span>
                    {error ? (
                        <span className="mt-1 block text-xs font-semibold text-destructive">
                            {error}
                        </span>
                    ) : (
                        <span className="mt-1 block text-xs text-muted-foreground">
                            <span data-numeric>{counter.highest}</span> sudah
                            tercetak di surat tahun{' '}
                            <span data-numeric>{counter.year}</span>
                        </span>
                    )}
                </span>
                <span className="flex items-center gap-2">
                    <label
                        htmlFor={`counter-${counter.prefix}`}
                        className="text-xs font-bold text-secondary-foreground"
                    >
                        Terakhir
                    </label>
                    <span className="relative">
                        <Hash
                            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <Input
                            id={`counter-${counter.prefix}`}
                            type="number"
                            min={counter.highest}
                            value={last}
                            onChange={(event) => setLast(event.target.value)}
                            className="h-9 w-24 pl-7"
                            data-numeric
                        />
                    </span>
                    <Button
                        type="submit"
                        size="sm"
                        disabled={!changed || saving || last === ''}
                    >
                        Simpan
                    </Button>
                </span>
            </form>
        </li>
    );
}

function SignerDialog({
    signer,
    onClose,
}: {
    signer: Signer | 'new' | null;
    onClose: () => void;
}) {
    const open = signer !== null;
    const existing = signer !== null && signer !== 'new' ? signer : null;

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="sm:max-w-md">
                {open ? (
                    <SignerForm
                        key={existing?.id ?? 'new'}
                        signer={existing}
                        onDone={onClose}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function SignerForm({
    signer,
    onDone,
}: {
    signer: Signer | null;
    onDone: () => void;
}) {
    const [name, setName] = useState(signer?.name ?? '');
    const [title, setTitle] = useState(signer?.title ?? '');
    const [file, setFile] = useState<File | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [isDefault, setIsDefault] = useState(signer?.isDefault ?? false);
    const [active, setActive] = useState(signer?.active ?? true);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const data: Record<string, string | boolean | File> = {
            name,
            title,
            is_default: isDefault,
        };

        if (file) {
            data.signature = file;
        }

        if (signer) {
            data.is_active = active;
            data.remove_signature = removeImage && !file;
        }

        router.post(
            signer ? updateSigner(signer.id).url : storeSigner().url,
            data,
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: onDone,
                onError: (serverErrors) => {
                    setErrors(serverErrors);
                    toast.error('Belum bisa disimpan', {
                        description: Object.values(serverErrors)[0],
                    });
                },
            },
        );
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
                <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                    {signer ? 'Ubah penanda tangan' : 'Tambah penanda tangan'}
                </DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                    Jabatan dicetak di bawah nama dan dipakai untuk memilih
                    otomatis kolom yang namanya sama, misalnya Manajer.
                </DialogDescription>
            </DialogHeader>

            <Field id="signer-name" label="Nama" error={errors.name}>
                <Input
                    id="signer-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoFocus
                />
            </Field>
            <Field
                id="signer-title"
                label="Jabatan"
                error={errors.title}
                hint="Misalnya Direktur, Manajer, atau Tax Manager."
            >
                <Input
                    id="signer-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                />
            </Field>
            <Field
                id="signer-image"
                label="Gambar tanda tangan"
                optional
                error={errors.signature}
                hint={
                    signer?.hasSignature
                        ? 'Sudah ada gambar. Unggah yang baru untuk menggantinya; surat yang sudah terbit tetap memakai yang lama.'
                        : 'PNG berlatar transparan paling rapi, maksimal 1 MB.'
                }
            >
                <Input
                    id="signer-image"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) =>
                        setFile(event.target.files?.[0] ?? null)
                    }
                />
            </Field>

            <div className="flex flex-col gap-2.5">
                {signer?.hasSignature && !file ? (
                    <label className="flex items-center gap-2.5 text-[0.8438rem] font-bold text-secondary-foreground">
                        <Checkbox
                            checked={removeImage}
                            onCheckedChange={(checked) =>
                                setRemoveImage(checked === true)
                            }
                        />
                        Lepas gambar tanda tangan
                    </label>
                ) : null}
                <label className="flex items-center gap-2.5 text-[0.8438rem] font-bold text-secondary-foreground">
                    <Checkbox
                        checked={isDefault}
                        onCheckedChange={(checked) =>
                            setIsDefault(checked === true)
                        }
                    />
                    Utama bila ada beberapa orang dengan jabatan yang sama
                </label>
                {signer ? (
                    <label className="flex items-center gap-2.5 text-[0.8438rem] font-bold text-secondary-foreground">
                        <Checkbox
                            checked={active}
                            onCheckedChange={(checked) =>
                                setActive(checked === true)
                            }
                        />
                        Aktif, ditawarkan di surat baru
                    </label>
                ) : null}
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onDone}
                    disabled={saving}
                >
                    Kembali
                </Button>
                <Button type="submit" disabled={saving}>
                    <PenLine strokeWidth={2} aria-hidden />
                    {saving ? 'Menyimpan…' : 'Simpan'}
                </Button>
            </DialogFooter>
        </form>
    );
}

function DocumentTypes({
    types,
    categories,
    missing,
}: {
    types: DocumentType[];
    categories: Record<string, string>;
    missing: number;
}) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState(Object.keys(categories)[0]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const active = types.filter((type) => type.active).length;

    const add = (event: React.FormEvent) => {
        event.preventDefault();

        router.post(
            storeType().url,
            { name, category },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setName('');
                    setErrors({});
                },
                onError: setErrors,
            },
        );
    };

    const toggle = (type: DocumentType) =>
        router.patch(
            updateType(type.id).url,
            {
                name: type.name,
                category: type.category,
                description: type.description,
                is_active: !type.active,
            },
            { preserveScroll: true },
        );

    return (
        <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
            <header className="mb-1 flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                    Jenis dokumen
                </h2>
                <span className="shrink-0 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <span data-numeric>{active}</span> aktif dari{' '}
                    <span data-numeric>{types.length}</span>
                </span>
            </header>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                Pilihan untuk daftar dokumen di surat permintaan. Yang
                dinonaktifkan tidak ditawarkan lagi, tapi surat lama tetap
                menyebutnya.
            </p>

            <form
                onSubmit={add}
                className="mb-4 flex flex-wrap items-start gap-2.5 rounded-lg bg-neutral-soft p-3"
            >
                <div className="min-w-0 flex-1 basis-56">
                    <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Nama dokumen baru"
                        aria-label="Nama dokumen baru"
                        className="bg-card"
                    />
                    {errors.name ? (
                        <p className="mt-1 text-xs font-semibold text-destructive">
                            {errors.name}
                        </p>
                    ) : null}
                </div>
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger
                        className="w-40 bg-card"
                        aria-label="Kategori dokumen"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(categories).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button type="submit" disabled={name.trim().length < 2}>
                    <Plus strokeWidth={2.5} aria-hidden />
                    Tambah
                </Button>
            </form>

            {missing > 0 ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-soft p-3">
                    <p className="text-xs text-primary-deep">
                        <span data-numeric>{missing}</span> dokumen dari daftar
                        bawaan kantor belum terpasang.
                    </p>
                    <Button
                        size="sm"
                        onClick={() =>
                            router.post(
                                seedTypes().url,
                                {},
                                { preserveScroll: true },
                            )
                        }
                    >
                        Pasang daftar bawaan
                    </Button>
                </div>
            ) : null}

            <div className="flex flex-col gap-5">
                {Object.entries(categories).map(([key, label]) => {
                    const rows = types.filter((type) => type.category === key);

                    if (rows.length === 0) {
                        return null;
                    }

                    return (
                        <div key={key}>
                            <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
                                {label}
                            </h3>
                            <ul className="flex flex-col divide-y divide-border">
                                {rows.map((type) => (
                                    <li
                                        key={type.id}
                                        className="flex items-center gap-3 py-2"
                                    >
                                        <Checkbox
                                            checked={type.active}
                                            onCheckedChange={() => toggle(type)}
                                            aria-label={`${type.name} aktif`}
                                        />
                                        <span
                                            className={cn(
                                                'min-w-0 flex-1 text-[0.8438rem]',
                                                !type.active &&
                                                    'text-muted-foreground',
                                            )}
                                        >
                                            {type.name}
                                        </span>
                                        <span
                                            className="shrink-0 text-xs text-muted-foreground"
                                            data-numeric
                                        >
                                            {type.used > 0
                                                ? `${type.used}× diminta`
                                                : null}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
