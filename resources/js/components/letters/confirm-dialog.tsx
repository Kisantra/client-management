import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * One question before an action that changes what is on the register.
 *
 * Ink for a decision, red only for the one action that destroys something:
 * red is the breach colour everywhere else in the app and must stay so.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    action,
    busy = false,
    destructive = false,
    onConfirm,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    action: string;
    busy?: boolean;
    destructive?: boolean;
    onConfirm: () => void;
    children?: React.ReactNode;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                        {title}
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {children}

                <DialogFooter>
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                    >
                        Kembali
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={cn(
                            destructive
                                ? 'bg-destructive text-white hover:bg-destructive/90'
                                : 'bg-ink-panel text-white hover:bg-ink-panel/90',
                        )}
                    >
                        {busy ? 'Sebentar…' : action}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
