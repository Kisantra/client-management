import { router } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import type { MouseEvent } from 'react';

import { toUrl } from '@/lib/utils';

/**
 * Makes a whole table row open the record it describes.
 *
 * The row is a pointer shortcut laid over a link that already exists, never a
 * replacement for it. The name in the first cell keeps its real `<a>`, so the
 * keyboard still reaches one honest link per row, a screen reader still
 * announces where it goes, and the tab order does not double — which is what
 * happens when a row is turned into a button and every cell becomes a stop.
 *
 * Four clicks are deliberately left alone:
 *
 *  - anything landing on a control of its own, which owns that click;
 *  - a modified or middle click, which belongs to the browser's own
 *    open-in-a-new-tab and would be stolen by a visit;
 *  - a click that ends a text selection, because somebody was reading, not
 *    navigating;
 *  - a click something else already handled.
 */
export function rowLink(href: NonNullable<InertiaLinkProps['href']>) {
    const url = toUrl(href);

    return {
        className: 'cursor-pointer',
        onClick(event: MouseEvent<HTMLElement>) {
            if (event.defaultPrevented || event.button !== 0) {
                return;
            }

            if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const onControl = (event.target as HTMLElement).closest(
                'a, button, input, select, textarea, label, [role="button"], [role="link"], [contenteditable]',
            );

            if (onControl) {
                return;
            }

            if ((window.getSelection()?.toString() ?? '') !== '') {
                return;
            }

            router.visit(url);
        },
    };
}
