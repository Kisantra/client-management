import { team } from '@/data/dashboard';
import { cn } from '@/lib/utils';

export function TeamLoad() {
    return (
        <ul className="flex flex-col gap-3.5">
            {team.map((member) => {
                const over = member.assigned > member.capacity;
                const slots = Math.max(member.assigned, member.capacity);

                return (
                    <li key={member.name} className="flex items-center gap-3">
                        <span
                            className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-soft text-xs font-extrabold text-secondary-foreground"
                            aria-hidden
                        >
                            {member.initials}
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold">
                                {member.name}
                            </span>
                            <span
                                className={cn(
                                    'block text-xs',
                                    over
                                        ? 'font-semibold text-destructive'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {member.assigned} tugas
                                {over
                                    ? ` — kelebihan ${member.assigned - member.capacity}`
                                    : member.assigned <= member.capacity / 2
                                      ? ' — masih longgar'
                                      : ''}
                            </span>
                        </span>

                        <span
                            className="flex shrink-0 gap-[3px]"
                            role="img"
                            aria-label={`${member.assigned} dari kapasitas ${member.capacity} tugas`}
                        >
                            {Array.from({ length: slots }, (_, slot) => (
                                <span
                                    key={slot}
                                    className={cn(
                                        'h-[1.125rem] w-[0.5625rem] rounded-sm',
                                        slot >= member.capacity
                                            ? 'bg-destructive'
                                            : slot < member.assigned
                                              ? 'bg-secondary-foreground'
                                              : 'bg-neutral-soft',
                                    )}
                                />
                            ))}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
