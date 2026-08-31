import { ArrowDown, ArrowUp } from 'lucide-react';

/**
 * A column head that is also the sort control, so the table and the toolbar's
 * "Urutkan" select stay in step. Put `group/head` on the header row so the
 * idle arrow can show on hover.
 */
export function SortHead<T extends string>({
    label,
    column,
    sort,
    onSort,
    align = 'left',
}: {
    label: string;
    column: T;
    sort: T;
    onSort: (sort: T) => void;
    align?: 'left' | 'right';
}) {
    const active = sort === column;

    return (
        <th
            scope="col"
            aria-sort={active ? 'descending' : 'none'}
            className={align === 'right' ? 'text-right' : 'text-left'}
        >
            <button
                type="button"
                onClick={() => onSort(column)}
                className={`flex w-full items-center gap-1 py-3 pr-4 font-bold uppercase transition-colors hover:text-foreground ${
                    align === 'right' ? 'justify-end' : ''
                } ${active ? 'text-foreground' : ''}`}
            >
                {label}
                {active ? (
                    <ArrowDown className="size-3" strokeWidth={3} aria-hidden />
                ) : (
                    <ArrowUp
                        className="size-3 opacity-0 transition-opacity group-hover/head:opacity-40"
                        strokeWidth={3}
                        aria-hidden
                    />
                )}
            </button>
        </th>
    );
}
