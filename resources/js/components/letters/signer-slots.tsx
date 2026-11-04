import { Link } from '@inertiajs/react';
import { PenLine, Plus } from 'lucide-react';
import { Field } from '@/components/leads/form-field';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { SignerOption, SignerSlot } from '@/data/letters';
import { settings as letterSettings } from '@/routes/letters';

/** The select cannot carry an empty value; this stands for "nobody yet". */
const NOBODY = '__kosong__';

/**
 * Who signs, one choice per column the template prints.
 *
 * There is no approval round: the signature image prints the moment a
 * signer is chosen, so the choice is the signing. A signer without an
 * image on file prints a blank space above the name, and says so here.
 */
export function SignerSlots({
    slots,
    signers,
    value,
    onChange,
    errors,
    disabled = false,
}: {
    slots: SignerSlot[];
    signers: SignerOption[];
    /** Chosen signer per slot, by index. */
    value: (number | null)[];
    onChange: (next: (number | null)[]) => void;
    errors: Record<string, string>;
    disabled?: boolean;
}) {
    const byId = new Map(signers.map((signer) => [signer.id, signer]));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4">
                {slots.map((slot, i) => {
                    const chosen = value[i] ?? null;
                    /* An issued letter may name someone since switched off;
                       the frozen slot still says who signed. */
                    const signer = chosen ? byId.get(chosen) : undefined;
                    const hasSignature =
                        signer?.hasSignature ?? slot.hasSignature;

                    return (
                        <Field
                            key={`${slot.label}-${i}`}
                            id={`signer-${i}`}
                            label={slot.label}
                            error={errors[`signers.${i}`]}
                            hint={
                                chosen && !hasSignature
                                    ? 'Belum ada gambar tanda tangan; ruang di atas nama dibiarkan kosong.'
                                    : undefined
                            }
                        >
                            <Select
                                value={chosen ? String(chosen) : NOBODY}
                                onValueChange={(next) => {
                                    const copy = slots.map(
                                        (_, n) => value[n] ?? null,
                                    );
                                    copy[i] =
                                        next === NOBODY ? null : Number(next);
                                    onChange(copy);
                                }}
                                disabled={disabled}
                            >
                                <SelectTrigger
                                    id={`signer-${i}`}
                                    className="w-full"
                                >
                                    <SelectValue>
                                        {signer ? (
                                            <SignerLine signer={signer} />
                                        ) : chosen && slot.name ? (
                                            <span className="truncate">
                                                {slot.name}
                                                {slot.title
                                                    ? ` · ${slot.title}`
                                                    : ''}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Pilih penanda tangan
                                            </span>
                                        )}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NOBODY}>
                                        <span className="text-muted-foreground">
                                            Belum dipilih
                                        </span>
                                    </SelectItem>
                                    {signers.map((option) => (
                                        <SelectItem
                                            key={option.id}
                                            value={String(option.id)}
                                        >
                                            <SignerLine signer={option} />
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    );
                })}
            </div>

            {disabled ? null : (
                <Link
                    href={letterSettings()}
                    className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                >
                    <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
                    Tambah penanda tangan atau unggah tanda tangan
                </Link>
            )}
        </div>
    );
}

function SignerLine({ signer }: { signer: SignerOption }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-bold">{signer.name}</span>
            <span className="truncate text-xs text-muted-foreground">
                {signer.title}
            </span>
            {signer.hasSignature ? (
                <PenLine
                    className="size-3.5 shrink-0 text-primary-deep"
                    strokeWidth={2}
                    aria-label="Tanda tangan tersedia"
                />
            ) : null}
        </span>
    );
}
