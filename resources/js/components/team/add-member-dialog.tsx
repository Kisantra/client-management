import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/leads/form-field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { store as teamStore } from '@/routes/team';

/**
 * Why an account gets made here rather than a sign-up page: this is an
 * in-house tool, so someone already inside vouches for the newcomer and
 * hands them their first password in person.
 */
export type Invite = {
    /** Filled when the row "Buatkan akun" started it: the PJ's exact name. */
    name?: string;
    /** Fresh per open, so every opening starts from a clean form. */
    stamp: number;
};

export function AddMemberDialog({
    invite,
    onClose,
}: {
    invite: Invite | null;
    onClose: () => void;
}) {
    /* The last request stays on screen while the dialog fades out. */
    const [last, setLast] = useState<Invite | null>(invite);

    if (invite && invite !== last) {
        setLast(invite);
    }

    const shown = invite ?? last;

    return (
        <Dialog
            open={invite !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Tambah Anggota</DialogTitle>
                    <DialogDescription>
                        Buatkan akun untuk rekan setim. Sampaikan sandinya
                        langsung; ia bisa menggantinya sendiri di Pengaturan.
                    </DialogDescription>
                </DialogHeader>

                {shown ? (
                    <MemberForm
                        key={shown.stamp}
                        prefillName={shown.name ?? ''}
                        onDone={onClose}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

type Errors = Partial<Record<'name' | 'email' | 'password' | 'role', string>>;

function MemberForm({
    prefillName,
    onDone,
}: {
    prefillName: string;
    onDone: () => void;
}) {
    const [name, setName] = useState(prefillName);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('');
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const next: Errors = {};

        if (!name.trim()) {
            next.name = 'Nama anggota wajib diisi.';
        }

        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            next.email = 'Alamat email tidak valid.';
        }

        if (password.length < 8) {
            next.password = 'Sandi minimal 8 karakter.';
        }

        setErrors(next);

        if (Object.keys(next).length > 0) {
            toast.error('Beberapa isian belum lengkap', {
                description: 'Yang perlu diperbaiki ditandai merah.',
            });

            return;
        }

        router.post(
            teamStore().url,
            {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
                role: role.trim(),
            },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => onDone(),
                onError: (serverErrors) => setErrors(serverErrors),
            },
        );
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <Field
                id="member-name"
                label="Nama"
                error={errors.name}
                hint={
                    prefillName
                        ? 'Persis nama PJ di kalender, supaya beban kerjanya langsung tersambung.'
                        : 'Nama ini juga yang menyambungkan akun ke kolom PJ di kalender.'
                }
            >
                <Input
                    id="member-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="off"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={
                        errors.name ? 'member-name-error' : 'member-name-hint'
                    }
                />
            </Field>

            <Field id="member-email" label="Email" error={errors.email}>
                <Input
                    id="member-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@kantor.co.id"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={
                        errors.email ? 'member-email-error' : undefined
                    }
                />
            </Field>

            <Field
                id="member-password"
                label="Sandi awal"
                error={errors.password}
                hint="Minimal 8 karakter."
            >
                <Input
                    id="member-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                        errors.password
                            ? 'member-password-error'
                            : 'member-password-hint'
                    }
                />
            </Field>

            <Field
                id="member-role"
                label="Peran"
                optional
                error={errors.role}
                hint="Mis. Copywriter, Desainer, Editor video."
            >
                <Input
                    id="member-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    autoComplete="off"
                    aria-invalid={Boolean(errors.role)}
                    aria-describedby={
                        errors.role ? 'member-role-error' : 'member-role-hint'
                    }
                />
            </Field>

            <div className="mt-1 flex justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={onDone}>
                    Batal
                </Button>
                <Button type="submit" className="shadow-teal" disabled={saving}>
                    {saving ? 'Menyimpan…' : 'Simpan Anggota'}
                </Button>
            </div>
        </form>
    );
}
