import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Previous / "3 / 21" / next, the way every paged list on the site turns. */
export function ListPager({
    current,
    last,
    onPage,
}: {
    current: number;
    last: number;
    onPage: (page: number) => void;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <PageButton
                onClick={() => onPage(current - 1)}
                disabled={current <= 1}
                label="Halaman sebelumnya"
            >
                <ChevronLeft className="size-4" strokeWidth={2.5} />
            </PageButton>
            <span className="px-1 font-semibold" data-numeric>
                {current} / {last}
            </span>
            <PageButton
                onClick={() => onPage(current + 1)}
                disabled={current >= last}
                label="Halaman berikutnya"
            >
                <ChevronRight className="size-4" strokeWidth={2.5} />
            </PageButton>
        </div>
    );
}

function PageButton({
    children,
    onClick,
    disabled,
    label,
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled: boolean;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="grid size-9 place-items-center rounded-md bg-neutral-soft text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
        >
            {children}
            <span className="sr-only">{label}</span>
        </button>
    );
}
