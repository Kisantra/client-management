import { Link, router } from '@inertiajs/react';
import { ChartNoAxesColumn, Rows3 } from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { PeriodFilter } from '@/components/period-filter';
import type { Period } from '@/components/period-filter';
import { Button } from '@/components/ui/button';
import { sinceLabel } from '@/data/instagram';
import type { InstagramAccount, Platform, PlatformKey } from '@/data/instagram';
import { cn } from '@/lib/utils';
import { performance } from '@/routes';
import {
    content as performanceContent,
    refresh as performanceRefresh,
} from '@/routes/performance';

/** The windows both Performa pages offer. Everything here already happened. */
export const PERIODS = ['30hari', '90hari', '6bulan', 'tahun', 'semua'];

/**
 * The band both Instagram surfaces open with.
 *
 * One account, two readings of it — so the switch between them lives beside the
 * account, not in the sidebar. The refresh button sits here too because it is
 * the only thing on either page that changes what the other one says, and the
 * window sits here because it is the one thing that changes what *both* say:
 * moving between the two readings must not quietly change the stretch either
 * of them covers, so the links carry it across.
 */
export function PerformanceHeader({
    handle,
    account,
    connected,
    view,
    platform,
    platforms,
    period,
    onPeriodChange,
}: {
    handle: string;
    account: InstagramAccount | null;
    connected: boolean;
    view: 'statistik' | 'konten';
    platform: PlatformKey;
    platforms: Platform[];
    period: Period;
    onPeriodChange: (next: {
        periode: string;
        dari?: string;
        sampai?: string;
    }) => void;
}) {
    /* The account and the window travel with you between the two readings. */
    const held = platform === 'instagram' ? {} : { platform };

    const carry =
        period.key === 'semua'
            ? held
            : period.key === 'khusus'
              ? {
                    ...held,
                    periode: 'khusus',
                    dari: period.from ?? '',
                    sampai: period.to ?? '',
                }
              : { ...held, periode: period.key };
    const [pulling, setPulling] = useState(false);

    const pull = () =>
        router.post(
            performanceRefresh({ query: held }).url,
            {},
            {
                preserveScroll: true,
                onStart: () => setPulling(true),
                onFinish: () => setPulling(false),
            },
        );

    return (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
                <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                    Performa
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                    <span>
                        {platforms.find((item) => item.key === platform)
                            ?.label ?? 'Instagram'}{' '}
                        <span className="font-bold text-foreground">
                            @{handle}
                        </span>
                    </span>
                    {account?.fetchedAt ? (
                        <span>
                            · diperbarui {sinceLabel(account.fetchedAt)}
                        </span>
                    ) : null}
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-primary-deep uppercase">
                        Data asli
                    </span>
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                {/*
                    Which account, before how it is read: the two views beside
                    it are two readings of whichever one is chosen here.

                    The chosen one sits in its own channel's bed rather than in
                    Deep Teal, so the two controls stop looking like one: this
                    asks which account, the next asks which reading of it, and
                    a shared teal fill said they were the same kind of question.
                */}
                <div className="flex rounded-md border border-border bg-card p-1 shadow-lift">
                    {platforms.map((item) => (
                        <Link
                            key={item.key}
                            href={
                                view === 'statistik'
                                    ? performance({
                                          query:
                                              item.key === 'instagram'
                                                  ? {}
                                                  : { platform: item.key },
                                      })
                                    : performanceContent({
                                          query:
                                              item.key === 'instagram'
                                                  ? {}
                                                  : { platform: item.key },
                                      })
                            }
                            prefetch
                            aria-current={
                                item.key === platform ? 'page' : undefined
                            }
                            className={cn(
                                'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[0.8438rem] font-bold transition-colors',
                                item.key === platform
                                    ? CHANNEL_TONE[item.key].filled
                                    : 'text-muted-foreground hover:bg-neutral-soft hover:text-secondary-foreground',
                            )}
                        >
                            {/* Off its own bed the mark carries the platform
                                alone, so it keeps its own ink. */}
                            <ChannelIcon
                                channel={item.key}
                                className={cn(
                                    'size-3.5 shrink-0',
                                    item.key !== platform &&
                                        CHANNEL_TONE[item.key].text,
                                )}
                            />
                            {item.label}
                        </Link>
                    ))}
                </div>

                <PeriodFilter
                    period={period}
                    options={PERIODS}
                    onChange={onPeriodChange}
                />

                <div className="flex rounded-md border border-border bg-card p-1 shadow-lift">
                    <ViewLink
                        href={performance({ query: carry })}
                        active={view === 'statistik'}
                        label="Statistik"
                    >
                        <ChartNoAxesColumn
                            className="size-4"
                            strokeWidth={2}
                            aria-hidden
                        />
                    </ViewLink>
                    <ViewLink
                        href={performanceContent({ query: carry })}
                        active={view === 'konten'}
                        label="Konten"
                    >
                        <Rows3 className="size-4" strokeWidth={2} aria-hidden />
                    </ViewLink>
                </div>

                <Button
                    size="lg"
                    className="shadow-teal"
                    onClick={pull}
                    disabled={pulling || !connected}
                >
                    <RefreshCw
                        className={cn(pulling && 'animate-spin')}
                        strokeWidth={2}
                        aria-hidden
                    />
                    {pulling ? 'Mengambil data…' : 'Perbarui data'}
                </Button>
            </div>
        </div>
    );
}

function ViewLink({
    children,
    href,
    active,
    label,
}: {
    children: React.ReactNode;
    href: ReturnType<typeof performance>;
    active: boolean;
    label: string;
}) {
    return (
        <Link
            href={href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={cn(
                'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[0.8438rem] font-bold transition-colors',
                active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-secondary-foreground hover:text-primary-deep',
            )}
        >
            {children}
            {label}
        </Link>
    );
}
