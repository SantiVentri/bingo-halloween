'use client'

import { useState } from "react";
import styles from "./CodigoRecuperacion.module.css";

type CodigoRecuperacionProps = {
    codigo: string;
};

type EstadoCopia = "inicial" | "copiado" | "manual";

// Muestra el código con el aviso para guardarlo (RF-03)
export default function CodigoRecuperacion({ codigo }: CodigoRecuperacionProps) {
    const [estadoCopia, setEstadoCopia] = useState<EstadoCopia>("inicial");

    // navigator.clipboard solo existe en HTTPS o localhost; si falla se copia a mano
    async function copiar() {
        try {
            await navigator.clipboard.writeText(codigo);
            setEstadoCopia("copiado");
        } catch {
            setEstadoCopia("manual");
        }
    }

    return (
        <div className={styles.codigoRecuperacion}>
            <p className={styles.aviso}>
                Guardá este código (por ejemplo, mandátelo por WhatsApp). Si borrás
                los datos del navegador o cambiás de celular, es la única forma de
                recuperar tu tablero.
            </p>
            <code className={styles.codigo}>{codigo}</code>
            <button type="button" className={styles.boton} onClick={copiar}>
                {estadoCopia === "copiado" ? "¡Copiado!" : "Copiar código"}
            </button>
            {estadoCopia === "manual" && (
                <p className={styles.ayuda}>
                    No se pudo copiar solo: mantené apretado el código para copiarlo.
                </p>
            )}
        </div>
    );
}
