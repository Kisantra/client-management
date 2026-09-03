import { usePage } from '@inertiajs/react';

import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <>
            <AppLogoIcon className="size-8 shadow-teal" />
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
