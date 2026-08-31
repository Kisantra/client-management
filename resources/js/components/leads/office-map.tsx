import { MapPin } from 'lucide-react';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type OfficePoint = { lat: number; lng: number } | null;

type Props = {
    point: OfficePoint;
    onChange: (point: OfficePoint) => void;
    /** Detail view: the pin is shown, not edited. */
    readOnly?: boolean;
    className?: string;
};

/*
 | Leaflet touches `window` as soon as it is imported, which is fatal under
 | server-side rendering. The real map lives in office-map-leaflet.tsx and is
 | fetched only once this component is running in a browser; the server, and
 | the first client paint, get a frame of the same size instead.
 */
const LeafletMap = lazy(() => import('./office-map-leaflet'));

const subscribe = () => () => {};

/** True in the browser after hydration, false on the server and during it. */
function useIsClient(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
}

export function OfficeMap(props: Props) {
    const client = useIsClient();
    const frame = (
        <MapFrame readOnly={props.readOnly} className={props.className} />
    );

    if (!client) {
        return frame;
    }

    return (
        <Suspense fallback={frame}>
            <LeafletMap {...(props as ComponentProps<typeof LeafletMap>)} />
        </Suspense>
    );
}

/** The map's footprint while the map is not here yet, so nothing jumps. */
function MapFrame({
    readOnly = false,
    className,
}: {
    readOnly?: boolean;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <div
                className={cn(
                    'grid place-items-center overflow-hidden rounded-lg border border-border bg-neutral-soft/60',
                    readOnly ? 'h-56' : 'h-72 sm:h-[28rem]',
                )}
                aria-busy
                aria-label="Peta sedang dimuat"
            >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <MapPin className="size-3.5" strokeWidth={2} aria-hidden />
                    Memuat peta…
                </span>
            </div>
        </div>
    );
}
