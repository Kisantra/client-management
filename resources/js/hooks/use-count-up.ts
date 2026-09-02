import { useEffect, useState } from 'react';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts a figure up to its value once, on mount.
 *
 * The figure is the reveal, so the motion belongs to it. Under
 * `prefers-reduced-motion` the value is simply there from the first frame.
 * Rendering is client-only in this app, so starting at zero costs no hydration
 * mismatch.
 */
export function useCountUp(
    target: number,
    delay = 0,
    duration = 900,
    /** Decimals to keep while counting. A rate would otherwise sit at 0. */
    precision = 0,
) {
    const [reduced] = useState(prefersReducedMotion);
    const [value, setValue] = useState(() => (reduced ? target : 0));

    useEffect(() => {
        if (reduced) {
            return;
        }

        let frame = 0;
        let startedAt = 0;

        const tick = (now: number) => {
            if (startedAt === 0) {
                startedAt = now;
            }

            const progress = Math.min((now - startedAt) / duration, 1);
            // Exponential ease-out: fast arrival, quiet settle.
            const eased = 1 - Math.pow(1 - progress, 3);

            setValue(Number((target * eased).toFixed(precision)));

            if (progress < 1) {
                frame = requestAnimationFrame(tick);
            }
        };

        const timer = window.setTimeout(() => {
            frame = requestAnimationFrame(tick);
        }, delay);

        /**
         * rAF is throttled in background tabs and on starved machines, which
         * would leave a wrong figure on screen. The figure's correctness never
         * depends on the animation finishing.
         */
        const settle = window.setTimeout(
            () => {
                cancelAnimationFrame(frame);
                setValue(target);
            },
            delay + duration + 120,
        );

        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(settle);
            cancelAnimationFrame(frame);
        };
    }, [target, delay, duration, precision, reduced]);

    return reduced ? target : value;
}
