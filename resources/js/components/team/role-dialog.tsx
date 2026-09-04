import { router } from '@inertiajs/react';
import { useState } from 'react';
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
import type { TeamMember } from '@/data/team';
import { update as teamUpdate } from '@/routes/team';

/**
 * A label, not a lock: the role says what someone does, and grants nothing.
 * Splitting actual rights still waits on the team deciding the split.
 */
export function RoleDialog({
    member,
    onClose,
}: {
    /** Always a member with an account; PJ-only rows have nothing to label. */
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
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Peran {shown?.name}</DialogTitle>
                    <DialogDescription>
                        Sebutan tugasnya di tim — tampil di daftar anggota,
                        tidak mengubah hak akses.
                    </DialogDescription>
                </DialogHeader>

                {shown ? (
                    <RoleForm
                        key={`${shown.userId}-${shown.role ?? ''}`}
                        member={shown}
                        onDone={onClose}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function RoleForm({
    member,
    onDone,
}: {
    member: TeamMember;
    onDone: () => void;
}) {
    const [role, setRole] = useState(member.role ?? '');
    const [error, setError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);

    const save = (value: string) => {
        router.patch(
            teamUpdate(member.userId!).url,
            { role: value },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => onDone(),
                onError: (serverErrors) => setError(serverErrors.role),
            },
        );
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        save(role.trim());
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <Field
                id="role"
                label="Peran"
                error={error}
                hint="Mis. Copywriter, Desainer, Editor video."
            >
                <Input
                    id="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    autoComplete="off"
                    autoFocus
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'role-error' : 'role-hint'}
                />
            </Field>

            <div className="mt-1 flex flex-wrap justify-end gap-2.5">
                {member.role ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="mr-auto text-muted-foreground"
                        disabled={saving}
                        onClick={() => save('')}
                    >
                        Kosongkan
                    </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={onDone}>
                    Batal
                </Button>
                <Button type="submit" className="shadow-teal" disabled={saving}>
                    {saving ? 'Menyimpan…' : 'Simpan'}
                </Button>
            </div>
        </form>
    );
}
