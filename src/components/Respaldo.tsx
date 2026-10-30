'use client'

import { useRef } from "react";
import styles from "./Respaldo.module.css";
import CodigoRecuperacion from "@/components/CodigoRecuperacion";
import BotonCopiar from "@/components/BotonCopiar";
import { generarRespaldo } from "@/lib/respaldo";
import type { Jugador } from "@/lib/jugador";
import type { Foto } from "@/lib/fotos";

type RespaldoProps = {
    jugador: Jugador;
    fotos: Foto[];
};

// Botón del tablero que abre el código y el respaldo de fotos en un diálogo (RF-03, RF-21)
export default function Respaldo({ jugador, fotos }: RespaldoProps) {
    const dialogo = useRef<HTMLDialogElement>(null);
    const respaldo = generarRespaldo(jugador, fotos);
    const pendientes = fotos.filter((foto) => foto.estado === "pendiente").length;

    return (
        <>
            <button type="button" className={styles.abrir} onClick={() => dialogo.current?.showModal()}>
                Respaldo
            </button>
            <dialog ref={dialogo} className={styles.dialogo} closedby="any">
                <h2 className={styles.titulo}>Tu código de recuperación</h2>
                <CodigoRecuperacion codigo={jugador.uuid} />

                <h2 className={styles.titulo}>Respaldo de fotos</h2>
                <div className={styles.seccion}>
                    <p className={styles.texto}>
                        Incluye el código y las fotos ya subidas. Pegalo en &quot;Ya tengo
                        código&quot; desde otro celular para recuperar todo.
                    </p>
                    {pendientes > 0 && (
                        <p className={styles.advertencia}>
                            {pendientes === 1
                                ? "Hay 1 foto sin subir que todavía no entra en el respaldo."
                                : `Hay ${pendientes} fotos sin subir que todavía no entran en el respaldo.`}
                        </p>
                    )}
                    <pre className={styles.respaldo}>{respaldo}</pre>
                    <BotonCopiar texto={respaldo} etiqueta="Copiar respaldo" />
                </div>

                <button type="button" className={styles.cerrar} onClick={() => dialogo.current?.close()}>
                    Cerrar
                </button>
            </dialog>
        </>
    );
}
