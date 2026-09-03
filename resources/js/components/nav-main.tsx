import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import type { NavGroup, NavItem } from '@/types';

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
 *
 * An item with children is a shelf rather than a page: its row folds the
 * sub-nav open and shut, and the places inside it carry the links. It opens
 * itself when the section is the one being stood in.
 */
export function NavMain({ groups = [] }: { groups: NavGroup[] }) {
    const { isCurrentUrl, isCurrentOrParentUrl } = useCurrentUrl();

    /** A child with a section owns it; one without lights only on its page. */
    const childActive = (child: NavItem) =>
        child.section
            ? isCurrentOrParentUrl(child.section)
            : isCurrentUrl(child.href);

    const rowClass =
        'h-9 text-[0.8438rem] font-medium data-[active=false]:hover:bg-neutral-soft data-[active=false]:hover:text-foreground data-[active=false]:active:bg-neutral-soft data-[active=true]:font-bold';

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

                            if (item.children?.length) {
                                return (
                                    <Collapsible
                                        key={item.title}
                                        asChild
                                        defaultOpen={isActive}
                                        className="group/collapsible"
                                    >
                                        <SidebarMenuItem>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuButton
                                                    isActive={isActive}
                                                    tooltip={{
                                                        children: item.title,
                                                    }}
                                                    className={rowClass}
                                                >
                                                    {item.icon && (
                                                        <item.icon
                                                            strokeWidth={1.75}
                                                        />
                                                    )}
                                                    <span>{item.title}</span>
                                                    {item.badge ===
                                                    undefined ? null : (
                                                        <Count
                                                            value={item.badge}
                                                            active={isActive}
                                                            className="ml-auto"
                                                        />
                                                    )}
                                                    <ChevronRight
                                                        className={cn(
                                                            'size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90',
                                                            item.badge ===
                                                                undefined &&
                                                                'ml-auto',
                                                        )}
                                                        strokeWidth={2}
                                                        aria-hidden
                                                    />
                                                </SidebarMenuButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <SidebarMenuSub>
                                                    {item.children.map(
                                                        (child) => (
                                                            <SidebarMenuSubItem
                                                                key={
                                                                    child.title
                                                                }
                                                            >
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    isActive={childActive(
                                                                        child,
                                                                    )}
                                                                    className="h-8 text-[0.8438rem] font-medium data-[active=false]:hover:bg-neutral-soft data-[active=false]:hover:text-foreground data-[active=true]:font-bold"
                                                                >
                                                                    <Link
                                                                        href={
                                                                            child.href
                                                                        }
                                                                        prefetch
                                                                    >
                                                                        <span>
                                                                            {
                                                                                child.title
                                                                            }
                                                                        </span>
                                                                        {child.badge ===
                                                                        undefined ? null : (
                                                                            <Count
                                                                                value={
                                                                                    child.badge
                                                                                }
                                                                                active={childActive(
                                                                                    child,
                                                                                )}
                                                                                className="ml-auto"
                                                                            />
                                                                        )}
                                                                    </Link>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                        ),
                                                    )}
                                                </SidebarMenuSub>
                                            </CollapsibleContent>
                                        </SidebarMenuItem>
                                    </Collapsible>
                                );
                            }

                            return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive}
                                        tooltip={{ children: item.title }}
                                        className={rowClass}
                                    >
                                        <Link href={item.href} prefetch>
                                            {item.icon && (
                                                <item.icon strokeWidth={1.75} />
                                            )}
                                            <span>{item.title}</span>
                                            {item.badge === undefined ? null : (
                                                <Count
                                                    value={item.badge}
                                                    active={isActive}
                                                    className="ml-auto"
                                                />
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

/**
 * A size, not an alarm. Every one of these counts says how much of something
 * there is. Plain numerals on a shared right edge; the current row's take its
 * ink, so the count is never louder than the row it belongs to.
 */
function Count({
    value,
    active,
    className,
}: {
    value: number;
    active: boolean;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'text-xs font-semibold group-data-[collapsible=icon]:hidden',
                active ? 'text-current' : 'text-muted-foreground',
                className,
            )}
            data-numeric
        >
            {value}
        </span>
    );
}
