import { router } from '@inertiajs/react';
import { Check, ExternalLink, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Handoff } from '@/data/leads';
import { cn } from '@/lib/utils';
import { store as sendHandoff } from '@/routes/leads/handoff';

const when = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
});

const STATE: Record<Handoff['status'], { label: string; tone: string }> = {
    antre: { label: 'Mengirim', tone: 'bg-primary-soft text-primary-deep' },
    terkirim: {
        label: 'Dicek tim pajak',
        tone: 'bg-primary-soft text-primary-deep',
    },
    lengkap: { label: 'Sudah diproses', tone: 'bg-primary text-white' },
    batal: {
        label: 'Deal batal',
        tone: 'bg-neutral-soft text-secondary-foreground',
    },
    gagal: {
        label: 'Belum terkirim',
        tone: 'bg-destructive-soft text-destructive',
    },
};

/**
 * Where a signed client stands in Project Management.
 *
 * The lead decides what should be true over there and the server makes it so;
 * this only reads back how far that got, and offers the one thing a person
 * can do about it — send again.
 */
export function HandoffPanel({
    handoff,
    leadId,
    signed,
}: {
    handoff: Handoff | null;
    leadId: number;
    /** Signed and still on, so Project Management should be holding it. */
    signed: boolean;
}) {
    const [sending, setSending] = useState(false);

    const send = () =>
        router.post(
            sendHandoff(leadId).url,
            {},
            {
                preserveScroll: true,
                onStart: () => setSending(true),
                onFinish: () => setSending(false),
            },
        );

    const state = handoff
        ? STATE[handoff.status]
        : {
              label: 'Belum dikirim',
              tone: 'bg-neutral-soft text-secondary-foreground',
          };

    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-base font-extrabold tracking-[-0.02em]">
                        Project Management
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Serah terima client ke tim pajak.
                    </p>
                </div>
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold whitespace-nowrap',
                        state.tone,
                    )}
                >
                    {state.label}
                </span>
            </div>

            <div className="mt-5">
                {handoff === null ? (
                    <p className="text-xs leading-relaxed text-secondary-foreground">
                        Deal ini tercatat sebelum Client Management tersambung
                        ke Project Management, jadi belum pernah dikirim.
                    </p>
                ) : (
                    <Body handoff={handoff} signed={signed} />
                )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
                {handoff === null || handoff.status === 'gagal' ? (
                    <Button
                        size="sm"
                        variant={handoff ? 'outline' : 'default'}
                        onClick={send}
                        disabled={sending}
                    >
                        {handoff ? (
                            <RotateCcw strokeWidth={2} aria-hidden />
                        ) : (
                            <Send strokeWidth={2} aria-hidden />
                        )}
                        {sending
                            ? 'Mengirim…'
                            : handoff
                              ? 'Kirim ulang'
                              : 'Kirim ke Project Management'}
                    </Button>
                ) : null}

                {handoff?.clientUrl ? (
                    <a
                        href={handoff.clientUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary-deep underline-offset-4 hover:underline"
                    >
                        Buka di Project Management
                        <ExternalLink
                            className="size-3.5"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                    </a>
                ) : null}
            </div>
        </section>
    );
}

function Body({ handoff, signed }: { handoff: Handoff; signed: boolean }) {
    if (handoff.status === 'antre') {
        return (
            <p className="text-xs leading-relaxed text-secondary-foreground">
                {signed
                    ? 'Data client sedang dikirim ke Project Management.'
                    : 'Project Management sedang dikabari bahwa Deal ini batal.'}
            </p>
        );
    }

    if (handoff.status === 'gagal') {
        return (
            <div className="rounded-lg bg-destructive-soft p-3 text-xs leading-relaxed text-destructive">
                <p className="font-semibold">
                    {handoff.error ?? 'Project Management tidak menjawab.'}
                </p>
                <p className="mt-1">
                    {handoff.exhausted
                        ? 'Tidak dicoba lagi otomatis. Tahap lead tetap tersimpan.'
                        : `Dicoba lagi otomatis (percobaan ${handoff.attempts} dari 3). Tahap lead tetap tersimpan.`}
                </p>
            </div>
        );
    }

    if (handoff.status === 'batal') {
        return (
            <p className="text-xs leading-relaxed text-secondary-foreground">
                Project Management sudah dikabari bahwa Deal ini batal
                {handoff.withdrawnAt
                    ? `, ${when.format(new Date(handoff.withdrawnAt))}`
                    : ''}
                . Data client di sana tidak dihapus. Kalau lead ini kembali ke
                Deal, client-nya dikirim lagi.
            </p>
        );
    }

    const done = handoff.status === 'lengkap';
    const processed = [
        handoff.completedBy ? `Oleh ${handoff.completedBy}` : null,
        handoff.completedAt ? when.format(new Date(handoff.completedAt)) : null,
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <ol className="flex flex-col gap-3">
            <Step
                state="done"
                title="Terkirim"
                detail={
                    handoff.sentAt
                        ? when.format(new Date(handoff.sentAt))
                        : undefined
                }
            />
            <Step
                state={done ? 'done' : 'now'}
                title={done ? 'Dicek tim pajak' : 'Menunggu dicek tim pajak'}
                detail={
                    done
                        ? handoff.matched
                            ? 'Ditautkan ke client yang sudah ada di Project Management.'
                            : 'Dibuat sebagai client baru.'
                        : 'Tim pajak mengecek datanya, melengkapinya, lalu membuat client dan proyeknya.'
                }
            />
            <Step
                state={done ? 'done' : 'todo'}
                title="Client dan proyek dibuat"
                detail={done ? processed || undefined : undefined}
            >
                {done && handoff.projectName ? (
                    <ProjectLink
                        name={handoff.projectName}
                        url={handoff.projectUrl}
                    />
                ) : null}
            </Step>
        </ol>
    );
}

function ProjectLink({ name, url }: { name: string; url: string | null }) {
    if (!url) {
        return (
            <span className="mt-1 block text-xs font-bold">Proyek: {name}</span>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-bold text-primary-deep underline-offset-4 hover:underline"
        >
            <span className="truncate">Proyek: {name}</span>
            <ExternalLink
                className="size-3 shrink-0"
                strokeWidth={2.5}
                aria-hidden
            />
        </a>
    );
}

function Step({
    state,
    title,
    detail,
    children,
}: {
    state: 'done' | 'now' | 'todo';
    title: string;
    detail?: string;
    children?: React.ReactNode;
}) {
    return (
        <li className="grid grid-cols-[1.25rem_1fr] gap-2.5 text-[0.8438rem]">
            <span
                className={cn(
                    'mt-px grid size-5 place-items-center rounded-full',
                    state === 'done' && 'bg-primary text-white',
                    state === 'now' && 'border-2 border-primary bg-card',
                    state === 'todo' && 'border-2 border-input bg-card',
                )}
                aria-hidden
            >
                {state === 'done' ? (
                    <Check className="size-3" strokeWidth={3} />
                ) : state === 'now' ? (
                    <span className="size-2 rounded-full bg-primary" />
                ) : null}
            </span>
            <span className="min-w-0">
                <span
                    className={cn(
                        'block font-bold',
                        state === 'todo' && 'text-muted-foreground',
                    )}
                >
                    {title}
                </span>
                {detail ? (
                    <span className="block text-xs text-muted-foreground">
                        {detail}
                    </span>
                ) : null}
                {children}
            </span>
        </li>
    );
}
