import type { ChannelKey } from '@/data/dashboard';
import type { Contract, Lead } from '@/data/leads';

/**
 * A client is a lead that has been signed: either already running, or dealt
 * and not started yet. The row keeps every lead fact and adds the handful that
 * only mean something once the money is committed.
 */
export type Client = Lead & {
    owner: string | null;
    city: string | null;
    /** Which of the two this is: 'deal' or 'client'. */
    stage: 'deal' | 'client';
    stageLabel: string;
    /** The day it reached that stage, as sent: YYYY-MM-DD. */
    since: string;
    /** Days from the first enquiry to becoming a client; null for a deal. */
    daysToConvert: number | null;
    /** Null for a client engaged on the spot. */
    contract: Contract | null;
    /** Why it cannot be picked for deletion; null when it can. */
    locked: string | null;
};

export type ClientSummary = {
    /** Everything on the page: signed deals and running clients together. */
    count: number;
    /** The part actually running. A deal is signed, not yet active. */
    activeCount: number;
    dealCount: number;
    /** How many of them converted — the only ones the median may count. */
    convertedCount: number;
    value: number;
    average: number;
    newThisMonth: number;
    newLastMonth: number;
    /** Last month's short name, e.g. "Jul". */
    lastMonth: string;
    medianDays: number | null;
    fastestDays: number | null;
    /** Clients on a term, and the rest, engaged on the spot. */
    contracted: number;
    onSpot: number;
    /** Terms ending within the page's warning window, and those already past. */
    endingSoon: number;
    expired: number;
};

/** One bar in a rail: how many clients a channel or a person accounts for. */
export type Share = {
    key: string;
    label: string;
    count: number;
    value: number;
};

/** A piece of content and the clients it ended in. */
export type ContentShare = {
    channel: ChannelKey;
    source: string;
    count: number;
    value: number;
};
