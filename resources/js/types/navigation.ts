import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

export type BreadcrumbItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
};

export type NavItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
    /** Count shown at the trailing edge of the nav row. */
    badge?: number;
    /**
     * The path this item owns, when it is not the one it links to. Leads
     * links to /leads and owns everything under it, so it needs nothing here;
     * Pengaturan links to /settings/profile but owns all of /settings, and
     * without this it would go dark the moment anyone opened Security.
     */
    section?: string;
    /**
     * A sub-nav. The item itself becomes the section's toggle, and these
     * are the places inside it. A child with a `section` owns that path and
     * everything under it; one without lights only on its exact page.
     */
    children?: NavItem[];
};

export type NavGroup = {
    label: string;
    items: NavItem[];
};
