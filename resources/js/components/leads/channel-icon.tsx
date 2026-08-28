import type { ChannelKey } from '@/data/dashboard';
import { cn } from '@/lib/utils';

/**
 * Channel marks, authored as one family.
 *
 * Lucide carries no brand marks and a glyph or emoji would not be an icon
 * system, so these are drawn here: all four solid in `currentColor` at the same
 * optical weight, recognised by silhouette rather than by brand colour, which
 * keeps them inside the palette's two working hues.
 */
export function ChannelIcon({
    channel,
    className,
}: {
    channel: ChannelKey;
    className?: string;
}) {
    const shared = cn('size-3.5 shrink-0', className);

    if (channel === 'instagram') {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className={shared}
                aria-hidden
            >
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm4.5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.4-2.9a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"
                />
            </svg>
        );
    }

    if (channel === 'tiktok') {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className={shared}
                aria-hidden
            >
                <path d="M16.5 2h-3v13.2a2.7 2.7 0 1 1-2.2-2.65v-3.06a5.75 5.75 0 1 0 5.2 5.72V8.9a6.6 6.6 0 0 0 4 1.35v-3a3.65 3.65 0 0 1-3.6-3.6V2Z" />
            </svg>
        );
    }

    if (channel === 'linkedin') {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className={shared}
                aria-hidden
            >
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2.4 7.6h2.7V19H6.4V9.6Zm1.35-4.3a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM11 9.6h2.6v1.28a2.85 2.85 0 0 1 2.56-1.4c2.03 0 3.34 1.28 3.34 3.85V19h-2.7v-5.15c0-1.25-.48-1.95-1.5-1.95-1.02 0-1.6.7-1.6 1.95V19H11V9.6Z"
                />
            </svg>
        );
    }

    if (channel === 'whatsapp') {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className={shared}
                aria-hidden
            >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.22.24-.85.83-.85 2.03 0 1.2.87 2.35.99 2.51.12.17 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
            </svg>
        );
    }

    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={shared}
            aria-hidden
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM9.6 4.5A8.05 8.05 0 0 0 4.6 9h2.62c.42-1.7 1.06-3.2 1.85-4.32A8.6 8.6 0 0 0 9.6 4.5ZM12 4.2c.86 0 1.98 1.8 2.6 4.8H9.4c.62-3 1.74-4.8 2.6-4.8ZM9.06 11h5.88c.06.65.09 1.32.09 2s-.03 1.35-.09 2H9.06A20.6 20.6 0 0 1 8.97 13c0-.68.03-1.35.09-2Zm-2.01 0H4.24a8.1 8.1 0 0 0 0 4h2.81a22.7 22.7 0 0 1 0-4Zm9.9 0h2.81a8.1 8.1 0 0 1 0 4h-2.81a22.7 22.7 0 0 0 0-4Zm.83-2h2.62a8.05 8.05 0 0 0-5-4.5c.8 1.12 1.44 2.63 1.86 4.34L17.78 9ZM4.6 17h2.62c.42 1.7 1.06 3.2 1.85 4.32A8.05 8.05 0 0 1 4.6 17Zm4.8 0h5.2c-.62 3-1.74 4.8-2.6 4.8-.86 0-1.98-1.8-2.6-4.8Zm7.32 0h2.62a8.05 8.05 0 0 1-4.47 4.32c.79-1.12 1.43-2.62 1.85-4.32Z"
            />
        </svg>
    );
}
