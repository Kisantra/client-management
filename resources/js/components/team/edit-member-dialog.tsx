import { router } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Field } from '@/components/leads/form-field';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { TeamMember } from '@/data/team';
import { update as teamUpdate } from '@/routes/team';
import { update as pjUpdate } from '@/routes/team/pj';

/**
 * One member's details, sign-in included.
 *
 * Every member gets the same form: name, email, password, role. For someone
 * with an account the last three are what they sign in with, and the password
 * is only replaced when a new one is typed. For a name that exists only as PJ
 * the email and password are the account it does not have yet — fill them and
 * saving makes one, under the new name, already holding that name's work.
 */
export function EditMemberDialog({
    member,
    onClose,
}: {
    member: TeamMember | null;
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
                <DialogHeader>
                    <DialogTitle className="text-base font-extrabold tracking-[-0.02em]">
                        Edit anggota
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {shown?.userId
                            ? 'Nama, email dan sandi untuk masuk, serta perannya.'
                            : 'Ganti namanya, atau isi email dan sandi untuk membuatkan akun.'}
                    </DialogDescription>
                </DialogHeader>

                {shown ? (
                    <MemberForm
                        key={`${shown.name}-${shown.userId ?? 'pj'}`}
                        member={shown}
                        onDone={onClose}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

type Errors = Partial<
    Record<'name' | 'to' | 'email' | 'password' | 'role', string>
>;

function MemberForm({
    member,
    onDone,
}: {
    member: TeamMember;
    onDone: () => void;
}) {
    const account = member.userId !== null;
    const [name, setName] = useState(member.name);
    const [email, setEmail] = useState(member.email ?? '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(member.role ?? '');
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const renaming = name.trim() !== member.name;
    const held = member.contentCount + member.leadCount;
    /* A name without an account gets one only when both are filled. */
    const creating = !account && (email.trim() !== '' || password !== '');

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const next: Errors = {};
        const address = email.trim();

        if (!name.trim()) {
            next.name = 'Nama anggota wajib diisi.';
        }

        if (account || creating) {
            if (!/^\S+@\S+\.\S+$/.test(address)) {
                next.email = address
                    ? 'Alamat email tidak valid.'
                    : 'Isi email untuk membuat akunnya.';
            }
        }

        if (account && password !== '' && password.length < 8) {
            next.password = 'Sandi minimal 8 karakter.';
        }

        if (creating && password.length < 8) {
            next.password = password
                ? 'Sandi minimal 8 karakter.'
                : 'Isi sandi awal untuk membuat akunnya.';
        }

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        const options = {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: () => onDone(),
            onError: (serverErrors: Errors) =>
                /* The PJ route calls the new name `to`; the form calls it
                   name. One field, whichever route answered. */
                setErrors({
                    ...serverErrors,
                    name: serverErrors.name ?? serverErrors.to,
                }),
        };

        if (account) {
            router.patch(
                teamUpdate(member.userId!).url,
                {
                    name: name.trim(),
                    email: address.toLowerCase(),
                    password,
                    role: role.trim(),
                },
                options,
            );

            return;
        }

        router.patch(
            pjUpdate().url,
            {
                name: member.name,
                to: name.trim(),
                email: creating ? address.toLowerCase() : '',
                password: creating ? password : '',
                role: creating ? role.trim() : '',
            },
            options,
        );
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <Field
                id="edit-name"
                label="Nama"
                error={errors.name}
                hint={
                    renaming && held > 0
                        ? `PJ di ${member.contentCount} konten dan ${member.leadCount} lead ikut berganti ke nama ini.`
                        : 'Nama ini yang menyambungkan anggota ke kolom PJ.'
                }
            >
                <Input
                    id="edit-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="off"
                    autoFocus
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={
                        errors.name ? 'edit-name-error' : 'edit-name-hint'
                    }
                />
            </Field>

            {/* Sign-in, set apart from who the person is. For a name with no
                account yet, it says what filling it in will do. */}
            <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-neutral-soft/50 p-3.5">
                <legend className="-ml-1 flex items-center gap-1.5 px-1 text-[0.8438rem] font-bold text-secondary-foreground">
                    <KeyRound
                        className="size-3.5 text-muted-foreground"
                        strokeWidth={2.25}
                        aria-hidden
                    />
                    Akun untuk masuk
                </legend>

                {account ? null : (
                    <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
                        {member.name} belum punya akun. Isi email dan sandi awal
                        untuk membuatkannya; kosongkan bila hanya mengganti
                        nama.
                    </p>
                )}

                <Field
                    id="edit-email"
                    label="Email"
                    optional={!account}
                    error={errors.email}
                >
                    <Input
                        id="edit-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="nama@kantor.co.id"
                        autoComplete="off"
                        className="bg-card"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={
                            errors.email ? 'edit-email-error' : undefined
                        }
                    />
                </Field>

                <Field
                    id="edit-password"
                    label={account ? 'Sandi baru' : 'Sandi awal'}
                    optional={account}
                    error={errors.password}
                    hint={
                        account
                            ? 'Kosongkan bila sandinya tidak diganti. Minimal 8 karakter.'
                            : 'Minimal 8 karakter. Sampaikan langsung ke orangnya.'
                    }
                >
                    <PasswordInput
                        id="edit-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                        className="bg-card"
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={
                            errors.password
                                ? 'edit-password-error'
                                : 'edit-password-hint'
                        }
                    />
                </Field>
            </fieldset>

            {/* A role lives on the account, so a name without one is asked
                for it only once it is getting one. */}
            {account || creating ? (
                <Field
                    id="edit-role"
                    label="Peran"
                    optional
                    error={errors.role}
                    hint="Mis. Copywriter, Desainer, Editor video."
                >
                    <Input
                        id="edit-role"
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                        autoComplete="off"
                        aria-invalid={Boolean(errors.role)}
                        aria-describedby={
                            errors.role ? 'edit-role-error' : 'edit-role-hint'
                        }
                    />
                </Field>
            ) : null}

            <DialogFooter className="mt-1">
                <Button type="button" variant="outline" onClick={onDone}>
                    Batal
                </Button>
                <Button type="submit" className="shadow-teal" disabled={saving}>
                    {saving
                        ? 'Menyimpan…'
                        : creating
                          ? 'Simpan & buat akun'
                          : 'Simpan perubahan'}
                </Button>
            </DialogFooter>
        </form>
    );
}
