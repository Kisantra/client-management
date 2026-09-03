import type { ContentStatus } from '@/data/content';
import type { ChannelKey } from '@/data/dashboard';

/** The piece an idea became, enough to name it and jump to it. */
export type IdeaPiece = {
    id: number;
    title: string;
    status: ContentStatus;
    scheduledFor: string;
};

/** One entry on the idea backlog, scheduled or still waiting. */
export type ContentIdea = {
    id: number;
    title: string;
    /** A suggestion, not a commitment; null means any channel. */
    channel: ChannelKey | null;
    note: string | null;
    sourceUrl: string | null;
    author: string | null;
    /** The day it was written down: YYYY-MM-DD. */
    createdAt: string;
    /** Set once it is on the calendar. */
    content: IdeaPiece | null;
};

/** One story on the news feed, and whether it already became an idea. */
export type NewsRow = {
    id: number;
    title: string;
    /** The outlet that ran it: DDTCNews, Ortax, Kompas. */
    source: string;
    /** The pipeline's own bucket: Kebijakan, Regulasi, DJP/Operasional. */
    category: string | null;
    url: string | null;
    summary: string | null;
    publishedAt: string;
    ideaId: number | null;
};
