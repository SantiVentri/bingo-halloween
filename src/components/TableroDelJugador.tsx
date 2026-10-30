'use client'

import { use, useState } from "react";
import { browser } from "react-dom";
import { redirect } from "next/navigation";
import styles from "./TableroDelJugador.module.css";
import Tablero from "@/components/Tablero";
import Respaldo from "@/components/Respaldo";
import ConfirmarBorrado from "@/components/ConfirmarBorrado";
import { obtenerJugador, type Jugador } from "@/lib/jugador";
import type { Foto } from "@/lib/fotos";
import { generarTablero } from "@/lib/tablero";
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
    const {
        fotos,
        subiendo,
        aviso,
        agregarFotos,
        reintentar,
        urlDeFoto,
        eliminarFoto,
    } = useFotos(jugador.uuid);
    const [porBorrar, setPorBorrar] = useState<Foto | null>(null);
    const pendientes = fotos.filter((foto) => foto.estado === "pendiente").length;
    const completas = generarTablero(jugador.uuid)
        .filter((categoria) => fotos.some((foto) => foto.categoria === categoria)).length;

    return (
        <>
            <div className={styles.barra}>
                <span className={styles.saludo}>Hola, {jugador.nombre}</span>
                {/* Contador de progreso (RF-28) */}
                <span className={styles.contador} aria-label={`${completas} de 9 celdas completadas`}>
                    {completas}/9
                </span>
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
                    onPedirBorrado={setPorBorrar}
                />
            </div>
            <ConfirmarBorrado
                foto={porBorrar}
                fotosEnCelda={fotos.filter((foto) => foto.categoria === porBorrar?.categoria).length}
                urlDeFoto={urlDeFoto}
                onConfirmar={eliminarFoto}
                onCerrar={() => setPorBorrar(null)}
            />
            <p className={styles.aviso} role="status">{aviso}</p>
        </>
    );
}
