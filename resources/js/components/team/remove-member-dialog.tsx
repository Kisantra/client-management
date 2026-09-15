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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { TeamMember } from '@/data/team';
import { cn } from '@/lib/utils';
import { destroy as teamDestroy } from '@/routes/team';
import { destroy as pjDestroy } from '@/routes/team/pj';

type Handover = 'give' | 'clear' | 'keep';

/**
 * Taking someone off the team.
 *
 * The account is the easy part. The work under their name is what needs a
 * decision, and the dialog will not guess it: hand it to a teammate, leave it
 * without a PJ, or — for an account — keep the name on it as a PJ who can no
 * longer sign in. Someone with nothing under their name gets none of that,
 * just the confirmation.
 */
export function RemoveMemberDialog({
    member,
    members,
    onClose,
}: {
    member: TeamMember | null;
    /** The roster, for choosing who takes the work over. */
    members: TeamMember[];
    onClose: () => void;
}) {
    /* The last member stays on screen while the dialog fades out. */
    const [last, setLast] = useState<TeamMember | null>(member);

    if (member && member !== last) {
        setLast(member);
    }

    const shown = member ?? last;

    return (
        <Dialog
            open={member !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                {shown ? (
                    <RemoveForm
                        key={`${shown.name}-${shown.userId ?? 'pj'}`}
                        member={shown}
                        others={members.filter(
                            (other) => other.name !== shown.name,
                        )}
                        onDone={onClose}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function RemoveForm({
    member,
    others,
    onDone,
}: {
    member: TeamMember;
    others: TeamMember[];
    onDone: () => void;
}) {
    const account = member.userId !== null;
    const held = member.contentCount + member.leadCount;
    const holding = `${member.contentCount} konten dan ${member.leadCount} lead`;

    const [handover, setHandover] = useState<Handover>(
        held === 0
            ? account
                ? 'keep'
                : 'clear'
            : others.length > 0
              ? 'give'
              : 'clear',
    );
    const [to, setTo] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const options: { key: Handover; label: string; hint: string }[] = [
        ...(others.length > 0
            ? [
                  {
                      key: 'give' as const,
                      label: 'Serahkan ke anggota lain',
                      hint: `${holding} pindah ke orang yang dipilih.`,
                  },
              ]
            : []),
        {
            key: 'clear',
            label: 'Kosongkan PJ',
            hint: `${holding} jadi tanpa penanggung jawab.`,
        },
        ...(account
            ? [
                  {
                      key: 'keep' as const,
                      label: 'Biarkan namanya tercatat',
                      hint: 'Hanya akunnya yang dihapus; namanya tetap jadi PJ tanpa akun.',
                  },
              ]
            : []),
    ];

    const submit = () => {
        if (handover === 'give' && !to) {
            setError('Pilih anggota yang menerima pekerjaannya.');

            return;
        }

        const payload = { handover, to: handover === 'give' ? to : null };
        const visit = {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => onDone(),
            onError: (errors: Record<string, string>) =>
                setError(
                    errors.member ??
                        errors.to ??
                        errors.handover ??
                        errors.name ??
                        'Anggota ini belum bisa dihapus.',
                ),
        };

        if (account) {
            router.delete(teamDestroy(member.userId!).url, {
                data: payload,
                ...visit,
            });

            return;
        }

        router.delete(pjDestroy().url, {
            data: { name: member.name, ...payload },
            ...visit,
        });
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                    Hapus {member.name}?
                </DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                    {account
                        ? `Akun ${member.email} tidak bisa dipakai masuk lagi.`
                        : 'Nama ini dilepas dari daftar anggota.'}{' '}
                    {held > 0
                        ? `Namanya masih tercatat sebagai PJ di ${holding}.`
                        : 'Tidak ada konten atau lead atas namanya.'}
                </DialogDescription>
            </DialogHeader>

            {held > 0 ? (
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-[0.8438rem] font-bold text-secondary-foreground">
                        Pekerjaannya diapakan?
                    </legend>

                    {options.map((option) => {
                        const picked = handover === option.key;

                        return (
                            <div
                                key={option.key}
                                className={cn(
                                    'rounded-lg border transition-colors',
                                    picked
                                        ? 'border-primary bg-primary-soft'
                                        : 'border-border bg-card hover:border-primary/35',
                                )}
                            >
                                <label className="flex cursor-pointer items-start gap-3 px-3.5 py-3">
                                    <input
                                        type="radio"
                                        name="handover"
                                        value={option.key}
                                        checked={picked}
                                        onChange={() => {
                                            setHandover(option.key);
                                            setError(null);
                                        }}
                                        className="mt-1 size-3.5 shrink-0 accent-primary"
                                    />
                                    <span className="min-w-0">
                                        <span
                                            className={cn(
                                                'block text-[0.8438rem] font-bold',
                                                picked && 'text-primary-deep',
                                            )}
                                        >
                                            {option.label}
                                        </span>
                                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                            {option.hint}
                                        </span>
                                    </span>
                                </label>

                                {/* The choice of who opens under its own
                                    option, so it is never asked for twice. */}
                                {option.key === 'give' && picked ? (
                                    <div className="px-3.5 pb-3 pl-10">
                                        <Select
                                            value={to}
                                            onValueChange={(value) => {
                                                setTo(value);
                                                setError(null);
                                            }}
                                        >
                                            <SelectTrigger
                                                className="w-full bg-card"
                                                aria-label="Anggota penerima"
                                                aria-invalid={
                                                    error !== null && !to
                                                }
                                            >
                                                <SelectValue placeholder="Pilih anggota" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {others.map((other) => (
                                                    <SelectItem
                                                        key={other.name}
                                                        value={other.name}
                                                    >
                                                        {other.name}
                                                        {other.userId === null
                                                            ? ' · tanpa akun'
                                                            : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </fieldset>
            ) : null}

            {error ? (
                <p
                    className="text-xs font-semibold text-destructive"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}

            <DialogFooter>
                <Button
                    variant="outline"
                    type="button"
                    onClick={onDone}
                    disabled={deleting}
                >
                    Batal
                </Button>
                {/* Not red: red is reserved for lateness. Removing someone
                    is a decision, so it reads in ink like deleting a piece. */}
                <Button
                    type="button"
                    onClick={submit}
                    disabled={deleting}
                    className="bg-ink-panel text-white hover:bg-ink-panel/90"
                >
                    <Trash2 strokeWidth={2} aria-hidden />
                    {deleting ? 'Menghapus…' : 'Hapus anggota'}
                </Button>
            </DialogFooter>
        </>
    );
}
