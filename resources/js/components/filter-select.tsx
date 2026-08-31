import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * A toolbar filter: the project's shadcn Select in the outlined, lifted shape
 * every list control shares. Full-width on a phone, where the toolbar is a
 * two-column grid, and content-width beside its neighbours from `sm`.
 */
export function FilterSelect({
    label,
    value,
    onChange,
    options,
    className,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    className?: string;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger
                aria-label={label}
                className={cn(
                    'h-auto w-full rounded-md border-border bg-card py-2.5 text-[0.8438rem] font-semibold text-secondary-foreground shadow-lift transition-colors hover:border-primary/35 focus-visible:ring-[3px] data-[state=open]:border-primary/40 sm:w-auto',
                    className,
                )}
            >
                <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-[0.8438rem]"
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
