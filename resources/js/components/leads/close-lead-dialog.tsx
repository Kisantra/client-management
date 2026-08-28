import { router } from '@inertiajs/react';
import { CircleSlash, TriangleAlert } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useCloseReasons } from '@/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { store as closeLead } from '@/routes/leads/closure';

/**
 * Stopping a lead.
 *
 * The reason is the whole point of the dialog: it is what turns a lost lead
 * into something the team can learn from, so it is asked for as a choice rather
 * than left to a free-text box nobody fills in.
 */
export function CloseLeadDialog({
    open,
    onOpenChange,
    leadId,
    company,
    stageLabel,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leadId: number;
    company: string;
    stageLabel: string;
}) {
    const reasons = useCloseReasons();

    const [reason, setReason] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [touched, setTouched] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    const close = (next: boolean) => {
        if (!next) {
            setReason(null);
            setNote('');
            setTouched(false);
            setFailed(null);
        }

        onOpenChange(next);
    };

    const submit = () => {
        setTouched(true);

        if (!reason) {
            return;
        }

        router.post(
            closeLead(leadId).url,
            { reason, note: note.trim() },
            {
                preserveScroll: true,
                onStart: () => {
                    setSaving(true);
                    setFailed(null);
                },
                onFinish: () => setSaving(false),
                onSuccess: () => close(false),
                onError: (errors) =>
                    setFailed(
                        Object.values(errors)[0] ?? 'Lead tidak bisa ditutup.',
                    ),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                        Tutup lead
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {company} keluar dari papan, tapi tetap tercatat di
                        tahap {stageLabel} — supaya terlihat di tahap mana lead
                        biasanya berhenti. Bisa dibuka lagi kapan saja.
                    </DialogDescription>
                </DialogHeader>

                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-[0.8438rem] font-bold text-secondary-foreground">
                        Kenapa berhenti?
                    </legend>

                    {reasons.map((item) => {
                        const picked = reason === item.key;

                        return (
                            <label
                                key={item.key}
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                                    picked
                                        ? 'border-primary bg-primary-soft'
                                        : 'border-border bg-card hover:border-primary/35',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="close-reason"
                                    value={item.key}
                                    checked={picked}
                                    onChange={() => setReason(item.key)}
                                    className="mt-1 size-3.5 shrink-0 accent-primary"
                                />
                                <span className="min-w-0">
                                    <span
                                        className={cn(
                                            'block text-[0.8438rem] font-bold',
                                            picked && 'text-primary-deep',
                                        )}
                                    >
                                        {item.label}
                                    </span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                        {item.hint}
                                    </span>
                                </span>
                            </label>
                        );
                    })}

                    {touched && !reason ? (
                        <Problem>Pilih salah satu alasannya dulu.</Problem>
                    ) : null}
                </fieldset>

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="close-note"
                        className="text-[0.8438rem] font-bold text-secondary-foreground"
                    >
                        Keterangan{' '}
                        <span className="text-[0.6875rem] font-semibold text-muted-foreground">
                            opsional
                        </span>
                    </label>
                    <Textarea
                        id="close-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Harganya di atas anggaran, minta ditawarkan lagi tahun depan…"
                    />
                </div>

                {failed ? <Problem>{failed}</Problem> : null}

                <DialogFooter>
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => close(false)}
                        disabled={saving}
                    >
                        Batal
                    </Button>
                    {/* Not red: red is reserved for lateness. Stopping a lead
                        is a decision, not a breach. */}
                    <Button
                        type="button"
                        onClick={submit}
                        disabled={saving}
                        className="bg-ink-panel text-white hover:bg-ink-panel/90"
                    >
                        <CircleSlash strokeWidth={2} aria-hidden />
                        {saving ? 'Menutup…' : 'Tutup lead'}
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
