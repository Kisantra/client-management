import { useLayoutEffect, useRef, useState } from 'react';
import type { Preview } from '@/data/letters';
import { cn } from '@/lib/utils';

/** A4 at 96dpi: what the server-side stylesheet sizes the page to. */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

/**
 * The letter as it will print, at whatever width the column allows.
 *
 * The page is rendered on the server — the same HTML the PDF is made from,
 * so the preview cannot drift from the file — and shown here on a white
 * A4 sheet over the letterhead. When the column is narrower than a sheet,
 * the sheet is scaled down rather than reflowed, because a reflowed letter
 * would tell a lie about where its lines break.
 */
export function Paper({
    preview,
    busy = false,
    className,
}: {
    preview: Preview;
    /** True while a save is in flight: the page dims until it is current. */
    busy?: boolean;
    className?: string;
}) {
    const frame = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const node = frame.current;

        if (!node) {
            return;
        }

        const fit = () => setScale(Math.min(1, node.clientWidth / PAGE_WIDTH));

        fit();

        const observer = new ResizeObserver(fit);
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={frame} className={cn('w-full', className)}>
            <style>{preview.css}</style>
            <div
                className={cn(
                    'relative mx-auto overflow-hidden rounded-sm shadow-lift-lg ring-1 ring-black/10 transition-opacity',
                    busy && 'opacity-60',
                )}
                style={{
                    width: PAGE_WIDTH * scale,
                    minHeight: PAGE_HEIGHT * scale,
                }}
            >
                <div
                    className="origin-top-left"
                    style={{
                        width: PAGE_WIDTH,
                        transform: `scale(${scale})`,
                    }}
                    /* Server-rendered by the app's own renderer, every value
                       escaped there; this is the one place the page is shown. */
                    dangerouslySetInnerHTML={{ __html: preview.html }}
                />
            </div>
        </div>
    );
}
