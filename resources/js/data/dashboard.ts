/**
 * Static sample data for the modules that do not exist yet.
 *
 * Leads are real now — everything about them comes from the server. What is
 * left here belongs to the content, task and team modules, which have no
 * database behind them yet; every panel that reads it says so on screen.
 */

export type ChannelKey =
    | 'instagram'
    | 'facebook'
    | 'twitter'
    | 'tiktok'
    | 'linkedin'
    | 'web'
    | 'whatsapp';

export type TaskState = 'running' | 'late' | 'waiting' | 'done';

export type Task = {
    id: number;
    title: string;
    channel: ChannelKey;
    owner: string;
    initials: string;
    /** Scheduled clock time. Always present: the day reads as a schedule. */
    time: string;
    state: TaskState;
    /** Only when late: how many days past the due date. */
    lateDays?: number;
    /** Only when late: the stage it is stuck in. */
    stuckAt?: string;
};

export type Channel = {
    key: ChannelKey;
    label: string;
    published: number;
    leads: number;
};

export type TeamMember = {
    name: string;
    initials: string;
    assigned: number;
    capacity: number;
};

export const CHANNEL_LABELS: Record<ChannelKey, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'Twitter',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
    web: 'Web/SEO',
    whatsapp: 'WhatsApp',
};

export const todayTasks: Task[] = [
    {
        id: 1,
        title: 'Batas Lapor SPT Badan — carousel',
        channel: 'instagram',
        owner: 'Dimas',
        initials: 'DM',
        time: '09.00',
        state: 'running',
    },
    {
        id: 2,
        title: '5 Kesalahan Pembukuan UMKM',
        channel: 'tiktok',
        owner: 'Sari',
        initials: 'SR',
        time: '11.30',
        state: 'late',
        lateDays: 2,
        stuckAt: 'Review',
    },
    {
        id: 3,
        title: 'PPh 21 karyawan — contoh hitung',
        channel: 'linkedin',
        owner: 'Rina',
        initials: 'RA',
        time: '13.00',
        state: 'waiting',
    },
    {
        id: 4,
        title: 'Insentif pajak 2026 — artikel',
        channel: 'web',
        owner: 'Bayu',
        initials: 'BY',
        time: '15.00',
        state: 'late',
        lateDays: 1,
        stuckAt: 'Tayang',
    },
    {
        id: 5,
        title: 'Follow-up proposal PT Sinar Rejeki',
        channel: 'linkedin',
        owner: 'Putri',
        initials: 'PT',
        time: '16.00',
        state: 'waiting',
    },
    {
        id: 6,
        title: 'Checklist audit internal — script',
        channel: 'tiktok',
        owner: 'Dimas',
        initials: 'DM',
        time: '17.00',
        state: 'done',
    },
    {
        id: 7,
        title: 'Rekap performa mingguan',
        channel: 'web',
        owner: 'Rina',
        initials: 'RA',
        time: '17.30',
        state: 'done',
    },
];

export const channels: Channel[] = [
    { key: 'instagram', label: 'Instagram', published: 11, leads: 34 },
    { key: 'web', label: 'Web/SEO', published: 6, leads: 29 },
    { key: 'linkedin', label: 'LinkedIn', published: 7, leads: 18 },
    { key: 'tiktok', label: 'TikTok', published: 3, leads: 5 },
];

export const team: TeamMember[] = [
    { name: 'Dimas', initials: 'DM', assigned: 9, capacity: 8 },
    { name: 'Sari', initials: 'SR', assigned: 7, capacity: 8 },
    { name: 'Putri', initials: 'PT', assigned: 6, capacity: 8 },
    { name: 'Bayu', initials: 'BY', assigned: 4, capacity: 8 },
    { name: 'Andre', initials: 'AR', assigned: 3, capacity: 8 },
];

/** Leads, clients and content come from the server; these two have no module yet. */
export const navCounts = {
    tasks: 12,
};
