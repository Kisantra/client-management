import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import type { NavGroup } from '@/types';

/**
 * The rail's navigation.
 *
 * Teal in here means one thing and only one thing: this is the page you are
 * on. Hover is the quiet neutral instead, because a rail where the row under
 * the pointer looks exactly like the row you are standing on cannot answer
 * the only question it exists to answer.
 *
 * A section owns everything beneath it, so opening one lead, or the second
 * Performa page, or any Pengaturan tab, keeps its own row lit.
 */
export function NavMain({ groups = [] }: { groups: NavGroup[] }) {
    const { isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.label} className="px-2 py-0">
                    {/* A heading, not a banner. Uppercase with wide
                        tracking made every group announce itself as loudly as
                        the items under it; at this weight it names the group
                        and gets out of the way. */}
                    <SidebarGroupLabel className="h-5 px-2 text-xs font-semibold text-muted-foreground">
                        {group.label}
                    </SidebarGroupLabel>
                    <SidebarMenu className="gap-0.5">
                        {group.items.map((item) => {
                            const isActive = isCurrentOrParentUrl(
                                item.section ?? item.href,
                            );

                            return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive}
                                        tooltip={{ children: item.title }}
                                        className="h-9 text-[0.8438rem] font-medium data-[active=false]:hover:bg-neutral-soft data-[active=false]:hover:text-foreground data-[active=false]:active:bg-neutral-soft data-[active=true]:font-bold"
                                    >
                                        <Link href={item.href} prefetch>
                                            {item.icon && (
                                                <item.icon strokeWidth={1.75} />
                                            )}
                                            <span>{item.title}</span>
                                            {item.badge === undefined ? null : (
                                                /*
                                                 | A size, not an alarm. Every
                                                 | one of these counts says how
                                                 | much of something there is,
                                                 | and a filled pill is the
                                                 | shape for a figure that
                                                 | wants answering. Plain
                                                 | numerals on a shared right
                                                 | edge; the current row's take
                                                 | its ink, so the count is
                                                 | never louder than the row it
                                                 | belongs to.
                                                 */
                                                <span
                                                    className={cn(
                                                        'ml-auto text-xs font-semibold group-data-[collapsible=icon]:hidden',
                                                        isActive
                                                            ? 'text-current'
                                                            : 'text-muted-foreground',
                                                    )}
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
