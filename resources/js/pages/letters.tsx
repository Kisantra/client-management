import { Head, Link, router } from '@inertiajs/react';
import { FileText, Plus, Search, Settings2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { CountChip } from '@/components/count-chip';
import { StatusPill } from '@/components/letters/status-pill';
import { ListPager } from '@/components/list-pager';
import { Button } from '@/components/ui/button';
import { entryDate } from '@/data/leads';
import type { LetterRow, LetterStatus } from '@/data/letters';
import { rowLink } from '@/lib/row-link';
import { letters } from '@/routes';
import {
    create as letterCreate,
    show as letterShow,
    templates as templatesIndex,
} from '@/routes/letters';
import { seed as seedTemplates } from '@/routes/letters/templates';

type Props = {
    filters: { status: LetterStatus | 'semua'; q: string };
    statuses: { key: LetterStatus; label: string; count: number }[];
    total: number;
    rows: {
        data: LetterRow[];
        from: number;
        to: number;
        total: number;
        current: number;
        last: number;
    };
    hasTemplates: boolean;
};

/**
 * Surat keluar: everything written on the letterhead, by status.
 */
export default function LettersPage({
    filters,
    statuses,
    total,
    rows,
    hasTemplates,
}: Props) {
    const [query, setQuery] = useState(filters.q);
    const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

    const go = (patch: Record<string, string | number | null>) => {
        const next: Record<string, string> = {
            status: filters.status,
            q: query,
        };

        for (const [key, value] of Object.entries(patch)) {
            next[key] = value === null ? '' : String(value);
        }

        if (!('page' in patch)) {
            delete next.page;
        }

        for (const key of Object.keys(next)) {
            if (
                next[key] === '' ||
                (key === 'status' && next[key] === 'semua')
            ) {
                delete next[key];
            }
        }

        router.get(letters.url(), next, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const search = (value: string) => {
        setQuery(value);

        if (typing.current) {
            clearTimeout(typing.current);
        }

        typing.current = setTimeout(() => go({ q: value }), 350);
    };

    const filtered = filters.status !== 'semua' || filters.q !== '';

    return (
        <>
            <Head title="Surat" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Surat
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            <span
                                className="font-bold text-foreground"
                                data-numeric
                            >
                                {rows.total}
                            </span>{' '}
                            surat {filtered ? 'cocok' : 'tercatat'}
                            {filtered ? (
                                <>
                                    {' '}
                                    dari <span data-numeric>{total}</span>
                                </>
                            ) : null}
                            . Dibuat dari template, diterbitkan dengan nomor,
                            dikirim sebagai PDF.
                        </p>
                    </div>

                    <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
                        <Button
                            size="lg"
                            variant="outline"
                            className="flex-1 sm:flex-none"
                            asChild
                        >
                            <Link href={templatesIndex()} prefetch>
                                <Settings2 strokeWidth={2} aria-hidden />
                                Template
                            </Link>
                        </Button>
                        <Button
                            size="lg"
                            className="flex-1 shadow-teal sm:flex-none"
                            asChild
                        >
                            <Link href={letterCreate()} prefetch>
                                <Plus strokeWidth={2.5} aria-hidden />
                                Buat surat
                            </Link>
                        </Button>
                    </div>
                </div>

                {hasTemplates ? null : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-primary-soft p-4">
                        <p className="text-[0.8438rem] leading-relaxed text-primary-deep">
                            <span className="font-bold">
                                Belum ada template surat.
                            </span>{' '}
                            Pasang redaksi bawaan kantor dulu; setelah itu bisa
                            diubah kapan saja di halaman Template.
                        </p>
                        <Button
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
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex flex-wrap gap-2">
                        <CountChip
                            label="Semua"
                            count={total}
                            active={filters.status === 'semua'}
                            onClick={() => go({ status: 'semua' })}
                        />
                        {statuses.map((status) => (
                            <CountChip
                                key={status.key}
                                label={status.label}
                                count={status.count}
                                active={filters.status === status.key}
                                onClick={() => go({ status: status.key })}
                                tone={
                                    status.key === 'batal' ? 'closed' : 'stage'
                                }
                            />
                        ))}
                    </div>

                    <label className="relative flex-1 sm:ml-auto sm:max-w-xs">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <input
                            value={query}
                            onChange={(event) => search(event.target.value)}
                            placeholder="Cari nomor, perihal, client, atau proyek"
                            className="h-11 w-full rounded-md border border-border bg-card pr-9 pl-9 text-[0.8438rem] font-semibold shadow-lift outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        />
                        {query ? (
                            <button
                                type="button"
                                onClick={() => search('')}
                                className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-neutral-soft"
                            >
                                <X className="size-3.5" strokeWidth={2.5} />
                                <span className="sr-only">Hapus pencarian</span>
                            </button>
                        ) : null}
                    </label>
                </div>

                <section className="rounded-xl border border-border bg-card p-5 shadow-lift">
                    {rows.data.length === 0 ? (
                        <p className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-10 text-center text-xs text-muted-foreground">
                            <FileText
                                className="size-5"
                                strokeWidth={1.75}
                                aria-hidden
                            />
                            {filtered
                                ? 'Tidak ada surat yang cocok.'
                                : 'Belum ada surat. Buat yang pertama dari tombol di atas.'}
                        </p>
                    ) : (
                        <>
                            <div className="hidden md:block">
                                <table className="w-full border-collapse text-left">
                                    <caption className="sr-only">
                                        Daftar surat keluar beserta nomor,
                                        client, tanggal, dan statusnya.
                                    </caption>
                                    <thead>
                                        <tr className="border-b border-border text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                            <th
                                                scope="col"
                                                className="py-3 pr-4 font-bold"
                                            >
                                                Nomor
                                            </th>
                                            <th
                                                scope="col"
                                                className="py-3 pr-4 font-bold"
                                            >
                                                Perihal
                                            </th>
                                            <th
                                                scope="col"
                                                className="py-3 pr-4 font-bold"
                                            >
                                                Client
                                            </th>
                                            <th
                                                scope="col"
                                                className="py-3 pr-4 font-bold"
                                            >
                                                Tanggal
                                            </th>
                                            <th
                                                scope="col"
                                                className="py-3 pr-4 font-bold"
                                            >
                                                Status
                                            </th>
                                            <th
                                                scope="col"
                                                className="py-3 font-bold"
                                            >
                                                Oleh
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.data.map((letter) => (
                                            <tr
                                                key={letter.id}
                                                {...rowLink(
                                                    letterShow(letter.id),
                                                )}
                                                className="cursor-pointer border-b border-border text-[0.8438rem] transition-colors last:border-b-0 hover:bg-neutral-soft"
                                            >
                                                <th
                                                    scope="row"
                                                    className="py-3 pr-4 text-left font-normal whitespace-nowrap"
                                                >
                                                    <Link
                                                        href={letterShow(
                                                            letter.id,
                                                        )}
                                                        prefetch
                                                        className="font-bold underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                                                        data-numeric
                                                    >
                                                        {letter.number ??
                                                            'Belum bernomor'}
                                                    </Link>
                                                </th>
                                                <td className="max-w-[20rem] py-3 pr-4">
                                                    <span className="block truncate font-bold">
                                                        {letter.subject}
                                                    </span>
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {letter.project
                                                            ? `${letter.template} · ${letter.project}`
                                                            : letter.template}
                                                    </span>
                                                </td>
                                                <td className="max-w-[16rem] truncate py-3 pr-4">
                                                    {letter.client}
                                                </td>
                                                <td
                                                    className="py-3 pr-4 whitespace-nowrap text-muted-foreground"
                                                    data-numeric
                                                >
                                                    {entryDate(letter.date)}
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <StatusPill
                                                        status={letter.status}
                                                        label={
                                                            letter.statusLabel
                                                        }
                                                    />
                                                </td>
                                                <td className="py-3 text-xs text-muted-foreground">
                                                    {letter.author ?? '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <ul className="flex flex-col divide-y divide-border md:hidden">
                                {rows.data.map((letter) => (
                                    <li key={letter.id}>
                                        <Link
                                            href={letterShow(letter.id)}
                                            prefetch
                                            className="flex items-start justify-between gap-3 py-3"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-[0.8438rem] font-bold">
                                                    {letter.subject}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {letter.client} ·{' '}
                                                    {entryDate(letter.date)}
                                                </span>
                                                <span
                                                    className="mt-1 block text-xs text-muted-foreground"
                                                    data-numeric
                                                >
                                                    {letter.number ??
                                                        'Belum bernomor'}
                                                </span>
                                            </span>
                                            <StatusPill
                                                status={letter.status}
                                                label={letter.statusLabel}
                                                className="shrink-0"
                                            />
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                            {rows.last > 1 ? (
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                                    <span data-numeric>
                                        {rows.from}–{rows.to} dari {rows.total}
                                    </span>
                                    <ListPager
                                        current={rows.current}
                                        last={rows.last}
                                        onPage={(page) => go({ page })}
                                    />
                                </div>
                            ) : null}
                        </>
                    )}
                </section>
            </div>
        </>
    );
}
