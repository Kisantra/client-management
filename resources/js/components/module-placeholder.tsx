import { Head } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

type Props = {
    title: string;
    icon: LucideIcon;
    description: string;
    /** What this module will hold once it is built. */
    planned: string[];
};

export function ModulePlaceholder({
    title,
    icon: Icon,
    description,
    planned,
}: Props) {
    return (
        <>
            <Head title={title} />

            <div className="animate-settle flex flex-1 items-start justify-center p-4 sm:p-6">
                <section className="w-full max-w-xl rounded-xl border border-border bg-card p-7 shadow-lift sm:p-9">
                    <span className="grid size-12 place-items-center rounded-lg bg-primary-soft text-primary-deep">
                        <Icon
                            className="size-6"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    </span>

                    <h1 className="mt-5 text-xl font-extrabold tracking-[-0.02em]">
                        {title}
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {description}
                    </p>

                    <h2 className="mt-7 mb-3 text-[0.6875rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                        Yang akan ada di sini
                    </h2>
                    <ul className="flex flex-col gap-2.5">
                        {planned.map((item) => (
                            <li
                                key={item}
                                className="flex items-start gap-2.5 text-[0.8438rem] leading-relaxed"
                            >
                                <span
                                    className="mt-[0.4375rem] size-1.5 shrink-0 rounded-full bg-primary"
                                    aria-hidden
                                />
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </>
    );
}
