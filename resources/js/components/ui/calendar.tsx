import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { id } from 'react-day-picker/locale';

import { cn } from '@/lib/utils';

/**
 * Calendar, dressed in the project's own tokens rather than the library's
 * defaults: teal for selection, Hairline rules, the documented radius family.
 */
function Calendar({ className, classNames, ...props }: DayPickerProps) {
    return (
        <DayPicker
            locale={id}
            showOutsideDays
            className={cn('relative w-fit text-[0.8438rem]', className)}
            classNames={{
                months: 'flex flex-col gap-4 sm:flex-row',
                month: 'flex flex-col gap-3',
                month_caption:
                    'flex h-8 items-center justify-center px-8 font-bold',
                caption_label: 'text-[0.8438rem] font-bold capitalize',
                nav: 'flex items-center justify-between absolute inset-x-0 top-0 h-8 px-0',
                button_previous:
                    'grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground disabled:pointer-events-none disabled:opacity-30',
                button_next:
                    'grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-soft hover:text-foreground disabled:pointer-events-none disabled:opacity-30',
                month_grid: 'w-full border-collapse',
                weekdays: 'flex',
                weekday:
                    'w-9 text-[0.6875rem] font-bold tracking-[0.06em] text-muted-foreground uppercase',
                week: 'mt-1 flex w-full',
                day: 'relative size-9 p-0 text-center',
                day_button:
                    'size-9 rounded-md font-semibold tabular-nums transition-colors hover:bg-neutral-soft aria-selected:font-bold',
                selected:
                    'bg-primary-soft [&_button]:text-primary-deep [&_button]:hover:bg-primary-soft',
                range_start:
                    'rounded-l-md bg-primary [&_button]:text-primary-foreground [&_button]:hover:bg-primary',
                range_end:
                    'rounded-r-md bg-primary [&_button]:text-primary-foreground [&_button]:hover:bg-primary',
                range_middle: 'bg-primary-soft [&_button]:text-primary-deep',
                today: '[&_button]:underline [&_button]:decoration-primary [&_button]:decoration-2',
                outside: 'text-muted-foreground/50',
                disabled: 'pointer-events-none text-muted-foreground/40',
                hidden: 'invisible',
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation, ...rest }) =>
                    orientation === 'left' ? (
                        <ChevronLeft
                            className="size-4"
                            strokeWidth={2.5}
                            {...rest}
                        />
                    ) : (
                        <ChevronRight
                            className="size-4"
                            strokeWidth={2.5}
                            {...rest}
                        />
                    ),
            }}
            {...props}
        />
    );
}

export { Calendar };
