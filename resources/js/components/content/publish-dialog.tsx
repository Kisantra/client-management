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
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { toIso } from '@/data/content';
import { TODAY } from '@/data/leads';
import { store as moveStatus } from '@/routes/content/status';

const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

/**
 * Marking a piece live. The date and the link are asked for here, together,
 * because this is the one moment both are known and nobody comes back for
 * them later.
 */
export function PublishDialog({
    open,
    onOpenChange,
    contentId,
    title,
    url: initialUrl,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contentId: number;
    title: string;
    url: string | null;
}) {
    const [at, setAt] = useState<Date>(TODAY);
    const [url, setUrl] = useState(initialUrl ?? '');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    const close = (next: boolean) => {
        if (!next) {
            setAt(TODAY);
            setUrl(initialUrl ?? '');
            setFailed(null);
        }

        onOpenChange(next);
    };

    const submit = () => {
        router.post(
            moveStatus(contentId).url,
            { status: 'published', published_at: toIso(at), url: url.trim() },
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
                            'Konten tidak bisa ditandai tayang.',
                    ),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                        Tandai tayang
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {title} akan tercatat sebagai Published. Tanggalnya
                        dipakai untuk menghitung konten tayang bulan ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[0.8438rem] font-bold text-secondary-foreground">
                            Tayang pada
                        </span>
                        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                                    disabled={{ after: TODAY }}
                                    defaultMonth={at}
                                    autoFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="publish-url"
                            className="text-[0.8438rem] font-bold text-secondary-foreground"
                        >
                            Tautan{' '}
                            <span className="text-[0.6875rem] font-semibold text-muted-foreground">
                                opsional
                            </span>
                        </label>
                        <Input
                            id="publish-url"
                            type="url"
                            inputMode="url"
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://www.instagram.com/p/…"
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
                        {saving ? 'Menyimpan…' : 'Tandai tayang'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
