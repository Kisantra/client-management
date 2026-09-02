import type { ChannelKey } from '@/data/dashboard';
import { asDate } from '@/data/leads';

/**
 * The shapes the server sends for the content calendar, and the little
 * formatting every content screen shares. Late and stuck are decided by the
 * server from config/content.php; nothing here re-derives them.
 */

export type ContentStatus = 'draft' | 'review' | 'approved' | 'published';

export type ContentRow = {
    id: number;
    title: string;
    /** Every channel this piece goes out on. */
    channels: ChannelKey[];
    /** What the piece is for. Null until someone decides. */
    pillar: string | null;
    pillarLabel: string | null;
    /** The shape it takes: single photo, carousel, short video… */
    type: string;
    typeLabel: string;
    status: ContentStatus;
    statusLabel: string;
    /** The day it is meant to go live: YYYY-MM-DD. */
    scheduledFor: string;
    /** 24-hour "09:00", or null when no hour has been decided. */
    scheduledTime: string | null;
    /** The day it did, once it has. */
    publishedAt: string | null;
    owner: string | null;
    url: string | null;
    /** Past its date and still not live. */
    late: boolean;
    daysLate: number;
    daysInStatus: number;
    /** Sitting in its status longer than the flow tolerates. */
    stuck: boolean;
    stuckAfter: number | null;
    /** The chain, in two numbers, when the query counted them. */
    leads: number | null;
    clients: number | null;
};

export type ContentDetail = ContentRow & {
    brief: string | null;
    /** Where the material came from — a regulation, an article. */
    referenceUrl: string | null;
    /** The copy itself, as it will be posted. */
    caption: string | null;
    externalId: string | null;
};

/** The shape the edit form starts from. */
export type EditableContent = {
    id: number;
    title: string;
    channels: ChannelKey[];
    pillar: string | null;
    type: string;
    status: ContentStatus;
    scheduledFor: string;
    scheduledTime: string | null;
    publishedAt: string | null;
    owner: string | null;
    brief: string | null;
    referenceUrl: string | null;
    caption: string | null;
    url: string | null;
};

export type ContentEvent = {
    id: number;
    status: ContentStatus;
    label: string;
    author: string | null;
    note: string | null;
    at: string;
};

/** One month of the calendar, with the keys to move around it. */
export type ContentMonth = {
    key: string;
    label: string;
    start: string;
    end: string;
    prev: string;
    next: string;
    /** This month's key, to know when "Bulan ini" is already showing. */
    current: string;
    today: string;
};

export type StatusCount = {
    key: ContentStatus;
    label: string;
    hint: string;
    count: number;
};

export const STATUS_ORDER: ContentStatus[] = [
    'draft',
    'review',
    'approved',
    'published',
];

const dayFormat = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
});

const shortDayFormat = new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
});

/** "Senin, 4 Agu": how the agenda names a day. */
export function dayLabel(iso: string): string {
    return dayFormat.format(asDate(iso));
}

/** "Sen, 4 Agu": the same, where there is less room. */
export function shortDayLabel(iso: string): string {
    return shortDayFormat.format(asDate(iso));
}

/** Dates travel as plain calendar days; the server never sees a timezone. */
/** The hour as the team writes it: 09.00. */
export function timeLabel(time: string | null): string | null {
    return time ? time.replace(':', '.') : null;
}

export function toIso(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}
