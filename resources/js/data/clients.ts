import type { ChannelKey } from '@/data/dashboard';
import type { Lead } from '@/data/leads';

/**
 * A client is a lead standing in the last stage. The row keeps every lead
 * fact and adds the handful that only mean something once the work has begun.
 */
export type Client = Lead & {
    owner: string | null;
    city: string | null;
    /** The day it became a client, as sent: YYYY-MM-DD. */
    since: string;
    /** Days from the first enquiry to becoming a client. */
    daysToConvert: number;
    /** True once nobody has spoken to the client for longer than the stage allows. */
    needsContact: boolean;
};

export type ClientSummary = {
    count: number;
    value: number;
    average: number;
    newThisMonth: number;
    newLastMonth: number;
    /** Last month's short name, e.g. "Jul". */
    lastMonth: string;
    medianDays: number | null;
    fastestDays: number | null;
    needsContact: number;
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
