'use client'

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import styles from "./BotonCopiar.module.css";
import Boton from "@/components/ui/Boton";

type BotonCopiarProps = {
    texto: string;
    etiqueta: string;
    variante?: "primario" | "secundario";
};

type EstadoCopia = "inicial" | "copiado" | "manual";

export default function BotonCopiar({ texto, etiqueta, variante = "secundario" }: BotonCopiarProps) {
    const [estadoCopia, setEstadoCopia] = useState<EstadoCopia>("inicial");

    // navigator.clipboard solo existe en HTTPS o localhost; si falla se copia a mano
    async function copiar() {
        try {
            await navigator.clipboard.writeText(texto);
            setEstadoCopia("copiado");
            window.setTimeout(() => setEstadoCopia("inicial"), 2000);
        } catch {
            setEstadoCopia("manual");
        }
    }

    return (
        <div className={styles.contenedor}>
            <Boton
                variante={variante}
                anchoCompleto
                icono={estadoCopia === "copiado" ? <Check /> : <Copy />}
                onClick={copiar}
            >
                {estadoCopia === "copiado" ? "Copiado" : etiqueta}
            </Boton>
            {/* Adentro de un diálogo los avisos flotantes no se ven: la ayuda va acá */}
            {estadoCopia === "manual" && (
                <p className={styles.ayuda} role="alert">
                    No se pudo copiar solo. Mantené apretado el texto para copiarlo.
                </p>
            )}
        </div>
    );
}
