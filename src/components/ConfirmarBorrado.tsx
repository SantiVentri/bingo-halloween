'use client'

import Confirmacion from "@/components/Confirmacion";
import type { Foto } from "@/lib/fotos";

type ConfirmarBorradoProps = {
    foto: Foto | null;
    // Cuántas fotos tiene la celda, contando la que se va a borrar
    fotosEnCelda: number;
    urlDeFoto: (foto: Foto) => string;
    onConfirmar: (foto: Foto) => Promise<boolean>;
    onCerrar: () => void;
};

// Alerta antes de borrar la última foto de una celda (RF-14).
// Si falla, el aviso de error se ve en el tablero al cerrar
export default function ConfirmarBorrado({ foto, fotosEnCelda, urlDeFoto, onConfirmar, onCerrar }: ConfirmarBorradoProps) {
    const quedan = fotosEnCelda - 1;

    return (
        <Confirmacion
            abierta={foto !== null}
            titulo={`¿Borrar la última foto de ${foto?.categoria}?`}
            texto={`${quedan === 0
                ? "Era la única foto: la celda va a quedar vacía."
                : `Le ${quedan === 1 ? "queda 1 foto" : `quedan ${quedan} fotos`} a esta celda.`} No se puede deshacer.`}
            accion="Borrar"
            accionEnCurso="Borrando…"
            peligro
            imagen={foto ? urlDeFoto(foto) : undefined}
            onConfirmar={() => (foto ? onConfirmar(foto) : undefined)}
            onCerrar={onCerrar}
        />
    );
}
