import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowUpRight, Expand, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { FormatMark } from '@/components/performance/format-mark';
import { longDate } from '@/data/instagram';
import type { PostDetail } from '@/data/instagram';
import { cn } from '@/lib/utils';

/** Safari names the fullscreen calls after itself. */
type Fullscreenable = HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitRequestFullscreen?: () => void;
};

/**
 * One video, given the room to be watched.
 *
 * A 9:16 cover in the record panel is 230 pixels across — enough to recognise
 * a post, nowhere near enough to watch one. This is the same file at the
 * height of the window, and it is a surface of ours rather than the browser's
 * own fullscreen: the way out, what you are watching, and the way to the
 * original all stay where the rest of the app puts them. The button in the
 * corner still hands it to the operating system for anyone who wants the
 * whole monitor.
 *
 * The letterbox is the cover again, blown past the edges and blurred — the
 * same move the panel makes, for the same reason. A vertical video leaves two
 * thirds of a wide screen unused, and that space should belong to the video
 * rather than sit there as a black field.
 */
export function VideoTheatre({
    post,
    open,
    onOpenChange,
    startAt = 0,
}: {
    post: PostDetail | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Where the small player had got to, so watching properly resumes it. */
    startAt?: number;
}) {
    const video = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const node = video.current;

        if (!open || !node) {
            return;
        }

        const resume = () => {
            /* Seeking a file whose length is not known yet is discarded
               silently, which is how this started every video over. */
            if (startAt > 0 && Number.isFinite(node.duration)) {
                node.currentTime = Math.min(startAt, node.duration - 0.1);
            }

            /* Opening this is the request to watch; a play the browser
               refuses is not an error worth surfacing. */
            void node.play().catch(() => undefined);
        };

        if (node.readyState >= 1) {
            resume();

            return;
        }

        node.addEventListener('loadedmetadata', resume, { once: true });

        return () => node.removeEventListener('loadedmetadata', resume);
    }, [open, startAt, post?.video]);

    if (!post?.video) {
        return null;
    }

    const fill = () => {
        const node = video.current as Fullscreenable | null;

        if (!node) {
            return;
        }

        const enter =
            node.requestFullscreen ??
            node.webkitRequestFullscreen ??
            node.webkitEnterFullscreen;

        void enter?.call(node);
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-panel/85 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

                <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col overflow-hidden outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
                    <DialogPrimitive.Title className="sr-only">
                        {post.caption ?? 'Konten tanpa keterangan'}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                        Video {longDate(post.postedAt)}, diputar dari salinan
                        yang tersimpan di aplikasi ini.
                    </DialogPrimitive.Description>

                    {/* The letterbox, made of the cover it surrounds. */}
                    {post.thumbnail ? (
                        <img
                            src={post.thumbnail}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-25 blur-3xl saturate-150"
                        />
                    ) : null}

                    <header className="flex shrink-0 items-center gap-3 p-4 sm:p-5">
                        <DialogPrimitive.Close asChild>
                            <button
                                type="button"
                                className="grid size-10 shrink-0 place-items-center rounded-md bg-card/10 text-ink-panel-foreground backdrop-blur-sm transition-colors hover:bg-card/25"
                            >
                                <X
                                    className="size-5"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                                <span className="sr-only">Tutup</span>
                            </button>
                        </DialogPrimitive.Close>

                        <p className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-ink-panel-foreground">
                            <FormatMark
                                format={post.format}
                                slides={post.slides}
                            />
                            <span
                                className="text-[0.8438rem] font-bold"
                                data-numeric
                            >
                                {longDate(post.postedAt)}
                            </span>
                        </p>

                        <div className="ml-auto flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={fill}
                                title="Layar penuh"
                                className="grid size-10 place-items-center rounded-md bg-card/10 text-ink-panel-foreground backdrop-blur-sm transition-colors hover:bg-card/25"
                            >
                                <Expand
                                    className="size-4"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                                <span className="sr-only">
                                    Buka satu layar penuh
                                </span>
                            </button>

                            <a
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden items-center gap-1.5 rounded-md bg-card/10 px-3.5 py-2.5 text-[0.8438rem] font-bold text-ink-panel-foreground backdrop-blur-sm transition-colors hover:bg-card/25 sm:inline-flex"
                            >
                                Buka di{' '}
                                {post.platform === 'tiktok'
                                    ? 'TikTok'
                                    : 'Instagram'}
                                <ArrowUpRight
                                    className="size-3.5"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            </a>
                        </div>
                    </header>

                    {/* The video takes whatever height is left, and its own
                        width from its aspect: nothing is cropped to fill a
                        shape the post was never shot in. */}
                    <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-5 sm:pb-5">
                        <video
                            ref={video}
                            key={post.video}
                            src={post.video}
                            poster={post.thumbnail ?? undefined}
                            controls
                            playsInline
                            className={cn(
                                'max-h-full w-auto max-w-full rounded-xl bg-black object-contain shadow-carry',
                            )}
                        />
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
