import AppLogoIcon from '@/components/app-logo-icon';
import { WorkspaceSplash } from '@/components/auth/workspace-splash';
import type { AuthLayoutProps } from '@/types';

/**
 * The way in: the workspace on the left, the form on the right.
 *
 * One ground, two halves. Neither side is given a surface of its own: the
 * splash paints no background, so the page is a single sheet with a stack of
 * product cards resting on the left of it. Every coloured panel tried here
 * became the thing the eye landed on, and the cards are the only objects on
 * this page worth landing on.
 *
 * The form keeps a measure of its own: capped near 24rem and centred in its
 * half, because a login form stretched across 900px of screen is a worse form,
 * not a fuller one.
 *
 * The splash is decoration in the strict sense — nothing in it is needed to
 * sign in — so below `lg` it goes entirely rather than shrinking into a strip
 * nobody can read.
 */
export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="grid min-h-svh bg-background lg:grid-cols-[1.05fr_1fr]">
            <div className="hidden lg:block">
                <WorkspaceSplash />
            </div>

            <div className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
                <div className="w-full max-w-[24rem]">
                    {/* The mark leads on a phone, where the splash is gone and
                        nothing else says whose workspace this is. */}
                    <AppLogoIcon className="size-10 lg:hidden" />

                    <div className="mt-5 lg:mt-0">
                        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[1.5625rem]">
                            {title}
                        </h1>
                        {description ? (
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                {description}
                            </p>
                        ) : null}
                    </div>

                    <div className="mt-7">{children}</div>
                </div>
            </div>
        </div>
    );
}
