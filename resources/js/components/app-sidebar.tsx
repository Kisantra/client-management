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
 * `counts` comes from the server on every page, so the Leads and Client badges
 * are the real totals; the rest are still sample figures from modules that do
 * not exist yet.
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
                    badge: navCounts.content,
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
                { title: 'Pengaturan', href: editProfile(), icon: Settings },
            ],
        },
    ];
}

export function AppSidebar() {
    const { counts } = usePage<SharedProps>().props;
    const navGroups = buildNav(counts);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-4">
                <NavMain groups={navGroups} />
            </SidebarContent>

            <SidebarFooter>
                <IntegrationCard />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

function IntegrationCard() {
    return (
        <div className="mx-2 mb-1 rounded-lg bg-ink-panel p-4 text-ink-panel-foreground group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-bold">Hubungkan Meta &amp; GA4</p>
            <p className="mt-1 mb-3 text-xs leading-relaxed text-ink-panel-foreground/70">
                Tarik metrik otomatis, berhenti input manual.
            </p>
            <Link
                href={performance()}
                className="block rounded-md bg-primary px-3 py-2 text-center text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-deep"
            >
                Hubungkan sekarang
            </Link>
        </div>
    );
}
