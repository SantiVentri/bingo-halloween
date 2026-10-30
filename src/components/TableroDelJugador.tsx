'use client'

import { use } from "react";
import { browser } from "react-dom";
import { redirect } from "next/navigation";
import styles from "./TableroDelJugador.module.css";
import Tablero from "@/components/Tablero";
import Respaldo from "@/components/Respaldo";
import { obtenerJugador, type Jugador } from "@/lib/jugador";
import { useFotos } from "@/hooks/useFotos";

// Lee el jugador de localStorage; sin jugador vuelve al ingreso (RF-02)
export default function TableroDelJugador() {
    use(browser("El jugador se guarda en localStorage"));

    const jugador = obtenerJugador();
    if (!jugador) {
        redirect("/");
    }

    return <TableroConFotos jugador={jugador} />;
}

function TableroConFotos({ jugador }: { jugador: Jugador }) {
    const { fotos, subiendo, aviso, agregarFotos, reintentar, urlDeFoto } = useFotos(jugador.uuid);
    const pendientes = fotos.filter((foto) => foto.estado === "pendiente").length;

    return (
        <>
            <div className={styles.barra}>
                <span className={styles.saludo}>Hola, {jugador.nombre}</span>
                <div className={styles.acciones}>
                    {/* Reintento manual de las fotos pendientes (RF-11) */}
                    {pendientes > 0 && (
                        <button
                            type="button"
                            className={styles.reintentar}
                            onClick={reintentar}
                            disabled={subiendo}
                        >
                            {subiendo ? "Subiendo…" : `Reintentar (${pendientes})`}
                        </button>
                    )}
                    <Respaldo jugador={jugador} fotos={fotos} />
                </div>
            </div>
            <div className={styles.grilla}>
                <Tablero
                    uuid={jugador.uuid}
                    fotos={fotos}
                    urlDeFoto={urlDeFoto}
                    onAgregarFotos={agregarFotos}
                />
            </div>
            <p className={styles.aviso} role="status">{aviso}</p>
        </>
    );
}
