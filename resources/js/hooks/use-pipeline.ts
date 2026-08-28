import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import type { SharedPipeline, StageRequirement } from '@/types/shared';
import type { SharedProps } from '@/types/shared';

export function usePipeline(): SharedPipeline {
    return usePage<SharedProps>().props.pipeline;
}

/** Stage key to label, for the many places that hold only the key. */
export function useStageLabels(): Record<string, string> {
    const { stages } = usePipeline();

    return useMemo(
        () =>
            Object.fromEntries(stages.map((stage) => [stage.key, stage.label])),
        [stages],
    );
}

/** The reasons a lead can be closed, as the form needs them. */
export function useCloseReasons(): {
    key: string;
    label: string;
    hint: string;
}[] {
    const { closeReasons } = usePipeline();

    return useMemo(
        () =>
            Object.entries(closeReasons).map(([key, reason]) => ({
                key,
                ...reason,
            })),
        [closeReasons],
    );
}

/**
 * What a stage cannot be entered without.
 *
 * The server enforces the same rule from config/pipeline.php; this only decides
 * what the screen offers, so the two can never drift apart.
 */
export function useStageRequirement(): (
    stage: string,
) => StageRequirement | undefined {
    const { requirements } = usePipeline();

    return useMemo(
        () => (stage: string) => requirements[stage],
        [requirements],
    );
}
