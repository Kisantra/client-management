import { Link, usePage } from '@inertiajs/react';
import {
    Briefcase,
    CalendarDays,
    ChartNoAxesColumn,
    LayoutGrid,
    ListChecks,
    Settings,
    Users,
    UsersRound,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { navCounts } from '@/data/dashboard';
import {
    clients,
    content,
    dashboard,
    leads,
    performance,
    tasks,
    team,
} from '@/routes';
import { edit as editProfile } from '@/routes/profile';
import type { NavGroup, SharedProps } from '@/types';

/**
 * `counts` comes from the server on every page, so the Leads, Client and
 * Konten badges are the real totals; the rest are still sample figures from
 * modules that do not exist yet.
 */
function buildNav(counts: SharedProps['counts']): NavGroup[] {
    return [
        {
            label: 'Menu',
            items: [
                { title: 'Dashboard', href: dashboard(), icon: LayoutGrid },
                {
                    title: 'Leads',
                    href: leads(),
                    icon: Users,
                    badge: counts?.leads ?? 0,
                },
                {
                    title: 'Client',
                    href: clients(),
                    icon: Briefcase,
                    badge: counts?.clients ?? 0,
                },
                {
                    title: 'Konten',
                    href: content(),
                    icon: CalendarDays,
                    badge: counts?.content ?? 0,
                },
                {
                    title: 'Performa',
                    href: performance(),
                    icon: ChartNoAxesColumn,
                },
            ],
        },
        {
            label: 'Tim',
            items: [
                {
                    title: 'Task',
                    href: tasks(),
                    icon: ListChecks,
                    badge: navCounts.tasks,
                },
                {
                    title: 'Anggota',
                    href: team(),
                    icon: UsersRound,
                    badge: navCounts.team,
                },
                {
                    title: 'Pengaturan',
                    href: editProfile(),
                    icon: Settings,
                    section: '/settings',
                },
            ],
        },
    ];
}

export function AppSidebar() {
    const { counts } = usePage<SharedProps>().props;
    const navGroups = buildNav(counts);

    return (
        <Sidebar collapsible="icon" variant="inset">
            {/*
             | Three zones, each closed by a hairline: who this is, where you
             | can go, and who you are. The rail is taller than the list of
             | places, and without the rules the leftover space read as
             | something missing rather than as room to spare.
             */}
            <SidebarHeader className="border-b border-sidebar-border pb-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            className="hover:bg-neutral-soft hover:text-foreground active:bg-neutral-soft"
                        >
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-5 pt-2">
                <NavMain groups={navGroups} />
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border pt-2">
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
