import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { CHANNEL_LABELS } from '@/data/dashboard';
import type { ChannelKey } from '@/data/dashboard';
import { cn } from '@/lib/utils';

/**
 * The channels one piece goes out on, as marks.
 *
 * A piece is now written once and posted to several places, so the channel is
 * a set rather than a value. In the calendar cell and the agenda row there is
 * no room for the words, and no need for them: the marks are already the
 * shortest unambiguous form of Instagram, Facebook and the rest. The words
 * come back in the panel, where there is room to say them.
 *
 * `tinted` gives each mark its own channel's ink, for use on a neutral card.
 * On a card that already carries a channel's tint the marks take the card's
 * own foreground instead, so nothing fights the bed it sits on.
 */
export function ChannelMarks({
    channels,
    tinted = true,
    className,
    max = 3,
}: {
    channels: ChannelKey[];
    tinted?: boolean;
    className?: string;
    max?: number;
}) {
    const shown = channels.slice(0, max);
    const rest = channels.length - shown.length;

    return (
        <>
            {shown.map((channel) => (
                <ChannelIcon
                    key={channel}
                    channel={channel}
                    className={cn(
                        'size-3 shrink-0',
                        tinted && CHANNEL_TONE[channel].text,
                        className,
                    )}
                />
            ))}
            {rest > 0 ? (
                <span
                    className="shrink-0 text-[0.625rem] font-extrabold"
                    data-numeric
                >
                    +{rest}
                </span>
            ) : null}
        </>
    );
}

/** The set said in words: "Instagram" alone, "Instagram, TikTok" together. */
export function channelNames(channels: ChannelKey[]): string {
    return channels.map((channel) => CHANNEL_LABELS[channel]).join(', ');
}
