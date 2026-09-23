import { usePage } from '@inertiajs/react';
import {
    Briefcase,
    CalendarDays,
    ChartNoAxesColumn,
    LayoutGrid,
    FileText,
    History,
    Mail,
    Settings,
    Users,
    UsersRound,
} from 'lucide-react';
import { AppSwitcher } from '@/components/app-switcher';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
} from '@/components/ui/sidebar';
import {
    activity,
    clients,
    content,
    dashboard,
    leads,
    letters,
    performance,
    report,
    team,
} from '@/routes';
import {
    brief as contentBrief,
    ideas as contentIdeas,
    news as contentNews,
} from '@/routes/content';
import { templates as letterTemplates } from '@/routes/letters';
import { edit as editProfile } from '@/routes/profile';
import type { NavGroup, SharedProps } from '@/types';

/**
 * `counts` comes from the server on every page, so every badge on the rail
 * is a real total.
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
                    section: '/content',
                    children: [
                        { title: 'Kalender', href: content() },
                        {
                            title: 'Ide Konten',
                            href: contentIdeas(),
                            section: '/content/ide',
                            badge: counts?.ideas ?? 0,
                        },
                        {
                            title: 'Brief Harian',
                            href: contentBrief(),
                            section: '/content/brief',
                        },
                        {
                            title: 'Berita Terbaru',
                            href: contentNews(),
                            section: '/content/berita',
                        },
                    ],
                },
                {
                    title: 'Performa',
                    href: performance(),
                    icon: ChartNoAxesColumn,
                },
                {
                    title: 'Surat',
                    href: letters(),
                    icon: Mail,
                    // Drafts: what is begun and not yet sent.
                    badge: counts?.letters ?? 0,
                    section: '/surat',
                    children: [
                        { title: 'Daftar Surat', href: letters() },
                        {
                            title: 'Template',
                            href: letterTemplates(),
                            section: '/surat/template',
                        },
                    ],
                },
            ],
        },
        {
            label: 'Tim',
            items: [
                {
                    title: 'Laporan',
                    href: report(),
                    icon: FileText,
                },
                {
                    title: 'Aktivitas',
                    href: activity(),
                    icon: History,
                },
                {
                    title: 'Anggota',
                    href: team(),
                    icon: UsersRound,
                    badge: counts?.team ?? 0,
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
             | Three zones, each closed by a hairline: who this is (and the door to the
             | company's other apps), where you
             | can go, and who you are. The rail is taller than the list of
             | places, and without the rules the leftover space read as
             | something missing rather than as room to spare.
             */}
            <SidebarHeader className="border-b border-sidebar-border pb-2">
                <AppSwitcher />
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
