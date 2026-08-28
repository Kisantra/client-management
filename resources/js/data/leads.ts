import type { ChannelKey } from '@/data/dashboard';

/**
 * The shapes the server sends, and the formatting every lead screen shares.
 *
 * Nothing is generated here any more: days in stage, days since contact and
 * whether a lead is stalled are all computed by the server from
 * config/pipeline.php, so the table, the board and the dashboard cannot
 * disagree about the same lead.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The session's "today", fixed once at module load.
 *
 * Reading the clock during render makes a component non-idempotent — the same
 * props could render differently on a re-render — so every date derived in the
 * browser comes from this single value. It only bounds date pickers; every
 * figure on screen is dated by the server.
 */
export const TODAY = (() => {
    const now = new Date();

    now.setHours(0, 0, 0, 0);

    return now;
})();

export function daysAgoDate(days: number): Date {
    return new Date(TODAY.getTime() - days * DAY_MS);
}

export type Lead = {
    id: number;
    /** Full display name, entity included: "PT Sinar Rejeki". */
    company: string;
    pic: string;
    stage: string;
    channel: ChannelKey;
    /** The content the lead came in from — the chain this product exists for. */
    source: string;
    service: string;
    /** Estimated engagement value, in rupiah. */
    value: number;
    daysInStage: number;
    daysSinceContact: number;
    /** How long ago the lead first came in. Never less than its time in stage. */
    daysSinceEntry: number;
    /** The calendar date it came in, as sent: YYYY-MM-DD. */
    entryAt: string;
    /** The tolerance of the stage it is in, in days. */
    threshold: number;
    stalled: boolean;
    /** 'aktif' while it is still being worked, 'tidak_lanjut' once it stops. */
    status: string;
    /** Set only when it stopped: why, and when. */
    closedReason: string | null;
    closedAt: string | null;
};

/** A lead with everything the detail page shows. */
export type LeadDetail = Lead & {
    entity: string;
    /** The name without its entity prefix, for the edit form. */
    name: string;
    picRole: string | null;
    phone: string | null;
    email: string | null;
    npwp: string | null;
    address: string | null;
    city: string | null;
    owner: string | null;
    office: { lat: number; lng: number } | null;
    closedNote: string | null;
};

export type StageStep = {
    key: string;
    label: string;
    enteredAt: string;
    days: number;
    current: boolean;
};

export type NoteFile = {
    id: number;
    name: string;
    url: string;
    size: number;
};

export type LeadNote = {
    id: number;
    author: string;
    at: string;
    body: string;
    files: NoteFile[];
};

export type FollowUp = {
    id: number;
    at: string;
    via: string;
    note: string;
    done: boolean;
};

export const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

/** Compact rupiah for dense columns: "Rp 42 jt". */
export function shortRupiah(value: number): string {
    if (value >= 1_000_000_000) {
        return `Rp ${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} m`;
    }

    return `Rp ${Math.round(value / 1_000_000).toLocaleString('id-ID')} jt`;
}

const entryFormat = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
});
const entryFormatWithYear = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});
const longFormat = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

/** Server dates arrive as YYYY-MM-DD; parsed as local, never shifted a day. */
export function asDate(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);

    return new Date(year, month - 1, day);
}

/** The calendar date a lead came in. The year appears once it stops being obvious. */
export function entryDate(iso: string): string {
    const date = asDate(iso);

    return date.getFullYear() === TODAY.getFullYear()
        ? entryFormat.format(date)
        : entryFormatWithYear.format(date);
}

export function longDate(iso: string): string {
    return longFormat.format(asDate(iso));
}

export function relativeDays(days: number): string {
    if (days <= 0) {
        return 'hari ini';
    }

    if (days === 1) {
        return 'kemarin';
    }

    return `${days} hari lalu`;
}
