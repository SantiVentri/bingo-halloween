import type { ReactNode } from "react";
import styles from "./PantallaMensaje.module.css";

type PantallaMensajeProps = {
    icono: ReactNode;
    titulo: string;
    texto: string;
    accion: ReactNode;
};

// Pantalla de estado: sin jugador, tablero incompleto, tablero ya cerrado
export default function PantallaMensaje({ icono, titulo, texto, accion }: PantallaMensajeProps) {
    return (
        <div className={styles.pantalla}>
            <span className={styles.icono} aria-hidden="true">{icono}</span>
            <h1 className={styles.titulo}>{titulo}</h1>
            <p className={styles.texto}>{texto}</p>
            {accion}
        </div>
    );
}
