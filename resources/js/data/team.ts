/** One person on the roster: an account, a PJ from the calendar, or both. */
export type TeamMember = {
    name: string;
    /** Null when the name only exists as a PJ on content. */
    userId: number | null;
    isYou: boolean;
    email: string | null;
    role: string | null;
    /** ISO date the account was made; null without an account. */
    joinedAt: string | null;
    draft: number;
    review: number;
    approved: number;
    /** Everything not yet live: draft + review + approved. */
    active: number;
    /** Past its date and still not live. */
    late: number;
    /** Scheduled inside the running week, whatever the status. */
    week: number;
    publishedMonth: number;
};

export type TeamTotals = {
    members: number;
    accounts: number;
    active: number;
    late: number;
    week: number;
    publishedMonth: number;
    /** Active pieces with no PJ at all. */
    unassigned: number;
};

export type TeamWeek = {
    start: string;
    end: string;
    /** Ready to print: "1–7 Sep" or "31 Agu – 6 Sep". */
    label: string;
};

/**
 * The workload bar's segments, in flow order, wearing the same colours the
 * status dots wear everywhere else (see STATUS_DOT): draft quiet, review
 * slate, approved bright teal. Published is done, so it never takes space.
 */
export const LOAD_SEGMENTS = [
    { key: 'draft', className: 'bg-chart-4' },
    { key: 'review', className: 'bg-info' },
    { key: 'approved', className: 'bg-primary-bright' },
] as const;
