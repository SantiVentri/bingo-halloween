import type { InputHTMLAttributes } from "react";
import styles from "./Campo.module.css";

type CampoProps = {
    etiqueta: string;
    // Para códigos: letra de ancho fijo
    mono?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

// Campo de texto con su etiqueta: el mismo en todos los formularios
export default function Campo({ etiqueta, mono = false, ...resto }: CampoProps) {
    return (
        <label className={styles.campo}>
            <span className={styles.etiqueta}>{etiqueta}</span>
            <input className={mono ? `${styles.input} ${styles.mono}` : styles.input} {...resto} />
        </label>
    );
}
