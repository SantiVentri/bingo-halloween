'use client'

import { useEffect } from "react";
import styles from "./Telon.module.css";

const MILISEGUNDOS_VISIBLE = 2600;

// Telón de sangre al completar el tablero: baja, BINGO golpea la pantalla y se levanta
// solo o al tocarlo. onTerminar tiene que ser estable: si cambia, se reinicia la espera
export default function Telon({ onTerminar }: { onTerminar: () => void }) {
    useEffect(() => {
        const temporizador = window.setTimeout(onTerminar, MILISEGUNDOS_VISIBLE);
        return () => window.clearTimeout(temporizador);
    }, [onTerminar]);

    return (
        <button type="button" className={styles.telon} onClick={onTerminar} aria-label="Tablero completo. Tocá para seguir">
            <span className={styles.bingo}>BINGO</span>
            <span className={styles.texto}>¡Tablero completo!</span>
        </button>
    );
}
