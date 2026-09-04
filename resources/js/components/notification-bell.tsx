import { router, usePage } from '@inertiajs/react';
import { useEchoNotification } from '@laravel/echo-react';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { read as readNotification, readAll } from '@/routes/notifications';
import type { AppNotification, SharedProps } from '@/types/shared';

const stamp = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
});

/**
 * The bell. What happened while you were not looking, newest first, and it
 * rings itself: Reverb pushes each notification the moment it is sent, so
 * the dot and the toast arrive without anyone refreshing anything.
 */
export function NotificationBell() {
    const { auth, notifications } = usePage<SharedProps>().props;

    /*
     | The private user channel, the same one Laravel's broadcast
     | notifications address by convention. On receipt: say it out loud, and
     | refetch just the bell's slice of props so the list is already right
     | when the dropdown opens.
     */
    useEchoNotification(
        `App.Models.User.${auth.user?.id}`,
        (incoming: { title?: string; body?: string }) => {
            toast.info(incoming.title ?? 'Notifikasi baru', {
                description: incoming.body,
            });
            router.reload({ only: ['notifications'] });
        },
    );

    const items = notifications?.items ?? [];
    const unread = notifications?.unread ?? 0;

    const open = (item: AppNotification) => {
        if (item.readAt) {
            router.visit(item.data.url);

            return;
        }

        router.post(
            readNotification(item.id).url,
            {},
            {
                preserveScroll: true,
                onSuccess: () => router.visit(item.data.url),
            },
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="relative grid size-9 place-items-center rounded-md bg-neutral-soft text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    <Bell
                        className="size-[1.125rem]"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                    <span className="sr-only">
                        Notifikasi
                        {unread > 0 ? ` — ${unread} belum dibaca` : ''}
                    </span>
                    {unread > 0 ? (
                        <span
                            className="absolute top-2 right-2 size-[0.4375rem] rounded-full bg-destructive ring-2 ring-neutral-soft"
                            aria-hidden
                        />
                    ) : null}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[22rem] p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <p className="text-[0.8438rem] font-extrabold tracking-[-0.01em]">
                        Notifikasi
                        {unread > 0 ? (
                            <span
                                className="ml-2 rounded-full bg-primary-soft px-1.5 py-px text-[0.6875rem] font-extrabold text-primary-deep"
                                data-numeric
                            >
                                {unread} baru
                            </span>
                        ) : null}
                    </p>
                    {unread > 0 ? (
                        <button
                            type="button"
                            onClick={() =>
                                router.post(
                                    readAll().url,
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                        >
                            <CheckCheck
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            Tandai dibaca
                        </button>
                    ) : null}
                </div>

                {items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
                        <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                            <Bell
                                className="size-4.5"
                                strokeWidth={1.75}
                                aria-hidden
                            />
                        </span>
                        <p className="text-sm font-bold">Belum ada kabar</p>
                        <p className="max-w-[30ch] text-xs leading-relaxed text-muted-foreground">
                            Catatan review dan perpindahan status dari rekan
                            akan muncul di sini, langsung saat terjadi.
                        </p>
                    </div>
                ) : (
                    <ul className="max-h-[24rem] overflow-y-auto py-1">
                        {items.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => open(item)}
                                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-neutral-soft"
                                >
                                    <span
                                        className={cn(
                                            'mt-1.5 size-2 shrink-0 rounded-full',
                                            item.readAt
                                                ? 'bg-transparent'
                                                : 'bg-primary',
                                        )}
                                        aria-hidden
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className={cn(
                                                'block text-[0.8438rem] leading-snug',
                                                item.readAt
                                                    ? 'font-semibold text-muted-foreground'
                                                    : 'font-bold',
                                            )}
                                        >
                                            {item.data.title}
                                        </span>
                                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                                            {item.data.body}
                                        </span>
                                        <span
                                            className="mt-0.5 block text-[0.6875rem] text-muted-foreground"
                                            data-numeric
                                        >
                                            {stamp.format(new Date(item.at))}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
