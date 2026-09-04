import { Link } from '@inertiajs/react';
import { Check, ChevronsUpDown, ExternalLink } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import AppLogoIcon from '@/components/app-logo-icon';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';

/**
 * The company's other systems, one hop away. Each opens in its own tab: the
 * ERP suite is separate sites with separate sessions, and switching should
 * never cost this app its open work.
 */
const APPS: {
    name: string;
    /** Where the jump lands, spelled out so nobody guesses. */
    caption: string;
    url: string;
    /** The sister site's logo tile: the shared mark on its own base colour. */
    tile: string;
}[] = [
    {
        name: 'Project Management',
        caption: 'dev.kisantra.com',
        url: 'https://dev.kisantra.com/',
        tile: 'bg-brand-project',
    },
    {
        name: 'Attendance',
        caption: 'attendance.kisantra.com',
        url: 'https://attendance.kisantra.com',
        tile: 'bg-brand-attendance',
    },
];

/**
 * The logo block doubles as the way between apps: click it and pick where to
 * go. Its old job — back to the dashboard — survives as the first entry, so
 * the reflex of clicking the logo to go home still works.
 */
export function AppSwitcher() {
    const { state } = useSidebar();
    const isMobile = useIsMobile();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="hover:bg-neutral-soft hover:text-foreground data-[state=open]:bg-neutral-soft"
                            aria-label="Pindah aplikasi"
                        >
                            <AppLogo />
                            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
                        align="start"
                        side={
                            isMobile
                                ? 'bottom'
                                : state === 'collapsed'
                                  ? 'right'
                                  : 'bottom'
                        }
                    >
                        <DropdownMenuLabel className="text-[0.6875rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                            Aplikasi perusahaan
                        </DropdownMenuLabel>

                        <DropdownMenuItem asChild>
                            <Link
                                href={dashboard()}
                                prefetch
                                className="flex items-center gap-2.5"
                            >
                                <AppLogoIcon className="size-8 shrink-0" />
                                <AppRow
                                    name="Client Management"
                                    caption="Aplikasi ini"
                                />
                                <Check
                                    className="ml-auto size-4 text-primary"
                                    aria-hidden
                                />
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {APPS.map((app) => (
                            <DropdownMenuItem key={app.url} asChild>
                                <a
                                    href={app.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2.5"
                                >
                                    <AppLogoIcon
                                        className={cn('size-8', app.tile)}
                                    />
                                    <AppRow
                                        name={app.name}
                                        caption={app.caption}
                                    />
                                    <ExternalLink
                                        className="ml-auto size-3.5 text-muted-foreground"
                                        aria-hidden
                                    />
                                </a>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function AppRow({ name, caption }: { name: string; caption: string }) {
    return (
        <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-[0.8438rem] font-bold">{name}</span>
            <span className="truncate text-[0.6875rem] text-muted-foreground">
                {caption}
            </span>
        </span>
    );
}
