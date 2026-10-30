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
import { CAMBIOS_MAXIMOS, generarTablero, sortearCategoria } from "@/lib/tablero";
import { guardarEleccion, obtenerEleccion } from "@/lib/eleccion";
import { guardarCambios, obtenerCambios } from "@/lib/cambios";
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
        avisar,
    } = useFotos(jugador.uuid);
    const [porBorrar, setPorBorrar] = useState<Foto | null>(null);
    // Al confirmar la elección el tablero se cierra; se puede reabrir hasta el informe
    const [eleccion, setEleccion] = useState(() => obtenerEleccion(jugador.uuid));
    const [reabriendo, setReabriendo] = useState(false);
    // Hasta 2 cambios de una celda por una categoría al azar, sin deshacer
    const [cambios, setCambios] = useState(() => obtenerCambios(jugador.uuid));
    const [modoCambio, setModoCambio] = useState(false);
    // Se congela al abrir la alerta para que su texto no cambie mientras se borran las fotos
    const [aCambiar, setACambiar] = useState<
        { posicion: number; categoria: string; cantidadFotos: number; restantes: number } | null
    >(null);
    const cerrado = eleccion.confirmadaEn !== null;
    const categorias = generarTablero(jugador.uuid, cambios);
    const cambiosRestantes = CAMBIOS_MAXIMOS - cambios.length;
    const pendientes = fotos.filter((foto) => foto.estado === "pendiente").length;
    const completas = categorias
        .filter((categoria) => fotos.some((foto) => foto.categoria === categoria)).length;
    const fotosACambiar = fotos.filter((foto) => foto.categoria === aCambiar?.categoria);

    // Primero borra las fotos de la celda (del celular y de UploadThing); si alguna
    // falla, la categoría no cambia y el aviso de error queda en el tablero
    async function cambiarCategoria() {
        if (!aCambiar) return;
        for (const foto of fotosACambiar) {
            if (!(await eliminarFoto(foto))) return;
        }
        const nueva = sortearCategoria(jugador.uuid, cambios);
        const actualizados = [...cambios, { posicion: aCambiar.posicion, categoria: nueva }];
        guardarCambios(jugador.uuid, actualizados);
        setCambios(actualizados);
        setModoCambio(false);
        avisar(`🎲 «${aCambiar.categoria}» ahora es «${nueva}»`);
    }

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
                    {pendientes > 0 && !modoCambio && (
                        <button
                            type="button"
                            className={styles.reintentar}
                            onClick={reintentar}
                            disabled={subiendo}
                        >
                            {subiendo ? "Subiendo…" : `Reintentar (${pendientes})`}
                        </button>
                    )}
                    {!cerrado && cambiosRestantes > 0 && (
                        <button
                            type="button"
                            className={modoCambio ? `${styles.cambiar} ${styles.cambiarActivo}` : styles.cambiar}
                            aria-pressed={modoCambio}
                            aria-label={modoCambio
                                ? "Cancelar el cambio de categoría"
                                : `Cambiar una categoría por otra al azar. Quedan ${cambiosRestantes}`}
                            onClick={() => setModoCambio(!modoCambio)}
                        >
                            {modoCambio
                                ? "Cancelar"
                                : pendientes > 0 ? `🎲 ${cambiosRestantes}` : `🎲 Cambiar (${cambiosRestantes})`}
                        </button>
                    )}
                    <Respaldo jugador={jugador} fotos={fotos} cambios={cambios} />
                </div>
            </div>
            <div className={styles.grilla}>
                <Tablero
                    categorias={categorias}
                    fotos={fotos}
                    urlDeFoto={urlDeFoto}
                    onAgregarFotos={agregarFotos}
                    onPedirBorrado={setPorBorrar}
                    elegidas={cerrado ? eleccion.elegidas : undefined}
                    onElegirCambio={modoCambio && !cerrado
                        ? (posicion) => setACambiar({
                            posicion,
                            categoria: categorias[posicion],
                            cantidadFotos: fotos.filter((foto) => foto.categoria === categorias[posicion]).length,
                            restantes: cambiosRestantes,
                        })
                        : undefined}
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
                <p className={styles.aviso} role="status">
                    {modoCambio ? "🎲 Tocá la celda que querés cambiar" : aviso}
                </p>
                {cerrado ? (
                    <div className={styles.cerrado}>
                        <span>🔒 Tablero cerrado</span>
                        <button type="button" className={styles.reabrir} onClick={() => setReabriendo(true)}>
                            Reabrir
                        </button>
                    </div>
                ) : null}
            </div>
            {/* Con las 9 celdas completas aparece Finalizar en el medio de la pantalla (RF-15, RF-26) */}
            {!cerrado && !modoCambio && completas === 9 && (
                <Link href="/finalizar" className={styles.finalizar}>¡Bingo! Finalizar</Link>
            )}
            <Confirmacion
                abierta={aCambiar !== null}
                titulo={`¿Cambiar «${aCambiar?.categoria}» por una categoría al azar?`}
                texto={`${!aCambiar || aCambiar.cantidadFotos === 0
                    ? ""
                    : aCambiar.cantidadFotos === 1
                        ? "Se va a borrar la foto de esta celda. "
                        : `Se van a borrar las ${aCambiar.cantidadFotos} fotos de esta celda. `}${aCambiar && aCambiar.restantes > 1
                    ? `Te va a quedar ${aCambiar.restantes - 1} cambio.`
                    : "Es tu último cambio."} No se puede deshacer.`}
                accion="Cambiar"
                accionEnCurso="Cambiando…"
                peligro={(aCambiar?.cantidadFotos ?? 0) > 0}
                onConfirmar={cambiarCategoria}
                onCerrar={() => setACambiar(null)}
            />
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
