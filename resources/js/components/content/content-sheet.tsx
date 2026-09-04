import { Link, router } from '@inertiajs/react';
import {
    BookMarked,
    CalendarDays,
    Check,
    ChevronRight,
    ExternalLink,
    Layers,
    Link2,
    Loader,
    Pencil,
    Shapes,
    Tag,
    Target,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { channelNames } from '@/components/content/channel-marks';
import { CHANNEL_TONE } from '@/components/content/channel-tone';
import { CommentThread } from '@/components/content/comment-thread';
import { ContentForm } from '@/components/content/content-form';
import { DeleteDialog } from '@/components/content/delete-dialog';
import { PublishDialog } from '@/components/content/publish-dialog';
import {
    LateMark,
    STATUS_DOT,
    StatusPill,
} from '@/components/content/status-mark';
import { ChannelIcon } from '@/components/leads/channel-icon';
import { StageMark } from '@/components/leads/stage-mark';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import type {
    ContentComment,
    ContentDetail,
    ContentEvent,
    ContentStatus,
} from '@/data/content';
import { timeLabel } from '@/data/content';
import { CHANNEL_LABELS } from '@/data/dashboard';
import type { Lead } from '@/data/leads';
import { entryDate, longDate, shortRupiah } from '@/data/leads';
import { useContentPlan } from '@/hooks/use-content-plan';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { leads as leadsIndex } from '@/routes';
import { store as moveStatus } from '@/routes/content/status';
import { show as leadShow } from '@/routes/leads';

/** Everything the panel shows for one piece, as the server sends it. */
export type SelectedContent = {
    content: ContentDetail;
    events: ContentEvent[];
    /** The newest leads it brought in; the count on `content` has them all. */
    leads: Lead[];
    /** Reviewer notes, newest first; the open ones are the work. */
    comments: ContentComment[];
};

type Tab = 'riwayat' | 'komentar' | 'lead';

/**
 * A piece's record, as a card floated in from the right over the calendar
 * it was picked from. The month stays put underneath, lightly dimmed, so
 * reading three pieces in a row is three clicks and no scrolling back.
 *
 * Changing a piece happens here too, in place: the record's own card turns
 * into the form for it and back again. A second window over this one would
 * have covered the very thing being changed.
 */
export function ContentSheet({
    selected,
    open,
    onClose,
    startInEdit = false,
    onStopEditing,
}: {
    selected: SelectedContent | null;
    open: boolean;
    onClose: () => void;
    /** True when the URL asked for this piece's form, not just its record. */
    startInEdit?: boolean;
    /** Told when the form closes, so the URL that asked for it can be tidied. */
    onStopEditing?: () => void;
}) {
    /* The last piece stays on screen while the panel slides out, instead of
       the panel emptying a beat before it leaves. Derived during render, the
       way React asks for state that follows a prop. */
    const [last, setLast] = useState<SelectedContent | null>(selected);

    if (selected && selected !== last) {
        setLast(selected);
    }

    const shown = selected ?? last;

    /* Which of its two states the card is in. Opening a different piece
       always lands on its record: an edit begun on one piece must never
       carry over to the next. */
    const [editing, setEditing] = useState(startInEdit);
    const [editingId, setEditingId] = useState(shown?.content.id ?? null);

    if (shown && shown.content.id !== editingId) {
        setEditingId(shown.content.id);
        setEditing(startInEdit);
    }

    const stopEditing = () => {
        setEditing(false);
        onStopEditing?.();
    };

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    return;
                }

                /* Escape backs out of the form first and the panel second, so
                   a half-written change is never one keystroke from gone. */
                if (editing) {
                    stopEditing();

                    return;
                }

                onClose();
            }}
        >
            <SheetContent
                side="right"
                showClose={false}
                className="inset-y-3 right-3 h-auto w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-xl border-border p-0 shadow-carry sm:inset-y-4 sm:right-4 sm:w-[36rem] sm:max-w-[36rem]"
            >
                {shown ? (
                    editing ? (
                        <>
                            {/* The panel is a dialog; it owes a title even when
                                the form is the thing being shown. */}
                            <SheetTitle className="sr-only">
                                Ubah {shown.content.title}
                            </SheetTitle>
                            <SheetDescription className="sr-only">
                                Mengubah rincian konten. Perubahan status dari
                                sini tercatat di riwayatnya.
                            </SheetDescription>
                            <ContentForm
                                key={`edit-${shown.content.id}`}
                                content={shown.content}
                                variant="panel"
                                onCancel={stopEditing}
                                onSaved={stopEditing}
                            />
                        </>
                    ) : (
                        <Body
                            key={shown.content.id}
                            selected={shown}
                            onEdit={() => setEditing(true)}
                        />
                    )
                ) : null}
            </SheetContent>
        </Sheet>
    );
}

function Body({
    selected,
    onEdit,
}: {
    selected: SelectedContent;
    /** Turns this card into the form for the piece it is showing. */
    onEdit: () => void;
}) {
    const { content, events, leads, comments } = selected;
    const { statuses } = useContentPlan();
    const initials = useInitials();

    /* Reviewer feedback outranks history: a panel opened while notes are
       still open lands on them. */
    const openComments = comments.filter((comment) => !comment.resolved).length;

    const [tab, setTab] = useState<Tab>(
        openComments > 0 ? 'komentar' : 'riwayat',
    );
    const [publishOpen, setPublishOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [moving, setMoving] = useState(false);

    const move = (status: ContentStatus) => {
        if (status === 'published') {
            setPublishOpen(true);

            return;
        }

        router.post(
            moveStatus(content.id).url,
            { status },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setMoving(true),
                onFinish: () => setMoving(false),
            },
        );
    };

    const leadCount = content.leads ?? leads.length;
    const clientCount = content.clients ?? 0;

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Toolbar: the way out on the left, what can be done on the right. */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
                <SheetClose asChild>
                    <button
                        type="button"
                        className="grid size-9 place-items-center rounded-md text-secondary-foreground transition-colors hover:bg-neutral-soft hover:text-foreground"
                    >
                        <X className="size-4" strokeWidth={2.5} aria-hidden />
                        <span className="sr-only">Tutup</span>
                    </button>
                </SheetClose>

                <div className="ml-auto flex items-center gap-1.5">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="shadow-teal" disabled={moving}>
                                {moving ? 'Memindahkan…' : 'Ubah status'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuLabel className="text-xs">
                                Pindah ke status
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {statuses.map((status) => {
                                const key = status.key as ContentStatus;
                                const current = key === content.status;

                                return (
                                    <DropdownMenuItem
                                        key={key}
                                        disabled={current}
                                        className="gap-2"
                                        onSelect={() => move(key)}
                                    >
                                        <span
                                            className={cn(
                                                'size-2 shrink-0 rounded-full',
                                                STATUS_DOT[key],
                                            )}
                                            aria-hidden
                                        />
                                        {status.label}
                                        {current ? (
                                            <Check
                                                className="ml-auto size-3.5"
                                                strokeWidth={2.5}
                                                aria-hidden
                                            />
                                        ) : null}
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="outline"
                        size="icon"
                        title="Ubah konten"
                        onClick={onEdit}
                    >
                        <Pencil
                            className="size-4"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <span className="sr-only">Ubah konten</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="icon"
                        title="Hapus konten"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2
                            className="size-4"
                            strokeWidth={2}
                            aria-hidden
                        />
                        <span className="sr-only">Hapus konten</span>
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="px-5 pt-6 sm:px-7">
                    <SheetTitle className="text-2xl leading-tight font-extrabold tracking-[-0.02em] break-words">
                        {content.title}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        {channelNames(content.channels)} · {content.typeLabel}
                    </SheetDescription>

                    {/* The record, one fact per line: where it stands, when, who. */}
                    <dl className="mt-6 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 text-[0.8438rem] sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                        <Prop icon={Loader} label="Status">
                            <span className="flex flex-wrap items-center gap-2">
                                <StatusPill status={content.status} />
                                {content.late ? (
                                    <LateMark days={content.daysLate} />
                                ) : content.stuck ? (
                                    <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-[0.6875rem] font-extrabold text-destructive">
                                        Tertahan {content.daysInStatus} hari
                                    </span>
                                ) : (
                                    <span
                                        className="text-xs font-normal text-muted-foreground"
                                        data-numeric
                                    >
                                        {content.daysInStatus} hari
                                        {content.stuckAfter !== null
                                            ? ` dari batas ${content.stuckAfter}`
                                            : ''}
                                    </span>
                                )}
                            </span>
                        </Prop>

                        <Prop icon={CalendarDays} label="Jadwal tayang">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span data-numeric>
                                    {longDate(content.scheduledFor)}
                                    {content.scheduledTime
                                        ? `, ${timeLabel(content.scheduledTime)}`
                                        : ''}
                                </span>
                                {content.publishedAt &&
                                content.publishedAt !== content.scheduledFor ? (
                                    <span
                                        className="text-xs font-normal text-muted-foreground"
                                        data-numeric
                                    >
                                        tayang {longDate(content.publishedAt)}
                                    </span>
                                ) : content.publishedAt ? (
                                    <span className="text-xs font-normal text-muted-foreground">
                                        tayang tepat waktu
                                    </span>
                                ) : null}
                            </span>
                        </Prop>

                        {/* Here there is room for the words, so every channel
                            is named rather than left as a mark. */}
                        <Prop icon={Layers} label="Channel">
                            <span className="flex flex-wrap items-center gap-1.5">
                                {content.channels.map((channel) => (
                                    <span
                                        key={channel}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs font-bold',
                                            CHANNEL_TONE[channel].filled,
                                        )}
                                    >
                                        <ChannelIcon channel={channel} />
                                        {CHANNEL_LABELS[channel]}
                                    </span>
                                ))}
                            </span>
                        </Prop>

                        <Prop icon={Shapes} label="Jenis konten">
                            <span className="rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
                                {content.typeLabel}
                            </span>
                        </Prop>

                        <Prop icon={Tag} label="Pillar">
                            {content.pillarLabel ? (
                                <span className="rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
                                    {content.pillarLabel}
                                </span>
                            ) : (
                                <span className="font-normal text-muted-foreground">
                                    Belum ditentukan
                                </span>
                            )}
                        </Prop>

                        <Prop icon={UserRound} label="Submitted by">
                            {content.owner ? (
                                <span className="inline-flex items-center gap-2">
                                    <span
                                        className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.6875rem] font-extrabold text-primary-deep"
                                        aria-hidden
                                    >
                                        {initials(content.owner)}
                                    </span>
                                    {content.owner}
                                </span>
                            ) : (
                                <span className="font-normal text-muted-foreground">
                                    Belum ditentukan
                                </span>
                            )}
                        </Prop>

                        <Prop icon={Target} label="Hasil">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="font-normal" data-numeric>
                                    <span className="font-bold">
                                        {leadCount}
                                    </span>{' '}
                                    lead masuk ·{' '}
                                    <span className="font-bold">
                                        {clientCount}
                                    </span>{' '}
                                    jadi client
                                </span>
                                {leadCount > 0 ? (
                                    <Link
                                        href={leadsIndex({
                                            query: {
                                                q: content.title,
                                                tampil: 'semua',
                                            },
                                        })}
                                        className="inline-flex items-center gap-0.5 text-xs font-bold text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                                    >
                                        Lihat di daftar lead
                                        <ChevronRight
                                            className="size-3"
                                            strokeWidth={2.5}
                                            aria-hidden
                                        />
                                    </Link>
                                ) : null}
                            </span>
                        </Prop>

                        <Prop icon={BookMarked} label="Referensi">
                            {content.referenceUrl ? (
                                <a
                                    href={content.referenceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                                >
                                    <span className="truncate">
                                        {content.referenceUrl.replace(
                                            /^https?:\/\/(www\.)?/,
                                            '',
                                        )}
                                    </span>
                                    <ExternalLink
                                        className="size-3 shrink-0"
                                        strokeWidth={2}
                                        aria-hidden
                                    />
                                </a>
                            ) : (
                                <span className="font-normal text-muted-foreground">
                                    Belum ada
                                </span>
                            )}
                        </Prop>

                        <Prop icon={Link2} label="Tautan">
                            {content.url ? (
                                <a
                                    href={content.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                                >
                                    <span className="truncate">
                                        {content.url.replace(
                                            /^https?:\/\/(www\.)?/,
                                            '',
                                        )}
                                    </span>
                                    <ExternalLink
                                        className="size-3 shrink-0"
                                        strokeWidth={2}
                                        aria-hidden
                                    />
                                </a>
                            ) : (
                                <span className="font-normal text-muted-foreground">
                                    Belum ada
                                </span>
                            )}
                        </Prop>
                    </dl>

                    {/* The copy as it will be posted, kept apart from the
                        brief that asked for it: one is the instruction, the
                        other is the thing itself, and reading them as one
                        block is how an instruction ends up in a caption. */}
                    {content.caption ? (
                        <div className="mt-6 rounded-lg border border-border px-4 py-3.5">
                            <h3 className="text-[0.8438rem] font-bold">
                                Text copy
                            </h3>
                            <p className="mt-1.5 text-[0.8438rem] leading-relaxed whitespace-pre-line text-secondary-foreground">
                                {content.caption}
                            </p>
                        </div>
                    ) : null}

                    {/* The brief, on a bed of its own: the one block of prose. */}
                    <div className="mt-4 rounded-lg bg-neutral-soft/70 px-4 py-3.5">
                        <h3 className="text-[0.8438rem] font-bold">Brief</h3>
                        {content.brief ? (
                            <p className="mt-1.5 text-[0.8438rem] leading-relaxed whitespace-pre-line text-secondary-foreground">
                                {content.brief}
                            </p>
                        ) : (
                            <p className="mt-1.5 text-[0.8438rem] leading-relaxed text-muted-foreground">
                                Belum ada brief.{' '}
                                <button
                                    type="button"
                                    onClick={onEdit}
                                    className="font-bold text-primary-deep underline underline-offset-4"
                                >
                                    Tulis sekarang
                                </button>
                            </p>
                        )}
                    </div>
                </div>

                {/* Two threads under the record: how it moved, and what it brought in. */}
                <div
                    role="tablist"
                    aria-label="Bagian"
                    className="mt-6 flex gap-5 border-b border-border px-5 sm:px-7"
                >
                    <TabButton
                        active={tab === 'riwayat'}
                        onClick={() => setTab('riwayat')}
                    >
                        Riwayat
                    </TabButton>
                    <TabButton
                        active={tab === 'komentar'}
                        onClick={() => setTab('komentar')}
                        count={
                            comments.length > 0 ? comments.length : undefined
                        }
                    >
                        Komentar
                    </TabButton>
                    <TabButton
                        active={tab === 'lead'}
                        onClick={() => setTab('lead')}
                        count={leadCount}
                    >
                        Lead
                    </TabButton>
                </div>

                <div role="tabpanel" className="px-5 py-5 sm:px-7">
                    {tab === 'riwayat' ? (
                        <Timeline events={events} current={content} />
                    ) : tab === 'komentar' ? (
                        <CommentThread
                            contentId={content.id}
                            comments={comments}
                        />
                    ) : (
                        <LeadList
                            leads={leads}
                            total={leadCount}
                            published={content.status === 'published'}
                        />
                    )}
                </div>
            </div>

            <PublishDialog
                open={publishOpen}
                onOpenChange={setPublishOpen}
                contentId={content.id}
                title={content.title}
                url={content.url}
            />

            <DeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                contentId={content.id}
                title={content.title}
                leads={leadCount}
            />
        </div>
    );
}

/** One line of the record: a small glyph and label, then the fact. */
function Prop({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof CalendarDays;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <>
            <dt className="flex items-start gap-2 self-start pt-0.5 leading-snug text-muted-foreground">
                <Icon
                    className="mt-px size-4 shrink-0"
                    strokeWidth={1.75}
                    aria-hidden
                />
                <span>{label}</span>
            </dt>
            <dd className="min-w-0 font-semibold text-foreground">
                {children}
            </dd>
        </>
    );
}

function TabButton({
    active,
    onClick,
    count,
    children,
}: {
    active: boolean;
    onClick: () => void;
    count?: number;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-[0.8438rem] font-bold transition-colors',
                active
                    ? 'border-primary text-primary-deep'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
        >
            {children}
            {count !== undefined ? (
                <span
                    className={cn(
                        'rounded-full px-1.5 py-px text-[0.6875rem] font-extrabold',
                        active
                            ? 'bg-primary-soft text-primary-deep'
                            : 'bg-neutral-soft text-muted-foreground',
                    )}
                    data-numeric
                >
                    {count}
                </span>
            ) : null}
        </button>
    );
}

function LeadList({
    leads,
    total,
    published,
}: {
    leads: Lead[];
    total: number;
    published: boolean;
}) {
    if (leads.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-6 text-center text-xs text-muted-foreground">
                {published
                    ? 'Belum ada lead yang tercatat berasal dari konten ini. Pilih konten ini di form lead saat ada yang masuk.'
                    : 'Lead baru bisa dikaitkan setelah konten ini tayang.'}
            </p>
        );
    }

    return (
        <>
            <ul className="flex flex-col">
                {leads.map((lead) => (
                    <li key={lead.id}>
                        <Link
                            href={leadShow(lead.id)}
                            className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-neutral-soft"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.8438rem] font-bold">
                                    {lead.company}
                                </span>
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                    <StageMark stage={lead.stage} />
                                    {lead.closedReason ? (
                                        <span>
                                            · Berhenti · {lead.closedReason}
                                        </span>
                                    ) : null}
                                    <span aria-hidden>·</span>
                                    <span data-numeric>
                                        masuk {entryDate(lead.entryAt)}
                                    </span>
                                </span>
                            </span>
                            <span
                                className="shrink-0 text-[0.8438rem] font-bold"
                                data-numeric
                            >
                                {shortRupiah(lead.value)}
                            </span>
                            <ChevronRight
                                className="size-4 shrink-0 text-muted-foreground"
                                strokeWidth={2}
                                aria-hidden
                            />
                        </Link>
                    </li>
                ))}
            </ul>

            {total > leads.length ? (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    Menampilkan{' '}
                    <span className="font-bold text-foreground" data-numeric>
                        {leads.length}
                    </span>{' '}
                    terbaru dari{' '}
                    <span className="font-bold text-foreground" data-numeric>
                        {total}
                    </span>{' '}
                    lead. Selengkapnya ada di daftar lead.
                </p>
            ) : null}
        </>
    );
}

function Timeline({
    events,
    current,
}: {
    events: ContentEvent[];
    current: ContentDetail;
}) {
    if (events.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border bg-neutral-soft/60 px-3 py-6 text-center text-xs text-muted-foreground">
                Belum ada perpindahan yang tercatat.
            </p>
        );
    }

    // Newest first, the way a feed reads; the current status sits on top.
    const feed = [...events].reverse();

    return (
        <ol className="flex flex-col">
            {feed.map((event, index) => {
                const newest = index === 0;
                const last = index === feed.length - 1;

                return (
                    <li key={event.id} className="flex gap-3.5">
                        <span
                            className="flex flex-col items-center"
                            aria-hidden
                        >
                            <span
                                className={cn(
                                    'mt-1 size-3 shrink-0 rounded-full ring-4 ring-background',
                                    STATUS_DOT[event.status],
                                )}
                            />
                            {last ? null : (
                                <span className="w-px flex-1 bg-border" />
                            )}
                        </span>

                        <span
                            className={cn('min-w-0 flex-1', last ? '' : 'pb-4')}
                        >
                            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-[0.8438rem]">
                                    {event.author ? (
                                        <span className="font-bold">
                                            {event.author}
                                        </span>
                                    ) : null}
                                    {event.author
                                        ? ' memindahkan ke '
                                        : 'Masuk '}
                                    <span className="font-bold">
                                        {event.label}
                                    </span>
                                </span>
                                {newest ? (
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-[0.6875rem] font-extrabold',
                                            current.stuck
                                                ? 'bg-destructive-soft text-destructive'
                                                : 'bg-primary-soft text-primary-deep',
                                        )}
                                    >
                                        {current.stuck
                                            ? 'Tertahan'
                                            : 'Sekarang'}
                                    </span>
                                ) : null}
                            </span>
                            <span
                                className="mt-0.5 block text-xs text-muted-foreground"
                                data-numeric
                            >
                                {longDate(event.at)}
                            </span>
                            {event.note ? (
                                <span className="mt-1.5 block rounded-lg bg-neutral-soft/70 px-3 py-2 text-xs leading-relaxed text-secondary-foreground">
                                    {event.note}
                                </span>
                            ) : null}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
