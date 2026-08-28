import { router } from '@inertiajs/react';
import { Check, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { AttachmentField } from '@/components/leads/attachment-field';
import type { Attachment } from '@/components/leads/attachment-field';
import { STAGE_DOT } from '@/components/leads/stage-mark';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useStageLabels, useStageRequirement } from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { store as moveStage } from '@/routes/leads/stage';

/**
 * A gated stage move: stages that need a document cannot be entered until one
 * is attached, so the record of a proposal or a deal can never be missing the
 * thing that proves it happened. The server enforces the same rule; this only
 * saves the round trip.
 */
export function StageMoveDialog({
    open,
    onOpenChange,
    toStage,
    leadId,
    company,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    toStage: string | null;
    leadId: number;
    company: string;
}) {
    const [files, setFiles] = useState<Attachment[]>([]);
    const [touched, setTouched] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    const labels = useStageLabels();
    const requirementFor = useStageRequirement();

    const requirement = toStage ? requirementFor(toStage) : undefined;
    const missing = Boolean(requirement) && files.length === 0;

    const close = (next: boolean) => {
        if (!next) {
            setFiles([]);
            setTouched(false);
            setFailed(null);
        }

        onOpenChange(next);
    };

    const submit = () => {
        setTouched(true);

        if (missing || !toStage) {
            return;
        }

        router.post(
            moveStage(leadId).url,
            { stage: toStage, files: files.map((item) => item.file) },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => {
                    setSaving(true);
                    setFailed(null);
                },
                onFinish: () => setSaving(false),
                onSuccess: () => close(false),
                onError: (errors) =>
                    setFailed(
                        Object.values(errors)[0] ??
                            'Tahap tidak bisa dipindahkan.',
                    ),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5 text-base font-extrabold tracking-[-0.02em]">
                        {toStage ? (
                            <span
                                className={cn(
                                    'size-2.5 shrink-0 rounded-full',
                                    STAGE_DOT[toStage],
                                )}
                                aria-hidden
                            />
                        ) : null}
                        Pindah ke {toStage ? labels[toStage] : ''}
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {company}
                        {requirement
                            ? ` · tahap ini butuh ${requirement.label.toLowerCase()}.`
                            : ' akan dipindahkan ke tahap ini.'}
                    </DialogDescription>
                </DialogHeader>

                {requirement ? (
                    <div className="flex flex-col gap-2.5">
                        <p className="flex items-baseline gap-2">
                            <span className="text-[0.8438rem] font-bold text-secondary-foreground">
                                {requirement.label}
                            </span>
                            <span className="text-[0.6875rem] font-bold text-destructive">
                                wajib
                            </span>
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {requirement.hint}
                        </p>

                        <AttachmentField
                            items={files}
                            onChange={setFiles}
                            hint="PDF hasil ekspor atau foto dokumen · maks 10 MB per berkas"
                        />

                        {touched && missing ? (
                            <Problem>
                                Lampirkan dokumennya dulu sebelum memindahkan
                                tahap.
                            </Problem>
                        ) : null}
                    </div>
                ) : (
                    <p className="text-[0.8438rem] leading-relaxed text-secondary-foreground">
                        Tahap ini tidak membutuhkan dokumen. Perpindahan
                        langsung tercatat di perjalanan lead.
                    </p>
                )}

                {failed ? <Problem>{failed}</Problem> : null}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => close(false)}
                        type="button"
                        disabled={saving}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        className="shadow-teal"
                        onClick={submit}
                        disabled={saving}
                    >
                        <Check strokeWidth={2.5} aria-hidden />
                        {saving ? 'Memindahkan…' : 'Pindahkan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Problem({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <TriangleAlert
                className="size-3.5 shrink-0"
                strokeWidth={2.5}
                aria-hidden
            />
            {children}
        </p>
    );
}
