'use client'

import { useEffect, useRef } from "react";
import styles from "./AvisoDeshacer.module.css";
import type { Foto } from "@/lib/fotos";
import { SEGUNDOS_DESHACER } from "@/hooks/useFotos";

type AvisoDeshacerProps = {
    foto: Foto | null;
    onDeshacer: () => void;
};

// Aviso "Deshacer" tras borrar una foto (RF-29). Es un popover para quedar
// por encima de la galería, que también está en la capa superior
export default function AvisoDeshacer({ foto, onDeshacer }: AvisoDeshacerProps) {
    const aviso = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const elemento = aviso.current;
        if (!elemento) return;
        // Se vuelve a abrir en cada borrado para quedar arriba de todo
        if (elemento.matches(":popover-open")) elemento.hidePopover();
        if (foto) elemento.showPopover();
    }, [foto]);

    return (
        <div ref={aviso} popover="manual" className={styles.aviso} role="status">
            {foto && (
                <>
                    <span>Foto borrada</span>
                    <button type="button" className={styles.deshacer} onClick={onDeshacer}>
                        Deshacer
                    </button>
                    <span
                        key={foto.id}
                        className={styles.tiempo}
                        style={{ animationDuration: `${SEGUNDOS_DESHACER}s` }}
                    />
                </>
            )}
        </div>
    );
}
