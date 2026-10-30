'use client'

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./Dialogo.module.css";

type DialogoProps = {
    abierto: boolean;
    onCerrar: () => void;
    titulo: string;
    // centro: alerta o diálogo común · hoja: sube desde abajo (menú)
    variante?: "centro" | "hoja";
    // Mientras trabaja no se puede cerrar
    bloqueado?: boolean;
    // Tocar afuera lo cierra. Las alertas no: el dedo que las abrió con un
    // toque largo, al soltarse, cuenta como un toque afuera y la cerraría
    cerrarAlTocarAfuera?: boolean;
    children: ReactNode;
    pie?: ReactNode;
};

// Base de todos los diálogos: mismo encabezado, botón de cerrar y espaciado
export default function Dialogo({
    abierto,
    onCerrar,
    titulo,
    variante = "centro",
    bloqueado = false,
    cerrarAlTocarAfuera = true,
    children,
    pie,
}: DialogoProps) {
    const dialogo = useRef<HTMLDialogElement>(null);
    const idTitulo = useId();

    useEffect(() => {
        const elemento = dialogo.current;
        if (!elemento) return;
        if (abierto && !elemento.open) elemento.showModal();
        if (!abierto && elemento.open) elemento.close();
    }, [abierto]);

    return (
        <dialog
            ref={dialogo}
            className={`${styles.dialogo} ${styles[variante]}`}
            aria-labelledby={idTitulo}
            closedby={bloqueado ? "none" : cerrarAlTocarAfuera ? "any" : "closerequest"}
            onCancel={(evento) => {
                if (bloqueado) evento.preventDefault();
            }}
            onClose={(evento) => {
                // React propaga el close de diálogos de adentro; solo cuenta el propio
                if (evento.target === evento.currentTarget) onCerrar();
            }}
        >
            {abierto && (
                <>
                    <header className={styles.encabezado}>
                        <h2 id={idTitulo} className={styles.titulo}>{titulo}</h2>
                        <button
                            type="button"
                            className={styles.cerrar}
                            onClick={() => dialogo.current?.close()}
                            disabled={bloqueado}
                            aria-label="Cerrar"
                        >
                            <X />
                        </button>
                    </header>
                    <div className={styles.cuerpo}>{children}</div>
                    {pie && <footer className={styles.pie}>{pie}</footer>}
                </>
            )}
        </dialog>
    );
}
