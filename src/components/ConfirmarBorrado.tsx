'use client'

import { useEffect, useRef, useState } from "react";
import styles from "./ConfirmarBorrado.module.css";
import type { Foto } from "@/lib/fotos";

type ConfirmarBorradoProps = {
    foto: Foto | null;
    // Cuántas fotos tiene la celda, contando la que se va a borrar
    fotosEnCelda: number;
    urlDeFoto: (foto: Foto) => string;
    onConfirmar: (foto: Foto) => Promise<boolean>;
    onCerrar: () => void;
};

// Alerta antes de borrar la última foto de una celda (RF-14)
export default function ConfirmarBorrado({ foto, fotosEnCelda, urlDeFoto, onConfirmar, onCerrar }: ConfirmarBorradoProps) {
    const dialogo = useRef<HTMLDialogElement>(null);
    const [borrando, setBorrando] = useState(false);

    useEffect(() => {
        const elemento = dialogo.current;
        if (!elemento) return;
        if (foto && !elemento.open) elemento.showModal();
        if (!foto && elemento.open) elemento.close();
    }, [foto]);

    async function borrar() {
        if (!foto) return;
        setBorrando(true);
        // Si falla, el aviso de error se ve en el tablero al cerrar
        await onConfirmar(foto);
        setBorrando(false);
        dialogo.current?.close();
    }

    const quedan = fotosEnCelda - 1;

    return (
        <dialog
            ref={dialogo}
            className={styles.dialogo}
            onClose={onCerrar}
            onCancel={(evento) => {
                if (borrando) evento.preventDefault();
            }}
            aria-labelledby="titulo-borrar"
        >
            {foto && (
                <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local */}
                    <img src={urlDeFoto(foto)} alt="" className={styles.imagen} />
                    <h2 id="titulo-borrar" className={styles.titulo}>
                        ¿Borrar la última foto de {foto.categoria}?
                    </h2>
                    <p className={styles.texto}>
                        {quedan === 0
                            ? "Era la única foto: la celda va a quedar vacía."
                            : `Le ${quedan === 1 ? "queda 1 foto" : `quedan ${quedan} fotos`} a esta celda.`}
                        {" "}No se puede deshacer.
                    </p>
                    <div className={styles.botones}>
                        <button
                            type="button"
                            className={styles.cancelar}
                            onClick={() => dialogo.current?.close()}
                            disabled={borrando}
                            autoFocus
                        >
                            Cancelar
                        </button>
                        <button type="button" className={styles.borrar} onClick={borrar} disabled={borrando}>
                            {borrando ? "Borrando…" : "Borrar"}
                        </button>
                    </div>
                </>
            )}
        </dialog>
    );
}
