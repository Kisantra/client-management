/**
 * What the Instagram surfaces share: the shapes the server sends, and the
 * formatting both pages must agree on. A figure that reads one way on the
 * statistics page and another on the content list is two different figures.
 */

export type InstagramAccount = {
    username: string;
    name: string | null;
    biography: string | null;
    url: string;
    externalUrl: string | null;
    avatar: string | null;
    verified: boolean;
    business: boolean;
    fetchedAt: string | null;
};

export type PostFormat = 'reel' | 'carousel' | 'foto' | 'video';

/** The row shape every list and card reads. */
export type PostCard = {
    shortCode: string;
    caption: string | null;
    url: string;
    thumbnail: string | null;
    format: string;
    likes: number;
    comments: number;
    views: number | null;
    plays: number | null;
    /* TikTok reports these two; Instagram's public scrape does not. */
    shares: number | null;
    saves: number | null;
    interactions: number;
    postedAt: string;
    pinned: boolean;
};

/** Which account a figure came from. */
export type PlatformKey = 'instagram' | 'tiktok';

export type Platform = { key: PlatformKey; label: string };

export type PostRow = PostCard & {
    /** Interactions against the followers on record, as a percentage. */
    rate: number;
    slides: number;
    hashtags: string[];
};

/** Everything on record for one post, as the detail panel shows it. */
export type PostDetail = PostCard & {
    /** Which account it came from, so the panel names the right way out. */
    platform: PlatformKey;
    /** What its rate was divided by, and the word for it. */
    rateBasis: number;
    rateNoun: string;
    /** This app's own copy of the file, once somebody has kept it. */
    video: string | null;
    /** Whether a copy could still be made from the platform's own link. */
    videoAvailable: boolean;
    rate: number;
    /** What a post on this account usually earns, for the rate to be read against. */
    typicalRate: number;
    slides: number;
    duration: number | null;
    width: number | null;
    height: number | null;
    aspect: string;
    alt: string | null;
    hashtags: string[];
    mentions: string[];
    taggedUsers: string[];
    location: string | null;
    music: { song: string | null; artist: string | null } | null;
    firstComment: string | null;
    paidPartnership: boolean;
    commentsDisabled: boolean;
    fetchedAt: string | null;
};

/** How the team names each kind of post. */
/** Every shape a post comes in, on either account. */
export const FORMAT_LABEL: Record<string, string> = {
    reel: 'Reel',
    carousel: 'Carousel',
    foto: 'Foto',
    video: 'Video',
    /* TikTok's carousel: photos, no duration. */
    slideshow: 'Slideshow',
};

export const nf = new Intl.NumberFormat('id-ID');
export const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
export const rateFormat = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** A signed change reads as a change; an unsigned one reads as a total. */
export function signed(value: number): string {
    return value > 0 ? `+${nf.format(value)}` : nf.format(value);
}

const shortFormat = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
});

const longFormat = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

/** Server dates arrive as YYYY-MM-DD; parsed as local, never shifted a day. */
function asDate(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);

    return new Date(year, month - 1, day);
}

export function shortDate(iso: string): string {
    return shortFormat.format(asDate(iso));
}

export function longDate(iso: string): string {
    return longFormat.format(asDate(iso));
}

/** A Reel's length, in the unit anyone editing one thinks in. */
export function duration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;

    return minutes > 0 ? `${minutes} menit ${rest} detik` : `${rest} detik`;
}

/** How long ago the numbers were read, in the roughest useful unit. */
export function sinceLabel(iso: string): string {
    const minutes = Math.max(
        Math.round((Date.now() - new Date(iso).getTime()) / 60000),
        0,
    );

    if (minutes < 1) {
        return 'baru saja';
    }

    if (minutes < 60) {
        return `${minutes} menit lalu`;
    }

    const hours = Math.round(minutes / 60);

    if (hours < 24) {
        return `${hours} jam lalu`;
    }

    return `${Math.round(hours / 24)} hari lalu`;
}
