import type { ReactNode } from "react";
import styles from "./MarcoGrilla.module.css";

const GOTAS = ["gota1", "gota2", "gota3", "gota4", "gota5", "gota6"];

// Marco rojo irregular de la grilla, con gotas que caen por debajo. Es un cuadrado:
// el más grande que entre en el alto disponible. Las medidas en cqw de adentro son
// relativas a su ancho
export default function MarcoGrilla({ children }: { children?: ReactNode }) {
    return (
        <div className={styles.escenario}>
            <div className={styles.grilla}>
                {children}
                <svg className={styles.marco} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path
                        vectorEffect="non-scaling-stroke"
                        d="M1 1.5L18 .8 37 1.6 58 .7 79 1.5 99 .9 99.4 20 98.7 41 99.5 63 98.8 82 99.2 99.2 80 98.6 61 99.4 39 98.7 20 99.5.8 98.9 1.5 78 .7 57 1.6 36 .8 17z"
                    />
                </svg>
                {GOTAS.map((gota) => (
                    <span key={gota} className={`${styles.gota} ${styles[gota]}`} aria-hidden="true" />
                ))}
            </div>
        </div>
    );
}
