import type { CSSProperties } from "react";

// Calabaza tallada de un solo color (currentColor): la cara deja ver el fondo
export default function Calabaza({ className, style }: { className?: string; style?: CSSProperties }) {
    return (
        <svg className={className} style={style} viewBox="0 0 60 60" aria-hidden="true">
            <path fill="currentColor" d="M26 14c1-4 1-7-1-10 2-2 6-3 8-2-1 1-1 3 0 5 1 3 2 5 3 7-3 2-7 2-10 0z" />
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M30 13C27 10 19 10 14 13 6 16 2 25 2 36c0 11 7 20 16 20 4 1 8 0 12 0s8 1 12 0c9 0 16-9 16-20 0-11-4-20-12-23-5-3-13-3-16 0zM12 22l15 12-11 3zM48 22L33 34l11 3zM30 33l-3 6h6zM9 40l7 3 3-3 5 4 6-4 6 4 5-4 3 3 7-3c-1 8-6 13-11 14l-3-3-5 4-5-4-5 4-3-3C15 53 10 48 9 40z"
            />
        </svg>
    );
}
