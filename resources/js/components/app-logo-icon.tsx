import type { SVGAttributes } from 'react';

/**
 * Placeholder mark: three ascending columns with the newest one carried
 * forward, standing for the chain content -> lead -> active client.
 * Replace once the team supplies a real identity.
 */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4 14.5a1.5 1.5 0 0 1 3 0v5a1.5 1.5 0 0 1-3 0v-5Zm6.5-4a1.5 1.5 0 0 1 3 0v9a1.5 1.5 0 0 1-3 0v-9ZM18.5 3A1.5 1.5 0 0 0 17 4.5v15a1.5 1.5 0 0 0 3 0v-15A1.5 1.5 0 0 0 18.5 3Z"
            />
        </svg>
    );
}
