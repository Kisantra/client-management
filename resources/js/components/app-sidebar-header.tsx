import type { Bell } from 'lucide-react';
import { Mail, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NotificationBell } from '@/components/notification-bell';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

    return (
        <div className="shrink-0 border-b border-sidebar-border/70">
            <header className="flex h-16 items-center gap-3 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                    <SidebarTrigger className="-ml-1" />
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>

                <SearchField className="ml-2 hidden min-w-0 flex-1 md:flex md:max-w-[21rem]" />

                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setMobileSearchOpen((open) => !open)}
                        aria-expanded={mobileSearchOpen}
                        className="relative grid size-9 place-items-center rounded-md bg-neutral-soft text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
                    >
                        {mobileSearchOpen ? (
                            <X
                                className="size-[1.125rem]"
                                strokeWidth={1.75}
                                aria-hidden
                            />
                        ) : (
                            <Search
                                className="size-[1.125rem]"
                                strokeWidth={1.75}
                                aria-hidden
                            />
                        )}
                        <span className="sr-only">
                            {mobileSearchOpen
                                ? 'Tutup pencarian'
                                : 'Buka pencarian'}
                        </span>
                    </button>

                    <HeaderAction label="Pesan" icon={Mail} />
                    <NotificationBell />
                </div>
            </header>

            {mobileSearchOpen ? (
                <div className="border-t border-sidebar-border/70 px-4 py-3 md:hidden">
                    <SearchField className="flex w-full" autoFocus />
                </div>
            ) : null}
        </div>
    );
}

function SearchField({
    className,
    autoFocus = false,
}: {
    className?: string;
    autoFocus?: boolean;
}) {
    return (
        <label
            className={`items-center gap-2.5 rounded-md bg-neutral-soft px-3.5 py-2.5 text-muted-foreground transition-shadow focus-within:ring-2 focus-within:ring-ring/50 ${className ?? ''}`}
        >
            <Search
                className="size-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden
            />
            <span className="sr-only">Cari</span>
            <input
                type="search"
                autoFocus={autoFocus}
                placeholder="Cari lead, client, atau konten…"
                className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-[0.8438rem]"
            />
        </label>
    );
}

function HeaderAction({
    label,
    icon: Icon,
    unread = false,
}: {
    label: string;
    icon: typeof Bell;
    unread?: boolean;
}) {
    return (
        <button
            type="button"
            className="relative grid size-9 place-items-center rounded-md bg-neutral-soft text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
            <Icon className="size-[1.125rem]" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">
                {label}
                {unread ? ' — ada yang belum dibaca' : ''}
            </span>
            {unread ? (
                <span
                    className="absolute top-2 right-2 size-[0.4375rem] rounded-full bg-destructive ring-2 ring-neutral-soft"
                    aria-hidden
                />
            ) : null}
        </button>
    );
}
