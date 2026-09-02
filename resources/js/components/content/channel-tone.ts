import type { ChannelKey } from '@/data/dashboard';

/**
 * Each publishing channel in its own tint, so the calendar reads by
 * platform at a glance. The hues are defined once as tokens in app.css
 * (with dark-mode values) and never carry status: whether a piece is live
 * is told by its shape — a tinted bed once published, a white card with the
 * channel mark in its own ink until then — and lateness stays red.
 */
export const CHANNEL_TONE: Record<
    ChannelKey,
    { filled: string; outlined: string; text: string }
> = {
    instagram: {
        filled: 'bg-channel-instagram text-channel-instagram-foreground',
        outlined:
            'border border-channel-instagram-foreground/35 bg-card text-channel-instagram-foreground',
        text: 'text-channel-instagram-foreground',
    },
    facebook: {
        filled: 'bg-channel-facebook text-channel-facebook-foreground',
        outlined:
            'border border-channel-facebook-foreground/35 bg-card text-channel-facebook-foreground',
        text: 'text-channel-facebook-foreground',
    },
    twitter: {
        filled: 'bg-channel-twitter text-channel-twitter-foreground',
        outlined:
            'border border-channel-twitter-foreground/35 bg-card text-channel-twitter-foreground',
        text: 'text-channel-twitter-foreground',
    },
    tiktok: {
        filled: 'bg-channel-tiktok text-channel-tiktok-foreground',
        outlined:
            'border border-channel-tiktok-foreground/35 bg-card text-channel-tiktok-foreground',
        text: 'text-channel-tiktok-foreground',
    },
    linkedin: {
        filled: 'bg-channel-linkedin text-channel-linkedin-foreground',
        outlined:
            'border border-channel-linkedin-foreground/35 bg-card text-channel-linkedin-foreground',
        text: 'text-channel-linkedin-foreground',
    },
    web: {
        filled: 'bg-channel-web text-channel-web-foreground',
        outlined:
            'border border-channel-web-foreground/35 bg-card text-channel-web-foreground',
        text: 'text-channel-web-foreground',
    },
    // Not a publishing channel; kept so the map covers every key.
    whatsapp: {
        filled: 'bg-neutral-soft text-secondary-foreground',
        outlined: 'border border-border bg-card text-secondary-foreground',
        text: 'text-secondary-foreground',
    },
};
