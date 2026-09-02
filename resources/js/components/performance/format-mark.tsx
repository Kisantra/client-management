import { Clapperboard, Image, Images, Video } from 'lucide-react';
import { FORMAT_LABEL } from '@/data/instagram';
import { cn } from '@/lib/utils';

/**
 * What kind of post this is.
 *
 * A mark, not a colour: every post here is Instagram, so tinting by format
 * would spend the palette on a distinction the metrics beside it already make.
 */
const FORMAT_ICON = {
    reel: Clapperboard,
    carousel: Images,
    foto: Image,
    video: Video,
} as const;

export function FormatMark({
    format,
    slides,
    className,
}: {
    format: string;
    /** Carousels say how many frames; anything else has one. */
    slides?: number;
    className?: string;
}) {
    const Icon = FORMAT_ICON[format as keyof typeof FORMAT_ICON] ?? Image;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full bg-neutral-soft py-1 pr-2.5 pl-2 text-[0.6875rem] font-bold whitespace-nowrap text-secondary-foreground',
                className,
            )}
        >
            <Icon className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
            {FORMAT_LABEL[format] ?? format}
            {slides && slides > 1 ? (
                <span className="text-muted-foreground" data-numeric>
                    {slides}
                </span>
            ) : null}
        </span>
    );
}
