import { router } from '@inertiajs/react';
import { CalendarDays, Check, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { daysAgoDate, TODAY } from '@/data/leads';
import { usePipeline } from '@/hooks/use-pipeline';
import { store as storeFollowUp } from '@/routes/leads/follow-ups';

/** Quick horizons; the calendar covers anything else. */
const SOON = [
    { label: 'Besok', days: 1 },
    { label: '3 hari lagi', days: 3 },
    { label: 'Minggu depan', days: 7 },
];

const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

/** Dates travel as plain calendar days; the server never sees a timezone. */
function toIso(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

export function FollowUpDialog({
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
    const { followUpVia } = usePipeline();

    const [at, setAt] = useState<Date>(() => daysAgoDate(-3));
    const [via, setVia] = useState(followUpVia[0]);
    const [note, setNote] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    const close = (next: boolean) => {
        if (!next) {
            setAt(daysAgoDate(-3));
            setVia(followUpVia[0]);
            setNote('');
            setFailed(null);
        }

        onOpenChange(next);
    };

    const submit = () => {
        router.post(
            storeFollowUp(leadId).url,
            { scheduled_for: toIso(at), via, note: note.trim() },
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
                        Object.values(errors)[0] ??
                            'Follow-up tidak bisa disimpan.',
                    ),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                        Jadwalkan follow-up
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {company} sedang di tahap {stageLabel}. Follow-up
                        dicatat tanpa memindahkan tahapnya.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[0.8438rem] font-bold text-secondary-foreground">
                            Kapan
                        </span>

                        <div className="flex flex-wrap gap-2">
                            {SOON.map((option) => (
                                <button
                                    key={option.days}
                                    type="button"
                                    onClick={() =>
                                        setAt(daysAgoDate(-option.days))
                                    }
                                    className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-bold text-secondary-foreground shadow-lift transition-colors hover:border-primary/35 hover:text-primary-deep"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="mt-1 flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                >
                                    <CalendarDays
                                        className="size-4 shrink-0 text-muted-foreground"
                                        strokeWidth={1.75}
                                        aria-hidden
                                    />
                                    {dateLabel.format(at)}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="start"
                                className="w-auto p-3"
                            >
                                <Calendar
                                    mode="single"
                                    selected={at}
                                    onSelect={(date) => {
                                        if (date) {
                                            setAt(date);
                                        }

                                        setPickerOpen(false);
                                    }}
                                    disabled={{ before: TODAY }}
                                    defaultMonth={at}
                                    autoFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-[0.8438rem] font-bold text-secondary-foreground">
                            Lewat apa
                        </span>
                        <Select value={via} onValueChange={setVia}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {followUpVia.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="followup-note"
                            className="text-[0.8438rem] font-bold text-secondary-foreground"
                        >
                            Yang mau ditanyakan{' '}
                            <span className="text-[0.6875rem] font-semibold text-muted-foreground">
                                opsional
                            </span>
                        </label>
                        <Textarea
                            id="followup-note"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Menanyakan kelanjutan proposal dan dokumen yang belum dikirim…"
                        />
                    </div>

                    {failed ? (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                            <TriangleAlert
                                className="size-3.5 shrink-0"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            {failed}
                        </p>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => close(false)}
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
                        {saving ? 'Menyimpan…' : 'Jadwalkan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
