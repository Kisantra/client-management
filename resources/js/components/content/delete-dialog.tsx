import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { destroy as destroyContent } from '@/routes/content';

/**
 * Removing a piece from the calendar. The leads it brought in stay, with the
 * title still on them as text; only the link back to the piece goes.
 */
export function DeleteDialog({
    open,
    onOpenChange,
    contentId,
    title,
    leads,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contentId: number;
    title: string;
    /** How many leads point at it, so the warning can be specific. */
    leads: number;
}) {
    const [deleting, setDeleting] = useState(false);

    const submit = () => {
        router.delete(destroyContent(contentId).url, {
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                        Hapus konten
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {title} akan hilang dari kalender beserta riwayat
                        statusnya.{' '}
                        {leads > 0
                            ? `${leads} lead yang berasal darinya tetap tercatat, hanya tautannya yang lepas.`
                            : 'Belum ada lead yang tercatat berasal darinya.'}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => onOpenChange(false)}
                        disabled={deleting}
                    >
                        Batal
                    </Button>
                    {/* Not red: red is reserved for lateness. Deleting is a
                        decision, so it reads in ink like closing a lead. */}
                    <Button
                        type="button"
                        onClick={submit}
                        disabled={deleting}
                        className="bg-ink-panel text-white hover:bg-ink-panel/90"
                    >
                        <Trash2 strokeWidth={2} aria-hidden />
                        {deleting ? 'Menghapus…' : 'Hapus konten'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
