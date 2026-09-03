import { useState } from 'react';
import { ContentForm } from '@/components/content/content-form';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ChannelKey } from '@/data/dashboard';

/**
 * What a new piece starts from: the day it was asked for, on which channel —
 * and, when it grows out of an idea, the words the idea already has.
 */
export type Compose = {
    scheduledFor: string;
    channel: ChannelKey;
    title?: string;
    brief?: string;
    referenceUrl?: string;
    /** The backlog entry to link back to once the piece is saved. */
    ideaId?: number;
};

/**
 * The form for a new piece, over the calendar rather than instead of it. The
 * month stays in view underneath, so the day being planned is never lost.
 *
 * Only new pieces come through here. An existing one is changed inside its
 * own panel, where its record already is — a second window over the panel
 * that opened over the calendar was one layer too many.
 */
export function ContentDialog({
    compose,
    open,
    onOpenChange,
}: {
    compose: Compose | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    /* The last request stays on screen while the dialog fades out, instead
       of the form emptying a beat before it leaves. */
    const [last, setLast] = useState<Compose | null>(compose);

    if (compose && compose !== last) {
        setLast(compose);
    }

    const shown = compose ?? last;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-x-hidden overflow-y-hidden p-0 sm:max-w-2xl sm:p-0">
                {shown ? (
                    <ContentForm
                        // A fresh form for every request: new day, new piece.
                        key={`${shown.scheduledFor}-${shown.channel}-${shown.ideaId ?? 'baru'}`}
                        content={null}
                        seed={shown}
                        variant="dialog"
                        onCancel={() => onOpenChange(false)}
                        onSaved={() => onOpenChange(false)}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
