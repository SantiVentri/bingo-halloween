'use client'

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import styles from "./Confirmacion.module.css";
import Dialogo from "@/components/ui/Dialogo";
import Boton from "@/components/ui/Boton";

type ConfirmacionProps = {
    abierta: boolean;
    titulo: string;
    texto: ReactNode;
    // Texto del botón principal y el que muestra mientras trabaja
    accion: string;
    accionEnCurso: string;
    // Para acciones destructivas: botón de peligro con ícono de tacho
    peligro?: boolean;
    imagen?: string;
    onConfirmar: () => Promise<unknown> | void;
    onCerrar: () => void;
};

// Alerta de confirmación: se usa para borrar, cambiar categoría, cerrar y reabrir el tablero
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
    const [trabajando, setTrabajando] = useState(false);

    async function confirmar() {
        setTrabajando(true);
        await onConfirmar();
        setTrabajando(false);
        onCerrar();
    }

    return (
        <Dialogo
            abierto={abierta}
            onCerrar={onCerrar}
            titulo={titulo}
            bloqueado={trabajando}
            cerrarAlTocarAfuera={false}
            pie={
                <>
                    <Boton variante="secundario" onClick={onCerrar} disabled={trabajando} autoFocus>
                        Cancelar
                    </Boton>
                    <Boton
                        variante={peligro ? "peligro" : "primario"}
                        icono={peligro ? <Trash2 /> : undefined}
                        onClick={confirmar}
                        disabled={trabajando}
                    >
                        {trabajando ? accionEnCurso : accion}
                    </Boton>
                </>
            }
        >
            {imagen && (
                // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local
                <img src={imagen} alt="" className={styles.imagen} />
            )}
            <p className={styles.texto}>{texto}</p>
        </Dialogo>
    );
}
