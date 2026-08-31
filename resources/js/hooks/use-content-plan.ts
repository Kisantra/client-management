import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import type { SharedContent, SharedProps } from '@/types/shared';

/** config/content.php as the server shares it: channels, formats, statuses. */
export function useContentPlan(): SharedContent {
    return usePage<SharedProps>().props.contentPlan;
}

/** Status key to label, for the many places that hold only the key. */
export function useContentStatusLabels(): Record<string, string> {
    const { statuses } = useContentPlan();

    return useMemo(
        () =>
            Object.fromEntries(
                statuses.map((status) => [status.key, status.label]),
            ),
        [statuses],
    );
}
