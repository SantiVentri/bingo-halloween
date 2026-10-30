'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./Confirmacion.module.css";

type ConfirmacionProps = {
    abierta: boolean;
    titulo: string;
    texto: ReactNode;
    // Texto del botón principal y el que muestra mientras trabaja
    accion: string;
    accionEnCurso: string;
    // Rojo para acciones destructivas
    peligro?: boolean;
    imagen?: string;
    onConfirmar: () => Promise<unknown> | void;
    onCerrar: () => void;
};

// Alerta de confirmación con el estilo del juego
export default function Confirmacion({
    abierta,
    titulo,
    texto,
    accion,
    accionEnCurso,
    peligro = false,
    imagen,
    onConfirmar,
    onCerrar,
}: ConfirmacionProps) {
    const dialogo = useRef<HTMLDialogElement>(null);
    const idTitulo = useId();
    const [trabajando, setTrabajando] = useState(false);

    useEffect(() => {
        const elemento = dialogo.current;
        if (!elemento) return;
        if (abierta && !elemento.open) elemento.showModal();
        if (!abierta && elemento.open) elemento.close();
    }, [abierta]);

    async function confirmar() {
        setTrabajando(true);
        await onConfirmar();
        setTrabajando(false);
        dialogo.current?.close();
    }

    return (
        <dialog
            ref={dialogo}
            className={styles.dialogo}
            onClose={onCerrar}
            onCancel={(evento) => {
                if (trabajando) evento.preventDefault();
            }}
            aria-labelledby={idTitulo}
        >
            {abierta && (
                <>
                    {imagen && (
                        // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local
                        <img src={imagen} alt="" className={styles.imagen} />
                    )}
                    <h2 id={idTitulo} className={styles.titulo}>{titulo}</h2>
                    <p className={styles.texto}>{texto}</p>
                    <div className={styles.botones}>
                        <button
                            type="button"
                            className={styles.cancelar}
                            onClick={() => dialogo.current?.close()}
                            disabled={trabajando}
                            autoFocus
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className={peligro ? `${styles.confirmar} ${styles.peligro}` : styles.confirmar}
                            onClick={confirmar}
                            disabled={trabajando}
                        >
                            {trabajando ? accionEnCurso : accion}
                        </button>
                    </div>
                </>
            )}
        </dialog>
    );
}
