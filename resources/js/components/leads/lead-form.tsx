import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, Check, Info } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AttachmentField } from '@/components/leads/attachment-field';
import type { Attachment } from '@/components/leads/attachment-field';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { Field, FormSection } from '@/components/leads/form-field';
import { OfficeMap } from '@/components/leads/office-map';
import type { OfficePoint } from '@/components/leads/office-map';
import { STAGE_DOT } from '@/components/leads/stage-mark';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { CHANNEL_LABELS, team } from '@/data/dashboard';
import type { ChannelKey } from '@/data/dashboard';
import { asDate, shortRupiah, TODAY } from '@/data/leads';
import { usePipeline, useStageLabels } from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { leads } from '@/routes';
import { store as leadsStore, update as leadsUpdate } from '@/routes/leads';

const ENTITIES = ['PT', 'CV', 'UD', 'Koperasi', 'Perorangan'];

/** Content the team has published, so the source is picked, not retyped. */
const CONTENT: Record<ChannelKey, string[]> = {
    instagram: ['Batas Lapor SPT Badan', 'Checklist dokumen pajak'],
    tiktok: ['5 Kesalahan Pembukuan UMKM', 'Checklist audit internal'],
    linkedin: ['PPh 21 karyawan — contoh hitung', 'Tax planning untuk PT baru'],
    web: [
        'Insentif pajak 2026',
        'Panduan restitusi PPN',
        'Syarat pendirian PT 2026',
    ],
    whatsapp: [
        'Chat langsung',
        'Broadcast WhatsApp',
        'Referensi dari client lain',
    ],
};

/** Chosen when the enquiry does not match any listed service. */
const CUSTOM_SERVICE = '__lainnya__';

const dateLabel = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

export type EditableLead = {
    id: number;
    entity: string;
    company: string;
    pic: string;
    picRole: string | null;
    phone: string | null;
    email: string | null;
    npwp: string | null;
    address: string | null;
    city: string | null;
    office: { lat: number; lng: number } | null;
    channel: ChannelKey;
    source: string | null;
    service: string;
    value: number;
    stage: string;
    owner: string | null;
    enteredAt: string;
};

type Errors = Partial<Record<string, string>>;

const thousands = (digits: string) =>
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function LeadForm({
    lead,
    services,
}: {
    lead: EditableLead | null;
    services: string[];
}) {
    const { stages } = usePipeline();
    const stageLabels = useStageLabels();

    const [entity, setEntity] = useState(lead?.entity ?? 'PT');
    const [company, setCompany] = useState(lead?.company ?? '');
    const [npwp, setNpwp] = useState(lead?.npwp ?? '');
    const [pic, setPic] = useState(lead?.pic ?? '');
    const [role, setRole] = useState(lead?.picRole ?? '');
    const [phone, setPhone] = useState(lead?.phone ?? '');
    const [email, setEmail] = useState(lead?.email ?? '');

    const [address, setAddress] = useState(lead?.address ?? '');
    const [city, setCity] = useState(lead?.city ?? '');
    const [office, setOffice] = useState<OfficePoint>(lead?.office ?? null);

    // A service the firm has since renamed still has to edit cleanly.
    const listed = lead === null || services.includes(lead.service);

    const [service, setService] = useState(
        lead === null ? '' : listed ? lead.service : CUSTOM_SERVICE,
    );
    const [customService, setCustomService] = useState(
        lead === null || listed ? '' : lead.service,
    );
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [value, setValue] = useState(
        lead?.value ? thousands(String(lead.value)) : '',
    );
    const [note, setNote] = useState('');

    const [channel, setChannel] = useState<ChannelKey | ''>(
        lead?.channel ?? '',
    );
    const [source, setSource] = useState(lead?.source ?? '');
    const [entryAt, setEntryAt] = useState<Date | undefined>(
        lead ? asDate(lead.enteredAt) : TODAY,
    );
    const [dateOpen, setDateOpen] = useState(false);

    const [stage, setStage] = useState(lead?.stage ?? 'lead');
    const [owner, setOwner] = useState(lead?.owner ?? '');

    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const numericValue = Number(value.replace(/\D/g, ''));
    const resolvedService =
        service === CUSTOM_SERVICE ? customService.trim() : service;
    const fullName = company ? `${entity} ${company}`.trim() : '';

    /** The lead's own source stays selectable even if it is not on the list. */
    const sources = channel
        ? [
              ...CONTENT[channel],
              ...(source && !CONTENT[channel].includes(source) ? [source] : []),
          ]
        : [];

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const next: Errors = {};

        if (!company.trim()) {
            next.company = 'Nama client wajib diisi.';
        }

        if (!pic.trim()) {
            next.pic = 'Sebutkan siapa yang dihubungi di sisi client.';
        }

        if (!channel) {
            next.channel = 'Pilih dari mana lead ini datang.';
        }

        if (!service) {
            next.service = 'Pilih layanan yang ditanyakan.';
        } else if (service === CUSTOM_SERVICE && !customService.trim()) {
            next.customService = 'Tuliskan nama layanannya.';
        }

        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
            next.email = 'Format email belum benar.';
        }

        setErrors(next);

        if (Object.keys(next).length > 0) {
            toast.error('Beberapa isian belum lengkap', {
                description: 'Yang perlu diperbaiki ditandai merah.',
            });

            return;
        }

        const payload = {
            entity,
            company: company.trim(),
            pic: pic.trim(),
            pic_role: role.trim(),
            phone: phone.trim(),
            email: email.trim(),
            npwp: npwp.trim(),
            address: address.trim(),
            city: city.trim(),
            office_lat: office?.lat ?? '',
            office_lng: office?.lng ?? '',
            channel,
            source: source.trim(),
            entered_at: toIso(entryAt ?? TODAY),
            service: resolvedService,
            value: numericValue,
            note: note.trim(),
            stage,
            owner: owner.trim(),
            files: attachments.map((item) => item.file),
        };

        router.post(
            lead ? leadsUpdate(lead.id).url : leadsStore().url,
            payload,
            {
                forceFormData: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onError: (serverErrors) => {
                    setErrors({
                        ...serverErrors,
                        customService:
                            service === CUSTOM_SERVICE
                                ? serverErrors.service
                                : undefined,
                    });

                    toast.error('Belum bisa disimpan', {
                        description:
                            Object.values(serverErrors)[0] ??
                            'Periksa lagi isiannya.',
                    });
                },
            },
        );
    };

    return (
        <>
            <Head title={lead ? `Ubah ${lead.company}` : 'Tambah Lead'} />

            <form
                onSubmit={submit}
                noValidate
                className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6"
            >
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <Link
                            href={leads()}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary-deep"
                        >
                            <ArrowLeft
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            Kembali ke Leads
                        </Link>
                        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            {lead ? 'Ubah Lead' : 'Tambah Lead'}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {lead
                                ? `Mengubah ${entity} ${lead.company}. Perpindahan tahap dari sini tercatat di perjalanan lead.`
                                : 'Hanya nama client, PIC, asal, dan layanan yang wajib — sisanya bisa dilengkapi belakangan.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                        <Button
                            size="lg"
                            type="submit"
                            className="shadow-teal"
                            disabled={saving}
                        >
                            <Check strokeWidth={2.5} aria-hidden />
                            {saving
                                ? 'Menyimpan…'
                                : lead
                                  ? 'Simpan Perubahan'
                                  : 'Simpan Lead'}
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                            <Link href={leads()}>Batal</Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr] xl:items-start">
                    <div className="flex min-w-0 flex-col gap-5">
                        <FormSection
                            title="Client"
                            description="Siapa yang menghubungi, dan atas nama badan usaha apa."
                        >
                            <Field id="entity" label="Badan usaha">
                                <Select
                                    value={entity}
                                    onValueChange={setEntity}
                                >
                                    <SelectTrigger
                                        id="entity"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ENTITIES.map((item) => (
                                            <SelectItem key={item} value={item}>
                                                {item}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field
                                id="company"
                                label="Nama client"
                                error={errors.company}
                                hint="Tanpa PT/CV — bagian itu sudah dipilih di sebelah."
                            >
                                <Input
                                    id="company"
                                    value={company}
                                    onChange={(event) =>
                                        setCompany(event.target.value)
                                    }
                                    placeholder="Sinar Rejeki"
                                    aria-invalid={Boolean(errors.company)}
                                    aria-describedby={
                                        errors.company
                                            ? 'company-error'
                                            : 'company-hint'
                                    }
                                />
                            </Field>

                            <Field
                                id="pic"
                                label="PIC di sisi client"
                                error={errors.pic}
                            >
                                <Input
                                    id="pic"
                                    value={pic}
                                    onChange={(event) =>
                                        setPic(event.target.value)
                                    }
                                    placeholder="Dewi Wijaya"
                                    aria-invalid={Boolean(errors.pic)}
                                    aria-describedby={
                                        errors.pic ? 'pic-error' : undefined
                                    }
                                />
                            </Field>

                            <Field id="role" label="Jabatan PIC" optional>
                                <Input
                                    id="role"
                                    value={role}
                                    onChange={(event) =>
                                        setRole(event.target.value)
                                    }
                                    placeholder="Finance Manager"
                                />
                            </Field>

                            <Field
                                id="phone"
                                label="Telepon / WhatsApp"
                                optional
                            >
                                <Input
                                    id="phone"
                                    type="tel"
                                    inputMode="tel"
                                    value={phone}
                                    onChange={(event) =>
                                        setPhone(event.target.value)
                                    }
                                    placeholder="0812 3456 7890"
                                />
                            </Field>

                            <Field
                                id="email"
                                label="Email"
                                optional
                                error={errors.email}
                            >
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    placeholder="dewi@sinarrejeki.co.id"
                                    aria-invalid={Boolean(errors.email)}
                                    aria-describedby={
                                        errors.email ? 'email-error' : undefined
                                    }
                                />
                            </Field>

                            <Field
                                id="npwp"
                                label="NPWP"
                                optional
                                hint="Boleh dikosongkan sampai masuk tahap Proposal."
                                className="sm:col-span-2"
                            >
                                <Input
                                    id="npwp"
                                    inputMode="numeric"
                                    value={npwp}
                                    onChange={(event) =>
                                        setNpwp(event.target.value)
                                    }
                                    placeholder="00.000.000.0-000.000"
                                    aria-describedby="npwp-hint"
                                />
                            </Field>
                        </FormSection>

                        <FormSection
                            title="Lokasi kantor"
                            description="Kalau client punya kantor yang bisa dikunjungi, tandai titiknya. Seluruh bagian ini opsional."
                        >
                            <Field
                                id="address"
                                label="Alamat kantor"
                                optional
                                className="sm:col-span-2"
                            >
                                <Input
                                    id="address"
                                    value={address}
                                    onChange={(event) =>
                                        setAddress(event.target.value)
                                    }
                                    placeholder="Jl. Ahmad Yani No. 12, Ruko Blok B"
                                />
                            </Field>

                            <Field id="city" label="Kota" optional>
                                <Input
                                    id="city"
                                    value={city}
                                    onChange={(event) =>
                                        setCity(event.target.value)
                                    }
                                    placeholder="Samarinda"
                                />
                            </Field>

                            <Field
                                id="office-map"
                                label="Titik di peta"
                                optional
                                className="sm:col-span-2"
                                hint="Klik untuk menandai, lalu seret pin kalau perlu digeser. Dipakai untuk merencanakan kunjungan."
                            >
                                <OfficeMap
                                    point={office}
                                    onChange={setOffice}
                                />
                            </Field>
                        </FormSection>

                        <FormSection
                            title="Asal lead"
                            description="Konten mana yang membawanya masuk. Ini yang membuat performa konten bisa ditelusuri sampai ke client."
                        >
                            <Field
                                id="channel"
                                label="Channel"
                                error={errors.channel}
                            >
                                <Select
                                    value={channel}
                                    onValueChange={(next) => {
                                        setChannel(next as ChannelKey);
                                        setSource('');
                                    }}
                                >
                                    <SelectTrigger
                                        id="channel"
                                        className="w-full"
                                        aria-invalid={Boolean(errors.channel)}
                                    >
                                        <SelectValue placeholder="Pilih channel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(
                                            Object.keys(
                                                CHANNEL_LABELS,
                                            ) as ChannelKey[]
                                        ).map((key) => (
                                            <SelectItem key={key} value={key}>
                                                <ChannelIcon channel={key} />
                                                {CHANNEL_LABELS[key]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field
                                id="source"
                                label="Konten yang membawanya"
                                optional
                                hint={
                                    channel
                                        ? undefined
                                        : 'Pilih channel dulu untuk melihat daftar kontennya.'
                                }
                            >
                                <Select
                                    value={source}
                                    onValueChange={setSource}
                                    disabled={!channel}
                                >
                                    <SelectTrigger
                                        id="source"
                                        className="w-full"
                                        aria-describedby={
                                            channel ? undefined : 'source-hint'
                                        }
                                    >
                                        <SelectValue placeholder="Pilih konten" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sources.map((title) => (
                                            <SelectItem
                                                key={title}
                                                value={title}
                                            >
                                                {title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field
                                id="entry"
                                label="Tanggal masuk"
                                className="sm:col-span-2"
                                error={errors.entered_at}
                            >
                                <Popover
                                    open={dateOpen}
                                    onOpenChange={setDateOpen}
                                >
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            id="entry"
                                            className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        >
                                            <CalendarDays
                                                className="size-4 shrink-0 text-muted-foreground"
                                                strokeWidth={1.75}
                                                aria-hidden
                                            />
                                            {entryAt
                                                ? dateLabel.format(entryAt)
                                                : 'Pilih tanggal'}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="start"
                                        className="w-auto p-3"
                                    >
                                        <Calendar
                                            mode="single"
                                            selected={entryAt}
                                            onSelect={(date) => {
                                                setEntryAt(date);
                                                setDateOpen(false);
                                            }}
                                            disabled={{ after: TODAY }}
                                            defaultMonth={entryAt}
                                            autoFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </Field>
                        </FormSection>

                        <FormSection
                            title="Kebutuhan"
                            description="Apa yang ditanyakan, dan seberapa besar potensinya."
                        >
                            <Field
                                id="service"
                                label="Layanan yang ditanyakan"
                                error={errors.service}
                            >
                                <Select
                                    value={service}
                                    onValueChange={setService}
                                >
                                    <SelectTrigger
                                        id="service"
                                        className="w-full"
                                        aria-invalid={Boolean(errors.service)}
                                    >
                                        <SelectValue placeholder="Pilih layanan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {services.map((item) => (
                                            <SelectItem key={item} value={item}>
                                                {item}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value={CUSTOM_SERVICE}>
                                            Lainnya…
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>

                            {service === CUSTOM_SERVICE ? (
                                <Field
                                    id="custom-service"
                                    label="Nama layanan"
                                    error={errors.customService}
                                    hint="Tulis apa adanya; daftar di atas bisa ditambah nanti."
                                >
                                    <Input
                                        id="custom-service"
                                        value={customService}
                                        onChange={(event) =>
                                            setCustomService(event.target.value)
                                        }
                                        placeholder="Pendampingan pemeriksaan pajak"
                                        autoFocus
                                        aria-invalid={Boolean(
                                            errors.customService,
                                        )}
                                        aria-describedby={
                                            errors.customService
                                                ? 'custom-service-error'
                                                : 'custom-service-hint'
                                        }
                                    />
                                </Field>
                            ) : null}

                            <Field
                                id="value"
                                label="Estimasi nilai"
                                optional
                                hint={
                                    numericValue > 0
                                        ? `Terbaca ${shortRupiah(numericValue)}`
                                        : 'Perkiraan kasar sudah cukup; bisa diubah kapan saja.'
                                }
                            >
                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-muted-foreground">
                                        Rp
                                    </span>
                                    <Input
                                        id="value"
                                        inputMode="numeric"
                                        value={value}
                                        onChange={(event) =>
                                            setValue(
                                                thousands(
                                                    event.target.value.replace(
                                                        /\D/g,
                                                        '',
                                                    ),
                                                ),
                                            )
                                        }
                                        placeholder="65.000.000"
                                        className="pl-9"
                                        aria-describedby="value-hint"
                                    />
                                </div>
                            </Field>

                            {lead ? null : (
                                <Field
                                    id="note"
                                    label="Catatan awal"
                                    optional
                                    className="sm:col-span-2"
                                    hint="Apa yang ditanyakan, kapan mau mulai, kendala yang disebut."
                                >
                                    <Textarea
                                        id="note"
                                        value={note}
                                        onChange={(event) =>
                                            setNote(event.target.value)
                                        }
                                        placeholder="Menanyakan biaya penyusunan SPT Badan untuk tahun buku 2025…"
                                        aria-describedby="note-hint"
                                    />
                                </Field>
                            )}

                            <Field
                                id="attachments"
                                label="Lampiran"
                                optional
                                className="sm:col-span-2"
                                hint={
                                    lead
                                        ? 'Berkas baru masuk sebagai catatan; lampiran lama tetap di halaman lead.'
                                        : undefined
                                }
                            >
                                <AttachmentField
                                    items={attachments}
                                    onChange={setAttachments}
                                />
                            </Field>
                        </FormSection>

                        <FormSection
                            title="Penanganan"
                            description="Di mana lead ini masuk ke papan, dan siapa yang memegangnya."
                        >
                            <Field
                                id="stage"
                                label={lead ? 'Tahap' : 'Tahap awal'}
                                hint={
                                    lead
                                        ? 'Mengubah tahap di sini mencatat perpindahan hari ini.'
                                        : 'Biasanya Lead. Naikkan kalau sudah pernah dihubungi.'
                                }
                            >
                                <Select value={stage} onValueChange={setStage}>
                                    <SelectTrigger
                                        id="stage"
                                        className="w-full"
                                        aria-describedby="stage-hint"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stages.map((item) => (
                                            <SelectItem
                                                key={item.key}
                                                value={item.key}
                                            >
                                                <span
                                                    className={cn(
                                                        'size-2 shrink-0 rounded-full',
                                                        STAGE_DOT[item.key],
                                                    )}
                                                />
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field id="owner" label="Penanggung jawab" optional>
                                <Select value={owner} onValueChange={setOwner}>
                                    <SelectTrigger
                                        id="owner"
                                        className="w-full"
                                    >
                                        <SelectValue placeholder="Belum ditentukan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {team.map((member) => (
                                            <SelectItem
                                                key={member.name}
                                                value={member.name}
                                            >
                                                {member.name}
                                                <span className="ml-auto text-xs text-muted-foreground">
                                                    {member.assigned}/
                                                    {member.capacity}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </FormSection>
                    </div>

                    {/* Consequence, not decoration: the card the form is building. */}
                    <aside className="xl:sticky xl:top-6">
                        <div className="rounded-xl border border-border bg-card p-5 shadow-lift">
                            <h2 className="flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                                <Info
                                    className="size-3.5"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                                Tampil di papan
                            </h2>

                            <div className="mt-3.5 rounded-lg border border-border bg-card px-3.5 py-3 shadow-lift">
                                <p className="flex items-start gap-2">
                                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-neutral-soft py-0.5 pr-2.5 pl-1.5 text-[0.6875rem] font-bold text-secondary-foreground">
                                        {channel ? (
                                            <>
                                                <ChannelIcon
                                                    channel={channel}
                                                />
                                                {CHANNEL_LABELS[channel]}
                                            </>
                                        ) : (
                                            'Channel belum dipilih'
                                        )}
                                    </span>
                                </p>

                                <h3
                                    className={cn(
                                        'mt-2 line-clamp-2 text-sm leading-snug font-bold',
                                        !fullName && 'text-muted-foreground',
                                    )}
                                >
                                    {fullName || 'Nama client'}
                                </h3>

                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {source || 'Konten belum dipilih'}
                                </p>

                                <p className="mt-3 flex items-center gap-2 border-t border-border pt-2.5 text-xs">
                                    <span className="min-w-0 truncate text-muted-foreground">
                                        <span
                                            className="font-bold text-foreground"
                                            data-numeric
                                        >
                                            {numericValue > 0
                                                ? shortRupiah(numericValue)
                                                : 'Rp —'}
                                        </span>{' '}
                                        · {pic || 'PIC'}
                                    </span>
                                    <span className="ml-auto shrink-0 text-muted-foreground">
                                        {lead ? '' : '0 hari'}
                                    </span>
                                </p>
                            </div>

                            <dl className="mt-4 flex flex-col gap-2.5 text-xs">
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-muted-foreground">
                                        Masuk ke kolom
                                    </dt>
                                    <dd className="inline-flex items-center gap-1.5 font-bold">
                                        <span
                                            className={cn(
                                                'size-2 rounded-full',
                                                STAGE_DOT[stage],
                                            )}
                                            aria-hidden
                                        />
                                        {stageLabels[stage]}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-muted-foreground">
                                        Layanan
                                    </dt>
                                    <dd className="truncate font-bold">
                                        {resolvedService || '—'}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-muted-foreground">
                                        Penanggung jawab
                                    </dt>
                                    <dd className="truncate font-bold">
                                        {owner || 'Belum ditentukan'}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-muted-foreground">
                                        Lampiran
                                    </dt>
                                    <dd className="font-bold" data-numeric>
                                        {attachments.length > 0
                                            ? `${attachments.length} berkas`
                                            : '—'}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-muted-foreground">
                                        Lokasi kantor
                                    </dt>
                                    <dd className="truncate font-bold">
                                        {office
                                            ? city || 'Titik ditandai'
                                            : 'Belum ditandai'}
                                    </dd>
                                </div>
                            </dl>

                            <p className="mt-4 border-t border-border pt-3.5 text-xs leading-relaxed text-muted-foreground">
                                {lead
                                    ? 'Perubahan berlaku begitu disimpan, termasuk di papan dan dashboard.'
                                    : 'Setelah disimpan, lead langsung masuk ke papan dan ikut terhitung di dashboard.'}
                            </p>
                        </div>
                    </aside>
                </div>
            </form>
        </>
    );
}

/** Dates travel as plain calendar days; the server never sees a timezone. */
function toIso(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}
