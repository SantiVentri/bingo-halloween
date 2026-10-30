'use client'

import { useRef } from "react";
import styles from "./MiCodigo.module.css";
import CodigoRecuperacion from "@/components/CodigoRecuperacion";

type MiCodigoProps = {
    codigo: string;
};

// Botón del tablero que abre el código de recuperación en un diálogo
export default function MiCodigo({ codigo }: MiCodigoProps) {
    const dialogo = useRef<HTMLDialogElement>(null);

    return (
        <>
            <button type="button" className={styles.abrir} onClick={() => dialogo.current?.showModal()}>
                Mi código
            </button>
            <dialog ref={dialogo} className={styles.dialogo} closedby="any">
                <h2 className={styles.titulo}>Tu código de recuperación</h2>
                <CodigoRecuperacion codigo={codigo} />
                <button type="button" className={styles.cerrar} onClick={() => dialogo.current?.close()}>
                    Cerrar
                </button>
            </dialog>
        </>
    );
}
