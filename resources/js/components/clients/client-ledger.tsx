import type { ReactNode } from 'react';
import type { ClientSummary } from '@/data/clients';
import { shortRupiah } from '@/data/leads';

/**
 * The page's four figures on one ruled line, each beside the quantity it is
 * measured against: a ledger entry rather than a row of islands. Two by two on
 * a phone, four across from `xl`, and the hairlines come from the grid gap.
 */
export function ClientLedger({
    summary,
    endingSoonDays,
    onContracts,
}: {
    summary: ClientSummary;
    /** Days before its end that a contract counts as running out. */
    endingSoonDays: number;
    /** Orders the list by the contract that runs out first. */
    onContracts: () => void;
}) {
    const { count } = summary;

    return (
        <section
            aria-label="Ringkasan client"
            className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-lift xl:grid-cols-4"
        >
            <Figure
                label="Client aktif"
                value={summary.activeCount}
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
                        <span data-numeric>{summary.dealCount}</span> sudah deal
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
                            dari <span data-numeric>{count}</span> yang sudah
                            deal
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
                        'belum ada yang sampai jadi client'
                    ) : (
                        <>
                            median dari{' '}
                            <span data-numeric>{summary.convertedCount}</span>{' '}
                            client · tercepat{' '}
                            <span data-numeric>{summary.fastestDays} hari</span>
                        </>
                    )
                }
            />

            <Figure
                label="Kontrak berjangka"
                value={summary.contracted}
                caption={
                    <>
                        {summary.expired > 0 ? (
                            <span className="font-semibold text-destructive">
                                <span data-numeric>{summary.expired}</span>{' '}
                                sudah habis ·{' '}
                            </span>
                        ) : null}
                        <span data-numeric>{summary.endingSoon}</span> habis
                        dalam {endingSoonDays} hari ·{' '}
                        <span data-numeric>{summary.onSpot}</span> on spot
                    </>
                }
                onClick={summary.contracted > 0 ? onContracts : undefined}
            />
        </section>
    );
}

function Figure({
    label,
    value,
    caption,
    onClick,
}: {
    label: string;
    value: ReactNode;
    caption: ReactNode;
    onClick?: () => void;
}) {
    const body = (
        <>
            <span className="block text-[0.8438rem] leading-tight font-semibold text-muted-foreground">
                {label}
            </span>
            <span
                className="mt-2 block text-[1.5rem] leading-none font-extrabold tracking-[-0.03em]"
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
                    Urutkan daftar dari kontrak yang paling dekat habis
                </span>
            </button>
        );
    }

    return <div className="min-w-0 bg-card p-4 sm:p-5">{body}</div>;
}
