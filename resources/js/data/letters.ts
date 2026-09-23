/**
 * The shapes the server sends for letters, and the little formatting the
 * letter screens share. Everything about a letter's words is rendered on the
 * server, so nothing here composes prose; it only names what arrives.
 */

export type LetterStatus = 'draft' | 'terbit' | 'batal';

export type LetterRow = {
    id: number;
    number: string | null;
    subject: string;
    template: string;
    client: string;
    leadId: number;
    /** YYYY-MM-DD. */
    date: string;
    status: LetterStatus;
    statusLabel: string;
    author: string | null;
    issuedAt: string | null;
};

/** One priced line in a fee table. */
export type ItemRow = {
    name: string;
    amount: number;
};

/** One lettered section of a fee table: "A.) Pendampingan SP2DK" and its rows. */
export type ItemSection = {
    title: string;
    rows: ItemRow[];
};

export type FieldType =
    'text' | 'textarea' | 'list' | 'select' | 'date' | 'items';

/** A blank in a template, as the template defines it. */
export type LetterField = {
    key: string;
    label: string;
    type: FieldType;
    required: boolean;
    placeholder: string | null;
    help: string | null;
    options: Record<string, string>;
    default: unknown;
    style: 'bullet' | 'number';
    note_key: string | null;
};

export type FieldValue = string | ItemSection[] | null;

export type LetterValues = Record<string, FieldValue>;

export type LetterDetail = {
    id: number;
    number: string | null;
    status: LetterStatus;
    statusLabel: string;
    subject: string;
    recipient: string;
    date: string;
    signerName: string;
    signerTitle: string;
    values: LetterValues;
    issuedAt: string | null;
    author: string | null;
    canDelete: boolean;
    template: { id: number; name: string };
    client: { id: number; name: string; pic: string };
};

/** The rendered page and its stylesheet, straight from the server. */
export type Preview = {
    html: string;
    css: string;
};

export type TemplateOption = {
    id: number;
    name: string;
    description: string | null;
    prefix: string;
    subject: string;
};

export type LeadOption = {
    id: number;
    name: string;
    pic: string;
    service: string;
    stage: string;
};

export type TemplateSummary = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    prefix: string;
    subject: string;
    active: boolean;
    letters: number;
    fields: number;
};

export type TemplateDetail = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    prefix: string;
    subject: string;
    recipient: string;
    /** The pipeline stage a lead moves to when a letter of this kind is issued, or null. */
    stageOnIssue: string | null;
    body: string;
    active: boolean;
    fields: LetterField[];
    hasDefault: boolean;
    letters: number;
};

export type PlaceholderReference = {
    builtin: { key: string; help: string }[];
    fields: { key: string; help: string }[];
};

/** "10000000" → "10.000.000", the way a rupiah figure is typed here. */
export function thousands(digits: string | number): string {
    return String(digits)
        .replace(/\D/g, '')
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "10.000.000" → 10000000. Anything that is not a digit is ignored. */
export function digits(value: string): number {
    return Number(value.replace(/\D/g, '') || 0);
}

/** The sum of every priced row in every section. */
export function sumSections(sections: ItemSection[]): number {
    return sections.reduce(
        (total, section) =>
            total +
            section.rows.reduce(
                (sum, row) => sum + (row.name.trim() ? row.amount : 0),
                0,
            ),
        0,
    );
}

/** The pill tone for each status: teal for what stands, ink for what stopped. */
export const STATUS_TONE: Record<LetterStatus, string> = {
    draft: 'bg-neutral-soft text-secondary-foreground',
    terbit: 'bg-primary-soft text-primary-deep',
    batal: 'bg-ink-panel text-white',
};
