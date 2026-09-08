import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';

type Props = {
    status?: string;
};

/**
 * Signing in, and nothing else.
 *
 * Kisantra's is a closed workspace: accounts are made for people by whoever
 * runs the team, so there is no self-service sign-up to offer and no reset
 * link to send. What is left is two fields and a button, and the page is
 * arranged so that is obvious in a glance.
 *
 * The starter kit's passkey button is gone with them. Nobody on this team has
 * enrolled one, so it offered a second way in that led nowhere, above the way
 * in that works — and it was the one thing on the page still speaking English.
 */
export default function Login({ status }: Props) {
    return (
        <>
            <Head title="Masuk" />

            {status ? (
                <p className="mb-5 rounded-lg bg-primary-soft px-3.5 py-2.5 text-sm font-semibold text-primary-deep">
                    {status}
                </p>
            ) : null}

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                required
                                autoFocus
                                tabIndex={1}
                                autoComplete="email"
                                placeholder="nama@kisantra.co.id"
                            />
                            <InputError message={errors.email} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">Kata sandi</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                required
                                tabIndex={2}
                                autoComplete="current-password"
                                placeholder="Kata sandi akun kamu"
                            />
                            <InputError message={errors.password} />
                        </div>

                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="remember"
                                name="remember"
                                tabIndex={3}
                            />
                            <Label
                                htmlFor="remember"
                                className="font-normal text-muted-foreground"
                            >
                                Biarkan saya tetap masuk
                            </Label>
                        </div>

                        <Button
                            type="submit"
                            size="lg"
                            className="mt-1 w-full shadow-teal"
                            tabIndex={4}
                            disabled={processing}
                            data-test="login-button"
                        >
                            {processing ? <Spinner /> : null}
                            {processing ? 'Membuka…' : 'Masuk'}
                        </Button>

                        {/* Where to go when the password is gone: a person,
                            not a form. Nobody can reset an account here. */}
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Belum punya akses atau lupa kata sandi? Hubungi
                            admin tim.
                        </p>
                    </>
                )}
            </Form>
        </>
    );
}

Login.layout = {
    title: 'Masuk ke Kisantra',
    description:
        'Ruang kerja tim digital marketing — konten, lead, dan client dalam satu tempat.',
};
