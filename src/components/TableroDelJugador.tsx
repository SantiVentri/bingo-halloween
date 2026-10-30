'use client'

import { use, useState } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import SinJugador from "@/components/SinJugador";
import styles from "./TableroDelJugador.module.css";
import Tablero from "@/components/Tablero";
import Respaldo from "@/components/Respaldo";
import ConfirmarBorrado from "@/components/ConfirmarBorrado";
import Confirmacion from "@/components/Confirmacion";
import { obtenerJugador, type Jugador } from "@/lib/jugador";
import type { Foto } from "@/lib/fotos";
import { generarTablero } from "@/lib/tablero";
import { guardarEleccion, obtenerEleccion } from "@/lib/eleccion";
import { useFotos } from "@/hooks/useFotos";

// Lee el jugador de localStorage; sin jugador ofrece volver al ingreso (RF-02)
export default function TableroDelJugador() {
    use(browser("El jugador se guarda en localStorage"));

    // Sin jugador no se redirige: el router recordaría la redirección y la
    // repetiría después de crear el jugador
    const jugador = obtenerJugador();
    if (!jugador) {
        return <SinJugador />;
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
    // Al confirmar la elección el tablero se cierra; se puede reabrir hasta el informe
    const [eleccion, setEleccion] = useState(() => obtenerEleccion(jugador.uuid));
    const [reabriendo, setReabriendo] = useState(false);
    const cerrado = eleccion.confirmadaEn !== null;
    const pendientes = fotos.filter((foto) => foto.estado === "pendiente").length;
    const completas = generarTablero(jugador.uuid)
        .filter((categoria) => fotos.some((foto) => foto.categoria === categoria)).length;

    function reabrir() {
        const abierta = { ...eleccion, confirmadaEn: null };
        guardarEleccion(jugador.uuid, abierta);
        setEleccion(abierta);
    }

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
                    elegidas={cerrado ? eleccion.elegidas : undefined}
                />
            </div>
            <ConfirmarBorrado
                foto={porBorrar}
                fotosEnCelda={fotos.filter((foto) => foto.categoria === porBorrar?.categoria).length}
                urlDeFoto={urlDeFoto}
                onConfirmar={eliminarFoto}
                onCerrar={() => setPorBorrar(null)}
            />
            <div className={styles.pie}>
                <p className={styles.aviso} role="status">{aviso}</p>
                {cerrado ? (
                    <div className={styles.cerrado}>
                        <span>🔒 Tablero cerrado</span>
                        <button type="button" className={styles.reabrir} onClick={() => setReabriendo(true)}>
                            Reabrir
                        </button>
                    </div>
                ) : (
                    // Con las 9 celdas completas aparece Finalizar (RF-15, RF-26)
                    completas === 9 && (
                        <Link href="/finalizar" className={styles.finalizar}>¡Bingo! Finalizar</Link>
                    )
                )}
            </div>
            <Confirmacion
                abierta={reabriendo}
                titulo="¿Reabrir tu tablero?"
                texto="Vas a poder agregar y borrar fotos otra vez. Después tenés que volver a confirmar tus 9 fotos."
                accion="Reabrir"
                accionEnCurso="Reabriendo…"
                onConfirmar={reabrir}
                onCerrar={() => setReabriendo(false)}
            />
        </>
    );
}
