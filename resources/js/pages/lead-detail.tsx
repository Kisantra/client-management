import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    Check,
    CircleSlash,
    FileText,
    ImageIcon,
    Mail,
    MapPin,
    MessageCircle,
    Paperclip,
    Pencil,
    Phone,
    Plus,
    RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { CloseLeadDialog } from '@/components/leads/close-lead-dialog';
import { FollowUpDialog } from '@/components/leads/followup-dialog';
import { NoteComposer } from '@/components/leads/note-composer';
import { OfficeMap } from '@/components/leads/office-map';
import { STAGE_DOT } from '@/components/leads/stage-mark';
import { StageMoveDialog } from '@/components/leads/stage-move-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CHANNEL_LABELS } from '@/data/dashboard';
import { entryDate, longDate, relativeDays, rupiah } from '@/data/leads';
import type {
    FollowUp,
    LeadDetail,
    LeadNote,
    NoteFile,
    StageStep,
} from '@/data/leads';
import {
    usePipeline,
    useStageLabels,
    useStageRequirement,
} from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { leads } from '@/routes';
import { edit as leadEdit } from '@/routes/leads';
import { destroy as reopenLead } from '@/routes/leads/closure';
import { update as updateFollowUp } from '@/routes/leads/follow-ups';

type Props = {
    lead: LeadDetail;
    timeline: StageStep[];
    notes: LeadNote[];
    followUps: FollowUp[];
};

export default function LeadDetailPage({
    lead,
    timeline,
    notes,
    followUps,
}: Props) {
    const [pendingStage, setPendingStage] = useState<string | null>(null);
    const [followUpOpen, setFollowUpOpen] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [reopening, setReopening] = useState(false);

    const labels = useStageLabels();

    const closed = lead.status !== 'aktif';
    const nextFollowUp = closed
        ? undefined
        : followUps.find((item) => !item.done);

    const reopen = () =>
        router.delete(reopenLead(lead.id).url, {
            preserveScroll: true,
            onStart: () => setReopening(true),
            onFinish: () => setReopening(false),
        });

    return (
        <>
            <Head title={lead.company} />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0">
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
                            {lead.company}
                        </h1>

                        <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-bold text-secondary-foreground">
                                <span
                                    className={cn(
                                        'size-2 rounded-full',
                                        STAGE_DOT[lead.stage],
                                    )}
                                    aria-hidden
                                />
                                {labels[lead.stage]}
                            </span>
                            {closed ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-panel px-2.5 py-1 text-xs font-bold text-white">
                                    <CircleSlash
                                        className="size-3"
                                        strokeWidth={2.5}
                                        aria-hidden
                                    />
                                    Tidak lanjut
                                </span>
                            ) : null}
                            <span>{lead.service}</span>
                            <span aria-hidden>·</span>
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {rupiah.format(lead.value)}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                        {closed ? (
                            <Button
                                size="lg"
                                className="shadow-teal"
                                onClick={reopen}
                                disabled={reopening}
                            >
                                <RotateCcw strokeWidth={2} aria-hidden />
                                {reopening ? 'Membuka…' : 'Buka lagi'}
                            </Button>
                        ) : (
                            <>
                                <StageMenu
                                    current={lead.stage}
                                    onPick={(next) => setPendingStage(next)}
                                    onClose={() => setCloseOpen(true)}
                                />
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => setFollowUpOpen(true)}
                                >
                                    <CalendarClock
                                        strokeWidth={2}
                                        aria-hidden
                                    />
                                    Follow-up
                                </Button>
                            </>
                        )}
                        <Button size="lg" variant="outline" asChild>
                            <Link href={leadEdit(lead.id)}>
                                <Pencil strokeWidth={2} aria-hidden />
                                Ubah
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr] xl:items-start">
                    <div className="flex min-w-0 flex-col gap-5">
                        <Panel
                            title="Perjalanan"
                            description="Berapa lama lead ini berhenti di tiap tahap sejak masuk."
                        >
                            <Timeline
                                steps={timeline}
                                stalled={lead.stalled}
                                threshold={lead.threshold}
                                closed={closed}
                            />
                        </Panel>

                        <Panel
                            title="Follow-up"
                            description="Kontak terjadwal di sela tahap, tanpa memindahkan lead."
                        >
                            <FollowUpList
                                items={followUps}
                                leadId={lead.id}
                                closed={closed}
                            />

                            {closed ? (
                                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                                    Lead ini sudah ditutup, jadi tidak ada
                                    follow-up baru. Buka lagi kalau mau
                                    dilanjutkan.
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setFollowUpOpen(true)}
                                    className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-3 py-2 text-[0.8438rem] font-bold text-primary-deep transition-colors hover:bg-accent"
                                >
                                    <Plus
                                        className="size-3.5"
                                        strokeWidth={2.5}
                                        aria-hidden
                                    />
                                    Jadwalkan follow-up
                                </button>
                            )}
                        </Panel>

                        <Panel
                            title="Catatan"
                            description="Riwayat percakapan, berikut berkas yang menyertainya."
                        >
                            <NoteComposer leadId={lead.id} />

                            {notes.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-6 text-center text-xs text-muted-foreground">
                                    Belum ada catatan untuk lead ini.
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-4">
                                    {notes.map((note) => (
                                        <li
                                            key={note.id}
                                            className="border-b border-border pb-4 last:border-b-0 last:pb-0"
                                        >
                                            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                <span className="text-[0.8438rem] font-bold">
                                                    {note.author}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {longDate(note.at)}
                                                </span>
                                            </p>
                                            {note.body ? (
                                                <p className="mt-1.5 text-[0.8438rem] leading-relaxed text-secondary-foreground">
                                                    {note.body}
                                                </p>
                                            ) : null}
                                            {note.files.length > 0 ? (
                                                <p className="mt-2 flex flex-wrap gap-1.5">
                                                    {note.files.map((file) => (
                                                        <FileChip
                                                            key={file.id}
                                                            file={file}
                                                        />
                                                    ))}
                                                </p>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>

                        <Panel
                            title="Client"
                            description="Kontak dan identitas badan usaha."
                        >
                            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                                <Fact label="PIC">
                                    {lead.pic}
                                    {lead.picRole ? (
                                        <span className="block text-xs font-normal text-muted-foreground">
                                            {lead.picRole}
                                        </span>
                                    ) : null}
                                </Fact>
                                <Fact label="Telepon / WhatsApp">
                                    {lead.phone ? (
                                        <span data-numeric>{lead.phone}</span>
                                    ) : (
                                        <Blank />
                                    )}
                                </Fact>
                                <Fact label="Email">
                                    {lead.email ? (
                                        <span className="break-all">
                                            {lead.email}
                                        </span>
                                    ) : (
                                        <Blank />
                                    )}
                                </Fact>
                                <Fact label="NPWP">
                                    {lead.npwp ? (
                                        <span data-numeric>{lead.npwp}</span>
                                    ) : (
                                        <Blank />
                                    )}
                                </Fact>
                                <Fact label="Alamat kantor" wide>
                                    {lead.address || lead.city ? (
                                        [lead.address, lead.city]
                                            .filter(Boolean)
                                            .join(', ')
                                    ) : (
                                        <Blank />
                                    )}
                                </Fact>
                            </dl>

                            <div className="mt-5 flex flex-wrap gap-2">
                                {lead.phone ? (
                                    <>
                                        <ContactAction
                                            icon={Phone}
                                            label="Telepon"
                                            href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                                        />
                                        <ContactAction
                                            icon={MessageCircle}
                                            label="WhatsApp"
                                            href={`https://wa.me/62${lead.phone.replace(/\D/g, '').replace(/^0/, '')}`}
                                            external
                                        />
                                    </>
                                ) : null}
                                {lead.email ? (
                                    <ContactAction
                                        icon={Mail}
                                        label="Email"
                                        href={`mailto:${lead.email}`}
                                    />
                                ) : null}
                                {!lead.phone && !lead.email ? (
                                    <p className="text-xs text-muted-foreground">
                                        Belum ada nomor atau email yang bisa
                                        dihubungi.{' '}
                                        <Link
                                            href={leadEdit(lead.id)}
                                            className="font-bold text-primary-deep underline underline-offset-4"
                                        >
                                            Lengkapi
                                        </Link>
                                    </p>
                                ) : null}
                            </div>
                        </Panel>
                    </div>

                    <aside className="flex flex-col gap-5 xl:sticky xl:top-6">
                        <Panel
                            title="Status"
                            description="Posisi sekarang dan batas wajar tahapnya."
                        >
                            <dl className="flex flex-col gap-3.5 text-[0.8438rem]">
                                <Row label="Di tahap ini">
                                    <span
                                        className={cn(
                                            'font-bold',
                                            lead.stalled && 'text-destructive',
                                        )}
                                        data-numeric
                                    >
                                        {closed
                                            ? `${lead.daysInStage} hari, berhenti`
                                            : `${lead.daysInStage} / ${lead.threshold} hari`}
                                    </span>
                                </Row>
                                <Row label="Follow-up berikutnya">
                                    {closed
                                        ? 'Tidak ada'
                                        : nextFollowUp
                                          ? `${longDate(nextFollowUp.at)} · ${nextFollowUp.via}`
                                          : 'Belum dijadwalkan'}
                                </Row>
                                <Row label="Kontak terakhir">
                                    {relativeDays(lead.daysSinceContact)}
                                </Row>
                                <Row label="Masuk">
                                    {entryDate(lead.entryAt)}
                                </Row>
                                <Row label="Penanggung jawab">
                                    {lead.owner ?? 'Belum ditentukan'}
                                </Row>
                            </dl>

                            {lead.stalled ? (
                                <p className="mt-4 rounded-lg bg-destructive-soft p-3 text-xs leading-relaxed font-semibold text-destructive">
                                    Mandek: sudah {lead.daysInStage} hari di
                                    tahap {labels[lead.stage]}, melewati batas
                                    wajar {lead.threshold} hari.
                                </p>
                            ) : null}

                            {closed ? (
                                <div className="mt-4 rounded-lg bg-neutral-soft p-3.5">
                                    <p className="text-xs leading-relaxed font-semibold text-secondary-foreground">
                                        Ditutup{' '}
                                        {lead.closedAt
                                            ? longDate(lead.closedAt)
                                            : ''}{' '}
                                        · {lead.closedReason}. Berhenti di tahap{' '}
                                        {labels[lead.stage]} setelah{' '}
                                        <span data-numeric>
                                            {lead.daysInStage} hari
                                        </span>
                                        .
                                    </p>
                                    {lead.closedNote ? (
                                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                            {lead.closedNote}
                                        </p>
                                    ) : null}
                                    <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                                        Tahapnya sengaja dibiarkan supaya
                                        terlihat di mana lead biasanya berhenti.
                                        Kalau tiba-tiba ada kabar, buka lagi —
                                        hitungan harinya mulai dari nol.
                                    </p>
                                </div>
                            ) : null}
                        </Panel>

                        <Panel
                            title="Asal"
                            description="Konten yang membawanya masuk."
                        >
                            <p className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-neutral-soft py-1 pr-3 pl-2 text-xs font-bold text-secondary-foreground">
                                <ChannelIcon channel={lead.channel} />
                                {CHANNEL_LABELS[lead.channel]}
                            </p>
                            <p className="mt-2.5 text-[0.8438rem] font-bold">
                                {lead.source}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Lead masuk pada {entryDate(lead.entryAt)}.
                            </p>
                        </Panel>

                        <Panel
                            title="Lokasi kantor"
                            description={
                                lead.office
                                    ? [lead.address, lead.city]
                                          .filter(Boolean)
                                          .join(', ') || 'Ditandai di peta.'
                                    : 'Belum ditandai di peta.'
                            }
                        >
                            {lead.office ? (
                                <OfficeMap
                                    point={lead.office}
                                    onChange={() => undefined}
                                    readOnly
                                />
                            ) : (
                                <p className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-6 text-xs text-muted-foreground">
                                    <MapPin
                                        className="size-4 shrink-0"
                                        strokeWidth={1.75}
                                        aria-hidden
                                    />
                                    Client ini belum punya titik kantor.
                                </p>
                            )}
                        </Panel>
                    </aside>
                </div>
            </div>

            <StageMoveDialog
                open={pendingStage !== null}
                onOpenChange={(next) => {
                    if (!next) {
                        setPendingStage(null);
                    }
                }}
                toStage={pendingStage}
                leadId={lead.id}
                company={lead.company}
            />

            <FollowUpDialog
                open={followUpOpen}
                onOpenChange={setFollowUpOpen}
                leadId={lead.id}
                company={lead.company}
                stageLabel={labels[lead.stage]}
            />

            <CloseLeadDialog
                open={closeOpen}
                onOpenChange={setCloseOpen}
                leadId={lead.id}
                company={lead.company}
                stageLabel={labels[lead.stage]}
            />
        </>
    );
}

function Blank() {
    return <span className="font-normal text-muted-foreground">Belum ada</span>;
}

function FileChip({ file }: { file: NoteFile }) {
    const image = /\.(png|jpe?g|webp)$/i.test(file.name);

    return (
        <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-soft py-1 pr-2.5 pl-2 text-[0.6875rem] font-bold text-secondary-foreground transition-colors hover:bg-accent hover:text-primary-deep"
        >
            {image ? (
                <ImageIcon className="size-3" strokeWidth={2} aria-hidden />
            ) : (
                <FileText className="size-3" strokeWidth={2} aria-hidden />
            )}
            {file.name}
        </a>
    );
}

function FollowUpList({
    items,
    leadId,
    closed,
}: {
    items: FollowUp[];
    leadId: number;
    closed: boolean;
}) {
    if (items.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-6 text-center text-xs text-muted-foreground">
                Belum ada follow-up terjadwal.
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {items.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                    <span
                        className={cn(
                            'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md',
                            item.done
                                ? 'bg-neutral-soft text-muted-foreground'
                                : 'bg-primary-soft text-primary-deep',
                        )}
                        aria-hidden
                    >
                        {item.done ? (
                            <Check className="size-3.5" strokeWidth={2.5} />
                        ) : (
                            <CalendarClock
                                className="size-3.5"
                                strokeWidth={2}
                            />
                        )}
                    </span>

                    <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span
                                className={cn(
                                    'text-[0.8438rem] font-bold',
                                    item.done && 'text-muted-foreground',
                                )}
                            >
                                {longDate(item.at)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {item.via}
                            </span>
                            {item.done ? null : (
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-[0.6875rem] font-extrabold',
                                        closed
                                            ? 'bg-neutral-soft text-muted-foreground'
                                            : 'bg-primary-soft text-primary-deep',
                                    )}
                                >
                                    {closed ? 'Batal' : 'Terjadwal'}
                                </span>
                            )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {item.note}
                        </span>
                    </span>

                    {item.done || closed ? null : (
                        <button
                            type="button"
                            onClick={() =>
                                router.patch(
                                    updateFollowUp([leadId, item.id]).url,
                                    { done: true },
                                    { preserveScroll: true },
                                )
                            }
                            className="shrink-0 rounded-md px-2 py-1 text-[0.6875rem] font-bold text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary-deep"
                        >
                            Tandai selesai
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
}

function Timeline({
    steps,
    stalled,
    threshold,
    closed,
}: {
    steps: StageStep[];
    stalled: boolean;
    threshold: number;
    closed: boolean;
}) {
    return (
        <ol className="flex flex-col">
            {steps.map((step, index) => {
                const last = index === steps.length - 1;
                const overdue = step.current && stalled && !closed;

                return (
                    <li key={`${step.key}-${index}`} className="flex gap-3.5">
                        <span
                            className="flex flex-col items-center"
                            aria-hidden
                        >
                            <span
                                className={cn(
                                    'mt-1 size-3 shrink-0 rounded-full ring-4 ring-card',
                                    step.current
                                        ? overdue
                                            ? 'bg-destructive'
                                            : 'bg-primary'
                                        : STAGE_DOT[step.key],
                                )}
                            />
                            {last ? null : (
                                <span className="w-px flex-1 bg-border" />
                            )}
                        </span>

                        <span
                            className={cn('min-w-0 flex-1', last ? '' : 'pb-5')}
                        >
                            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-[0.8438rem] font-bold">
                                    {step.label}
                                </span>
                                {step.current ? (
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-[0.6875rem] font-extrabold',
                                            closed
                                                ? 'bg-neutral-soft text-secondary-foreground'
                                                : overdue
                                                  ? 'bg-destructive-soft text-destructive'
                                                  : 'bg-primary-soft text-primary-deep',
                                        )}
                                    >
                                        {closed
                                            ? 'Berhenti di sini'
                                            : overdue
                                              ? 'Mandek'
                                              : 'Sekarang'}
                                    </span>
                                ) : null}
                            </span>

                            <span className="mt-0.5 block text-xs text-muted-foreground">
                                Masuk {longDate(step.enteredAt)} ·{' '}
                                <span
                                    className={cn(
                                        overdue && 'font-bold text-destructive',
                                    )}
                                    data-numeric
                                >
                                    {step.days} hari
                                </span>
                                {step.current && !closed
                                    ? ` dari batas ${threshold}`
                                    : ''}
                            </span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function StageMenu({
    current,
    onPick,
    onClose,
}: {
    current: string;
    onPick: (stage: string) => void;
    onClose: () => void;
}) {
    const { stages } = usePipeline();
    const requirementFor = useStageRequirement();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="lg" className="shadow-teal">
                    Pindah tahap
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs">
                    Pindah ke tahap
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {stages.map((stage) => {
                    const isCurrent = stage.key === current;
                    const requirement = requirementFor(stage.key);

                    return (
                        <DropdownMenuItem
                            key={stage.key}
                            disabled={isCurrent}
                            className="gap-2"
                            onSelect={() => onPick(stage.key)}
                        >
                            <span
                                className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    STAGE_DOT[stage.key],
                                )}
                                aria-hidden
                            />
                            {stage.label}
                            {isCurrent ? (
                                <Check
                                    className="ml-auto size-3.5"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            ) : requirement ? (
                                <Paperclip
                                    className="ml-auto size-3.5 text-muted-foreground"
                                    strokeWidth={2}
                                    aria-label="butuh dokumen"
                                />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}

                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onSelect={onClose}>
                    <CircleSlash
                        className="size-3.5 text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                    />
                    Tutup lead
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Panel({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6">
            <h2 className="text-base font-extrabold tracking-[-0.02em]">
                {title}
            </h2>
            <p className="mt-1 mb-5 text-xs leading-relaxed text-muted-foreground">
                {description}
            </p>
            {children}
        </section>
    );
}

function Fact({
    label,
    children,
    wide = false,
}: {
    label: string;
    children: React.ReactNode;
    wide?: boolean;
}) {
    return (
        <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
            <dt className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="mt-1 text-[0.8438rem] font-bold">{children}</dd>
        </div>
    );
}

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="truncate text-right font-bold">{children}</dd>
        </div>
    );
}

function ContactAction({
    icon: Icon,
    label,
    href,
    external = false,
}: {
    icon: typeof Phone;
    label: string;
    href: string;
    external?: boolean;
}) {
    return (
        <a
            href={href}
            {...(external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[0.8438rem] font-bold text-secondary-foreground shadow-lift transition-colors hover:border-primary/35 hover:text-primary-deep"
        >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
            {label}
        </a>
    );
}

LeadDetailPage.layout = {
    breadcrumbs: [{ title: 'Leads', href: leads() }],
};
