import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * The Kisantra mark, on the tile that belongs to it.
 *
 * The mark is white with one Teal Ink arm, so it only ever reads on Deep Teal.
 * The tile is therefore part of the logo rather than decoration around it, and
 * it lives here instead of at each call site. It uses `brand-tile` rather than
 * `primary` on purpose: `primary` becomes the data-only Bright Teal in the dark
 * theme, and a white mark on that clears only 2.4:1.
 *
 * This is the plain rendition. The mark's batik fill repeats every ~40px at
 * source size, so anywhere under roughly 100px it stops being a pattern, goes
 * flat grey, and takes the contrast down with it. Nothing in the app draws the
 * logo that large. The batik survives only on the 180px touch icon.
 */
export default function AppLogoIcon({
    className,
    ...props
}: ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'shrink-0 overflow-hidden rounded-lg bg-brand-tile',
                className,
            )}
            {...props}
        >
            <img
                src="/img/kisantra-mark.png"
                alt=""
                aria-hidden
                className="size-full object-contain"
            />
        </div>
    );
}
