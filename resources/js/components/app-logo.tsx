import { usePage } from '@inertiajs/react';

import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-teal">
                <AppLogoIcon className="size-[1.125rem] fill-current" />
            </div>
            <div className="ml-1 grid flex-1 text-left">
                <span className="truncate text-[0.9375rem] leading-tight font-extrabold tracking-[-0.02em]">
                    {name}
                </span>
                <span className="truncate text-[0.6875rem] leading-tight text-muted-foreground">
                    Tim Digital Marketing
                </span>
            </div>
        </>
    );
}
