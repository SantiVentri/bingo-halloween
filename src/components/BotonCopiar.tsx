'use client'

import { useState } from "react";
import styles from "./BotonCopiar.module.css";

type BotonCopiarProps = {
    texto: string;
    etiqueta: string;
};

type EstadoCopia = "inicial" | "copiado" | "manual";

export default function BotonCopiar({ texto, etiqueta }: BotonCopiarProps) {
    const [estadoCopia, setEstadoCopia] = useState<EstadoCopia>("inicial");

    // navigator.clipboard solo existe en HTTPS o localhost; si falla se copia a mano
    async function copiar() {
        try {
            await navigator.clipboard.writeText(texto);
            setEstadoCopia("copiado");
        } catch {
            setEstadoCopia("manual");
        }
    }

    return (
        <>
            <button type="button" className={styles.boton} onClick={copiar}>
                {estadoCopia === "copiado" ? "¡Copiado!" : etiqueta}
            </button>
            {estadoCopia === "manual" && (
                <p className={styles.ayuda}>
                    No se pudo copiar solo: mantené apretado el texto para copiarlo.
                </p>
            )}
        </>
    );
}
