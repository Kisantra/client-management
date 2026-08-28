import { cn } from '@/lib/utils';

/**
 * The figure's own shape, drawn from real series data.
 *
 * Nothing here is ornament: each mark plots values the tile is actually about,
 * so removing it would remove information rather than decoration.
 */

export function MiniBars({
    values,
    barClassName,
    className,
    label,
}: {
    values: number[];
    barClassName: string;
    className?: string;
    label: string;
}) {
    const max = Math.max(...values);

    return (
        <span
            className={cn('flex h-10 items-end gap-1', className)}
            role="img"
            aria-label={label}
        >
            {values.map((value, index) => (
                <span
                    key={index}
                    className={cn('w-1.5 rounded-full', barClassName)}
                    style={{
                        height: `${Math.max((value / max) * 100, 14)}%`,
                    }}
                />
            ))}
        </span>
    );
}

export function MiniLine({
    values,
    strokeClassName,
    fillClassName,
    className,
    label,
}: {
    values: number[];
    strokeClassName: string;
    fillClassName: string;
    className?: string;
    label: string;
}) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const width = 54;
    const height = 34;
    const points = values.map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - 3 - ((value - min) / span) * (height - 8);

        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const last = points[points.length - 1].split(',');

    return (
        <span className={cn('block', className)} role="img" aria-label={label}>
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                fill="none"
                aria-hidden
            >
                <polygon
                    points={`0,${height} ${points.join(' ')} ${width},${height}`}
                    className={fillClassName}
                />
                <polyline
                    points={points.join(' ')}
                    className={strokeClassName}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <circle
                    cx={last[0]}
                    cy={last[1]}
                    r="2.6"
                    className={strokeClassName}
                    fill="currentColor"
                    stroke="none"
                />
            </svg>
        </span>
    );
}

export function MiniRing({
    value,
    max,
    trackClassName,
    arcClassName,
    className,
    label,
}: {
    value: number;
    max: number;
    trackClassName: string;
    arcClassName: string;
    className?: string;
    label: string;
}) {
    const size = 40;
    const stroke = 6;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const filled = Math.min(value / max, 1) * circumference;

    return (
        <span className={cn('block', className)} role="img" aria-label={label}>
            <svg width={size} height={size} aria-hidden>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={stroke}
                    className={trackClassName}
                    fill="none"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${circumference}`}
                    className={arcClassName}
                    fill="none"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
        </span>
    );
}
