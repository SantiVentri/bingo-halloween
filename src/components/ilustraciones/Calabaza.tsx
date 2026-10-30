import type { CSSProperties } from "react";

// Calabaza tallada: toma el color del texto (currentColor)
export default function Calabaza({ className, style }: { className?: string; style?: CSSProperties }) {
    return (
        <svg className={className} style={style} viewBox="0 0 60 60" aria-hidden="true">
            <rect x="27" y="3" width="7" height="11" fill="currentColor" />
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M30 12C12 10 3 22 3 35s12 22 27 22 27-9 27-22S48 10 30 12zM14 28l10 5-10 3zM46 28l-10 5 10 3zM13 42q17 11 34 0l-5 7-4-4-4 5-4-5-4 5-4-5-4 4z"
            />
        </svg>
    );
}
