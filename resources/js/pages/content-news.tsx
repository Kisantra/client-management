import { Head, Link, router } from '@inertiajs/react';
import { Check, ExternalLink, Lightbulb, Newspaper } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { dayLabel, toIso } from '@/data/content';
import type { NewsRow } from '@/data/ideas';
import { TODAY } from '@/data/leads';
import { cn } from '@/lib/utils';
import { content as contentIndex } from '@/routes';
import { ideas as ideasIndex, news as newsIndex } from '@/routes/content';
import { idea as saveIdea } from '@/routes/content/news';

type Props = {
    items: NewsRow[];
};

/**
 * The stories the calendar feeds on, newest first, grouped by day. A press
 * on "Jadikan ide" moves one onto the idea backlog and the row remembers it.
 */
export default function ContentNewsPage({ items }: Props) {
    const [savingId, setSavingId] = useState<number | null>(null);

    const today = toIso(TODAY);

    const days = new Map<string, NewsRow[]>();

    for (const item of items) {
        days.set(item.publishedAt, [
            ...(days.get(item.publishedAt) ?? []),
            item,
        ]);
    }

    const save = (item: NewsRow) =>
        router.post(
            saveIdea(item.id).url,
            {},
            {
                preserveScroll: true,
                onStart: () => setSavingId(item.id),
                onFinish: () => setSavingId(null),
            },
        );

    return (
        <>
            <Head title="Berita Terbaru" />

            <div className="animate-settle flex flex-1 flex-col gap-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            Berita Terbaru
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                Bahan konten dari regulasi, media, dan
                                pertanyaan yang masuk.
                            </span>
                            <span
                                className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-secondary-foreground uppercase"
                                title="Daftar berita masih data contoh; integrasi sumber berita belum dibangun. Tombol Jadikan ide sudah tersimpan sungguhan."
                            >
                                Data contoh
                            </span>
                        </p>
                    </div>
                </div>

                {items.length === 0 ? (
                    <section className="min-w-0 rounded-xl border border-border bg-card shadow-lift">
                        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                            <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                                <Newspaper
                                    className="size-5"
                                    strokeWidth={1.75}
                                    aria-hidden
                                />
                            </span>
                            <p className="text-sm font-bold">
                                Belum ada berita
                            </p>
                            <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
                                Feed ini terisi dari seeder contoh untuk
                                sekarang; integrasi sumber berita menyusul.
                            </p>
                        </div>
                    </section>
                ) : (
                    <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-lift sm:p-5">
                        <ol className="flex flex-col gap-5">
                            {Array.from(days.entries()).map(([date, rows]) => (
                                <li key={date}>
                                    <h3 className="mb-1 flex items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                                        <span
                                            className={cn(
                                                date === today &&
                                                    'text-primary-deep',
                                            )}
                                        >
                                            {dayLabel(date)}
                                        </span>
                                        {date === today ? (
                                            <span className="rounded-full bg-primary px-1.5 py-px text-[0.6875rem] font-extrabold text-primary-foreground">
                                                Hari ini
                                            </span>
                                        ) : null}
                                        <span
                                            className="h-px flex-1 bg-border"
                                            aria-hidden
                                        />
                                    </h3>

                                    <ul className="flex flex-col">
                                        {rows.map((item) => (
                                            <li
                                                key={item.id}
                                                className="border-b border-border py-3.5 last:border-b-0 last:pb-1"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-[0.6875rem] font-bold text-secondary-foreground">
                                                                {item.source}
                                                            </span>
                                                        </p>
                                                        <p className="mt-1.5 text-[0.8438rem] leading-snug font-bold">
                                                            {item.url ? (
                                                                <a
                                                                    href={
                                                                        item.url
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                                                                >
                                                                    {item.title}
                                                                    <ExternalLink
                                                                        className="ml-1 inline size-3 align-baseline"
                                                                        strokeWidth={
                                                                            2
                                                                        }
                                                                        aria-hidden
                                                                    />
                                                                </a>
                                                            ) : (
                                                                item.title
                                                            )}
                                                        </p>
                                                        {item.summary ? (
                                                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                                                {item.summary}
                                                            </p>
                                                        ) : null}
                                                    </div>

                                                    <div className="shrink-0">
                                                        {item.ideaId ? (
                                                            <Link
                                                                href={ideasIndex()}
                                                                className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1.5 text-xs font-bold text-primary-deep transition-colors hover:bg-accent"
                                                            >
                                                                <Check
                                                                    className="size-3.5"
                                                                    strokeWidth={
                                                                        2.5
                                                                    }
                                                                    aria-hidden
                                                                />
                                                                <span className="hidden sm:inline">
                                                                    Sudah jadi
                                                                    ide
                                                                </span>
                                                            </Link>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    save(item)
                                                                }
                                                                disabled={
                                                                    savingId ===
                                                                    item.id
                                                                }
                                                            >
                                                                <Lightbulb
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    aria-hidden
                                                                />
                                                                <span className="hidden sm:inline">
                                                                    {savingId ===
                                                                    item.id
                                                                        ? 'Menyimpan…'
                                                                        : 'Jadikan ide'}
                                                                </span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}
            </div>
        </>
    );
}

ContentNewsPage.layout = {
    breadcrumbs: [
        { title: 'Konten', href: contentIndex() },
        { title: 'Berita Terbaru', href: newsIndex() },
    ],
};
