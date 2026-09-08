import { useState } from 'react';

import AppLogoIcon from '@/components/app-logo-icon';
import { cn } from '@/lib/utils';

/**
 * The frames the stack cycles, in the order the work actually runs: something
 * is planned, it brings a lead, the lead is measured, and the next day starts
 * from what that left behind.
 *
 * Every frame is a real screenshot of this app, carrying its own "Data contoh"
 * badge, so the sample figures in them are labelled as sample on their face.
 * Each is rendered at nine times size and then downsampled to the two widths a
 * 2x and a 1x display actually ask for, so the shot is never scaled up: at the
 * size these cards hold it, the picture carries about three device pixels per
 * CSS pixel.
 */
const SCREENS = [
    {
        name: 'konten',
        caption: 'Kalender konten — satu bulan, semua channel, satu papan.',
    },
    {
        name: 'leads',
        caption: 'Papan lead — mana yang jalan, mana yang sudah lama diam.',
    },
    {
        name: 'performa',
        caption: 'Performa — konten mana yang benar-benar membawa client.',
    },
    {
        name: 'dashboard',
        caption: 'Dashboard — yang jatuh tempo hari ini, di layar pertama.',
    },
];

/**
 * The sign-in splash: two windows of the workspace, one behind the other.
 *
 * Two earlier versions filled this half with a coloured field — first teal,
 * then ink — and both were the same mistake in a different hue: a slab of flat
 * colour large enough to become the thing you look at, with the product reduced
 * to a tenant on it. There is no panel now. The screenshots are the only
 * objects here, laid on the page's own ground as cards, and what used to be
 * background is simply the paper the form sits on.
 *
 * Both cards are whole. Nothing is cropped and nothing runs off an edge, which
 * costs size — the app sits at about two thirds — and buys the one thing a
 * product shot has to have: you can see what it is. The pair is sized off the
 * space it is given rather than off the viewport, so it shrinks with the column
 * instead of spilling out of it.
 *
 * The cards never move. Only the picture inside each one changes, and it
 * changes by opacity alone, which is the whole reason it is smooth: an earlier
 * cut dealt the cards themselves between stacking orders, and z-index cannot be
 * animated, so every hand-off snapped. Two fixed seats and a dissolve have
 * nothing to snap.
 *
 * The bar under the copy spends the frame's time and its `animationend` is what
 * turns the pair over, so the picture and its clock cannot drift apart.
 * Hovering pauses the bar and the turn with it. `prefers-reduced-motion` drops
 * the bar's animation and every advance with it: two cards, held.
 */
export function WorkspaceSplash() {
    const [active, setActive] = useState(0);

    /*
     | Frames are fetched as the cycle reaches them — the two on show rather
     | than four, on the one page every visit begins at. The card behind is
     | already showing the next one, so nothing ever waits on the network.
     */
    const [mounted, setMounted] = useState(2);

    const show = (next: number) => {
        setActive(next);
        setMounted((count) =>
            Math.max(count, Math.min(SCREENS.length, next + 2)),
        );
    };

    return (
        <div className="group/splash relative flex h-full flex-col overflow-hidden px-10 pt-14 pb-10 xl:px-14 xl:pt-16 xl:pb-14">
            <header>
                <div className="flex items-center gap-2.5">
                    <AppLogoIcon className="size-8" />
                    <p className="text-sm leading-tight font-bold tracking-[-0.01em]">
                        Kisantra{' '}
                        <span className="font-normal text-muted-foreground">
                            · Tim Digital Marketing
                        </span>
                    </p>
                </div>

                <p className="animate-float-in mt-8 max-w-[20ch] text-3xl leading-[1.1] font-extrabold tracking-[-0.035em] text-balance xl:text-4xl">
                    Dari konten sampai client aktif, dalam satu alur.
                </p>

                <p
                    key={active}
                    className="animate-caption-in mt-3.5 max-w-[42ch] text-sm leading-relaxed text-muted-foreground"
                >
                    {SCREENS[active].caption}
                </p>

                {/*
                    Pointer-only, and hidden from assistive technology on
                    purpose. The stack is decoration — nothing in it is needed to
                    sign in — so putting four real controls in front of the email
                    field would make every keyboard user tab through the artwork
                    to reach the form. The cycle advances on its own regardless.
                */}
                <div aria-hidden className="mt-6 flex gap-1.5">
                    {SCREENS.map((screen, index) => (
                        <button
                            key={screen.name}
                            type="button"
                            tabIndex={-1}
                            onClick={() => show(index)}
                            className={cn(
                                'cursor-pointer py-2.5 transition-[width] duration-500 ease-out',
                                index === active ? 'w-10' : 'w-4',
                            )}
                        >
                            <span className="block h-1 overflow-hidden rounded-full bg-border">
                                {index === active ? (
                                    <span
                                        key={active}
                                        onAnimationEnd={() =>
                                            show((active + 1) % SCREENS.length)
                                        }
                                        className="animate-dwell block size-full origin-left rounded-full bg-primary group-hover/splash:[animation-play-state:paused]"
                                    />
                                ) : null}
                            </span>
                        </button>
                    ))}
                </div>
            </header>

            {/*
                The pair is one box with a fixed ratio, centred in whatever is
                left below the copy. Both cards are placed as percentages of it,
                so the whole composition scales with the column and keeps its
                overlap exactly — there is no breakpoint at which one card
                slides off the other.

                The ratio is picked so the box is always the width of the space
                it is in and never the height of it; any narrower and a tall
                window would clamp it and skew the pair. The offsets are the
                other half of that choice: enough drop to leave the card behind
                showing its own header and page title, so the two read as two
                different screens rather than as one screen printed twice.
            */}
            <div className="mt-10 flex min-h-0 flex-1 items-center">
                <div className="relative aspect-[1.46] max-h-full w-full">
                    <Frame
                        shown={(active + 1) % SCREENS.length}
                        mounted={mounted}
                        className="top-0 left-0"
                        delay="delay-150"
                    />
                    <Frame
                        shown={active}
                        mounted={mounted}
                        className="top-[23.1%] left-[29.6%]"
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * One seat in the pair, holding whichever frame is currently its own.
 *
 * The card's ratio is the screenshot's ratio, so `object-contain` letterboxes
 * nothing in practice; it is there as the guarantee that a squeezed viewport
 * shows a smaller picture rather than a cropped one.
 */
function Frame({
    shown,
    mounted,
    className,
    delay,
}: {
    shown: number;
    mounted: number;
    className: string;
    /** The card behind turns over a beat late, so the pair reads as a pair. */
    delay?: string;
}) {
    return (
        <div
            className={cn(
                'absolute aspect-[780/584] w-[70.4%] overflow-hidden rounded-xl bg-card shadow-carry ring-1 ring-border',
                className,
            )}
        >
            {SCREENS.slice(0, mounted).map((screen, index) => (
                <img
                    key={screen.name}
                    src={`/img/splash/${screen.name}.webp`}
                    srcSet={`/img/splash/${screen.name}@1x.webp 780w, /img/splash/${screen.name}.webp 1560w`}
                    sizes="(min-width: 1024px) 38vw, 1px"
                    alt=""
                    aria-hidden
                    width={1560}
                    height={1168}
                    decoding="async"
                    loading={index < 2 ? 'eager' : 'lazy'}
                    className={cn(
                        'absolute inset-0 size-full object-contain transition-opacity duration-500 ease-out motion-reduce:transition-none',
                        delay,
                        index === shown ? 'opacity-100' : 'opacity-0',
                    )}
                />
            ))}
        </div>
    );
}
