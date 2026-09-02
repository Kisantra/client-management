import type { Auth } from './auth';

export type StageRequirement = {
    label: string;
    hint: string;
};

export type PipelineStage = {
    key: string;
    label: string;
    /** How long a lead may sit in this stage before it counts as mandek. */
    stalledAfterDays: number;
};

/**
 * The pipeline as the server defines it.
 *
 * Shared on every page so no screen keeps its own copy of the stages, their
 * tolerances, or which of them cannot be entered without a document.
 */
export type SharedPipeline = {
    stages: PipelineStage[];
    requirements: Record<string, StageRequirement | undefined>;
    channels: Record<string, string>;
    followUpVia: string[];
    services: string[];
    /** Why a lead stops, keyed by the value stored on the record. */
    closeReasons: Record<string, { label: string; hint: string }>;
};

export type ContentStatusDef = {
    key: string;
    label: string;
    hint: string;
};

/**
 * config/content.php as the server shares it, so no screen keeps its own
 * copy of which channels publish, what they carry, or the statuses.
 */
export type SharedContent = {
    /** Key to label, in the order the form should offer them. */
    channels: Record<string, string>;
    pillars: Record<string, string>;
    types: Record<string, string>;
    statuses: ContentStatusDef[];
    stuckAfterDays: Record<string, number>;
};

export type SharedProps = {
    name: string;
    auth: Auth;
    sidebarOpen: boolean;
    pipeline: SharedPipeline;
    contentPlan: SharedContent;
    counts: { leads: number; clients: number; content: number } | null;
    [key: string]: unknown;
};
