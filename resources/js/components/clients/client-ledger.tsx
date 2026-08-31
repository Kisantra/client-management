import type { ReactNode } from 'react';
import type { ClientSummary } from '@/data/clients';
import { shortRupiah } from '@/data/leads';
import { cn } from '@/lib/utils';

/**
 * The page's four figures on one ruled line, each beside the quantity it is
 * measured against: a ledger entry rather than a row of islands. Two by two on
 * a phone, four across from `xl`, and the hairlines come from the grid gap.
 */
export function ClientLedger({
    summary,
    threshold,
    onNeedsContact,
}: {
    summary: ClientSummary;
    /** Days without contact after which a client counts as due a call. */
    threshold: number;
    /** Turns the list into the call sheet: longest unspoken-to first. */
    onNeedsContact: () => void;
}) {
    const { count } = summary;
    const due = summary.needsContact;

    return (
        <section
            aria-label="Ringkasan client"
            className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-lift xl:grid-cols-4"
        >
            <Figure
                label="Client aktif"
                value={count}
                caption={
                    <>
                        <span
                            className="font-semibold text-foreground"
                            data-numeric
                        >
                            {summary.newThisMonth > 0 ? '+' : ''}
                            {summary.newThisMonth}
                        </span>{' '}
                        bulan ini ·{' '}
                        <span data-numeric>{summary.newLastMonth}</span> pada{' '}
                        {summary.lastMonth}
                    </>
                }
            />

            <Figure
                label="Nilai kerja sama"
                value={shortRupiah(summary.value)}
                caption={
                    count > 0 ? (
                        <>
                            rata-rata{' '}
                            <span data-numeric>
                                {shortRupiah(summary.average)}
                            </span>{' '}
                            per client
                        </>
                    ) : (
                        'belum ada nilai yang tercatat'
                    )
                }
            />

            <Figure
                label="Dari lead ke client"
                value={
                    summary.medianDays === null
                        ? '—'
                        : `${summary.medianDays} hari`
                }
                caption={
                    summary.fastestDays === null ? (
                        'dari tanggal masuk sampai jadi client'
                    ) : (
                        <>
                            median · tercepat{' '}
                            <span data-numeric>{summary.fastestDays} hari</span>
                        </>
                    )
                }
            />

            <Figure
                label="Perlu disapa"
                value={due}
                alarm={due > 0}
                caption={
                    <>
                        belum dihubungi lebih dari{' '}
                        <span data-numeric>{threshold}</span> hari
                    </>
                }
                onClick={due > 0 ? onNeedsContact : undefined}
            />
        </section>
    );
}

function Figure({
    label,
    value,
    caption,
    alarm = false,
    onClick,
}: {
    label: string;
    value: ReactNode;
    caption: ReactNode;
    /** Red only for a breach: clients going unspoken-to, never a plain total. */
    alarm?: boolean;
    onClick?: () => void;
}) {
    const body = (
        <>
            <span className="block text-[0.8438rem] leading-tight font-semibold text-muted-foreground">
                {label}
            </span>
            <span
                className={cn(
                    'mt-2 block text-[1.5rem] leading-none font-extrabold tracking-[-0.03em]',
                    alarm && 'text-destructive',
                )}
                data-numeric
            >
                {value}
            </span>
            <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                {caption}
            </span>
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="min-w-0 bg-card p-4 text-left transition-colors hover:bg-neutral-soft sm:p-5"
            >
                {body}
                <span className="sr-only">
                    Urutkan daftar dari yang paling lama tidak dihubungi
                </span>
            </button>
        );
    }

    return <div className="min-w-0 bg-card p-4 sm:p-5">{body}</div>;
}
