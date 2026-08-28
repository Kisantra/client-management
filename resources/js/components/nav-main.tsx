import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavGroup } from '@/types';

export function NavMain({ groups = [] }: { groups: NavGroup[] }) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.label} className="px-2 py-0">
                    <SidebarGroupLabel className="text-[0.6563rem] font-bold tracking-[0.13em] text-muted-foreground uppercase">
                        {group.label}
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {group.items.map((item) => {
                            const isActive = isCurrentUrl(item.href);

                            return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive}
                                        tooltip={{ children: item.title }}
                                        className="h-10 font-semibold"
                                    >
                                        <Link href={item.href} prefetch>
                                            {item.icon && (
                                                <item.icon strokeWidth={1.75} />
                                            )}
                                            <span>{item.title}</span>
                                            {item.badge === undefined ? null : (
                                                <span
                                                    className={
                                                        isActive
                                                            ? 'ml-auto rounded-full bg-primary px-2 py-px text-[0.6875rem] font-extrabold text-primary-foreground group-data-[collapsible=icon]:hidden'
                                                            : 'ml-auto rounded-full bg-neutral-soft px-2 py-px text-[0.6875rem] font-extrabold text-muted-foreground group-data-[collapsible=icon]:hidden'
                                                    }
                                                    data-numeric
                                                >
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    );
}
