import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, X } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { cn } from '@/lib/utils';

export type OfficePoint = { lat: number; lng: number } | null;

/** Samarinda: where the firm works, so the map opens on home ground. */
const DEFAULT_CENTER: [number, number] = [-0.5022, 117.1536];
const DEFAULT_ZOOM = 12;

/**
 * The pin is drawn here rather than using Leaflet's bundled PNG: the default
 * marker breaks under bundlers and would be the only element on the page
 * outside the design system.
 */
const pin = L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    html: `
        <svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M14 35C14 35 26 22.6 26 14A12 12 0 1 0 2 14c0 8.6 12 21 12 21Z"
                  fill="var(--primary)" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
            <circle cx="14" cy="14" r="4.4" fill="white"/>
        </svg>
    `,
});

function ClickToPlace({ onPick }: { onPick: (point: OfficePoint) => void }) {
    useMapEvents({
        click: (event) => {
            onPick({
                lat: Number(event.latlng.lat.toFixed(6)),
                lng: Number(event.latlng.lng.toFixed(6)),
            });
        },
    });

    return null;
}

/**
 * The map itself. Leaflet reads `window` the moment it is imported, so this
 * file is only ever loaded in the browser, through office-map.tsx.
 */
export default function OfficeMapLeaflet({
    point,
    onChange,
    readOnly = false,
    className,
}: {
    point: OfficePoint;
    onChange: (point: OfficePoint) => void;
    /** Detail view: the pin is shown, not edited. */
    readOnly?: boolean;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {/* isolate: Leaflet's panes climb to z-index 400+, and without their
                own stacking context they would paint over portalled popovers. */}
            <div
                className={cn(
                    'relative isolate z-0 overflow-hidden rounded-lg border border-border',
                    readOnly ? 'h-56' : 'h-80 sm:h-[28rem]',
                )}
            >
                <MapContainer
                    center={point ? [point.lat, point.lng] : DEFAULT_CENTER}
                    zoom={point ? 16 : DEFAULT_ZOOM}
                    scrollWheelZoom={false}
                    /* Credited below the map instead: on a phone Leaflet's own
                       attribution box sat under the placement hint. */
                    attributionControl={false}
                    className="size-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maxZoom={19}
                    />
                    {readOnly ? null : <ClickToPlace onPick={onChange} />}
                    {point ? (
                        <Marker
                            position={[point.lat, point.lng]}
                            icon={pin}
                            draggable={!readOnly}
                            autoPan
                            eventHandlers={{
                                dragend: (event) => {
                                    const next = event.target.getLatLng();

                                    onChange({
                                        lat: Number(next.lat.toFixed(6)),
                                        lng: Number(next.lng.toFixed(6)),
                                    });
                                },
                            }}
                        />
                    ) : null}
                </MapContainer>

                {point || readOnly ? null : (
                    <p className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex items-center justify-center gap-1.5 bg-card/90 py-2 text-xs font-semibold text-secondary-foreground">
                        <Crosshair
                            className="size-3.5"
                            strokeWidth={2.5}
                            aria-hidden
                        />
                        Klik atau ketuk peta untuk menandai lokasi kantor
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {readOnly ? null : point ? (
                    <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 font-bold text-primary-deep">
                            <MapPin
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            <span data-numeric>
                                {point.lat}, {point.lng}
                            </span>
                        </span>
                        <span className="text-muted-foreground">
                            Seret pin untuk menggeser.
                        </span>
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-bold text-muted-foreground transition-colors hover:text-destructive"
                        >
                            <X
                                className="size-3.5"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                            Hapus titik
                        </button>
                    </>
                ) : (
                    <span className="text-muted-foreground">
                        Belum ada titik. Klik lokasinya di peta, lalu geser pin
                        kalau perlu digeser sedikit.
                    </span>
                )}
                <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[0.6875rem] text-muted-foreground underline decoration-transparent underline-offset-4 transition-colors hover:text-primary-deep hover:decoration-current"
                >
                    © OpenStreetMap
                </a>
            </div>
        </div>
    );
}
