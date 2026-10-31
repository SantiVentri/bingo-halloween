'use client'

import { use, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import { useRouter } from "next/navigation";
import { CloudUpload, Dices, Ellipsis, Hand, Lock, PartyPopper, RefreshCw } from "lucide-react";
import styles from "./TableroDelJugador.module.css";
import SinJugador from "@/components/SinJugador";
import MarcoTablero from "@/components/MarcoTablero";
import Tablero from "@/components/Tablero";
import MenuTablero from "@/components/MenuTablero";
import Respaldo from "@/components/Respaldo";
import ConfirmarBorrado from "@/components/ConfirmarBorrado";
import Confirmacion from "@/components/Confirmacion";
import Boton from "@/components/ui/Boton";
import { useAvisos } from "@/components/Avisos";
import { obtenerJugador, type Jugador } from "@/lib/jugador";
import type { Foto } from "@/lib/fotos";
import { CAMBIOS_MAXIMOS, generarTablero, sortearCategoria } from "@/lib/tablero";
import { guardarEleccion } from "@/lib/eleccion";
import { guardarCambios } from "@/lib/cambios";
import { retirarEntrega } from "@/lib/entrega";
import { useFotos } from "@/hooks/useFotos";
import { useCambios, useEleccion } from "@/hooks/useAlmacen";

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
    const { fotos, subiendo, agregarFotos, reintentar, urlDeFoto, eliminarFoto, eliminarTodas } = useFotos(jugador.uuid);
    const avisar = useAvisos();
    const router = useRouter();
    // La elección y los cambios se leen de localStorage en cada render: así se
    // actualizan aunque Next haya dejado esta pantalla oculta al navegar
    const eleccion = useEleccion(jugador.uuid);
    const cambios = useCambios(jugador.uuid);

    const [menuAbierto, setMenuAbierto] = useState(false);
    const [respaldoAbierto, setRespaldoAbierto] = useState(false);
    const [porBorrar, setPorBorrar] = useState<Foto | null>(null);
    const [reabriendo, setReabriendo] = useState(false);
    // Cantidad de fotos al abrir la alerta de borrar todo; null si está cerrada
    const [borrandoTodo, setBorrandoTodo] = useState<number | null>(null);
    // Hasta 2 cambios de una celda por una categoría al azar, sin deshacer
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
    // falla, la categoría no cambia y el aviso de error ya lo dio el borrado
    async function cambiarCategoria() {
        if (!aCambiar) return;
        for (const foto of fotosACambiar) {
            if (!(await eliminarFoto(foto))) return;
        }
        const nueva = sortearCategoria(jugador.uuid, cambios);
        guardarCambios(jugador.uuid, [...cambios, { posicion: aCambiar.posicion, categoria: nueva }]);
        setModoCambio(false);
        avisar({ tipo: "exito", texto: `«${aCambiar.categoria}» ahora es «${nueva}»` });
    }

    // Borra todas las fotos y la elección; las categorías y los cambios se mantienen
    async function borrarTodo() {
        if (!(await eliminarTodas())) return;
        guardarEleccion(jugador.uuid, { elegidas: {}, confirmadaEn: null });
        avisar({ tipo: "exito", texto: "Se borraron todas las fotos del tablero." });
    }

    // Al reabrir, la entrega sale de la revisión hasta que se vuelva a cerrar
    async function reabrir() {
        if (!(await retirarEntrega(jugador.uuid))) {
            avisar({ tipo: "error", texto: "No se pudo reabrir. Revisá la conexión y probá de nuevo." });
            return;
        }
        guardarEleccion(jugador.uuid, { ...eleccion, confirmadaEn: null });
    }

    const barra = (
        <>
            <div className={styles.jugador}>
                <span className={styles.nombre}>{jugador.nombre}</span>
                {/* Contador de progreso (RF-28) */}
                <span className={styles.progreso} aria-label={`${completas} de 9 celdas completadas`}>
                    <span className={styles.segmentos} aria-hidden="true">
                        {categorias.map((categoria, posicion) => (
                            <span key={categoria} className={posicion < completas ? styles.segmentoLleno : styles.segmento} />
                        ))}
                    </span>
                    <span className={styles.cuenta}>{completas}/9</span>
                </span>
            </div>
            <button type="button" className={styles.menu} onClick={() => setMenuAbierto(true)} aria-label="Opciones">
                <Ellipsis />
            </button>
        </>
    );

    // Abajo se muestra una sola cosa: lo más urgente según el estado del tablero
    let pie: ReactNode;
    if (modoCambio) {
        pie = (
            <>
                <Estado icono={<Dices />} titulo="Elegí la celda a cambiar" detalle={`Te ${cambiosRestantes === 1 ? "queda 1 cambio" : `quedan ${cambiosRestantes} cambios`}`} />
                <Boton variante="secundario" onClick={() => setModoCambio(false)}>Cancelar</Boton>
            </>
        );
    } else if (cerrado) {
        pie = (
            <>
                <Estado icono={<Lock />} titulo="Tablero entregado" detalle="Ya está en la revisión del grupo" />
                <Boton variante="secundario" onClick={() => setReabriendo(true)}>Reabrir</Boton>
            </>
        );
    } else if (pendientes > 0) {
        pie = (
            <>
                {/* Reintento manual de las fotos pendientes (RF-11) */}
                <Estado
                    icono={<CloudUpload />}
                    titulo={pendientes === 1 ? "1 foto sin subir" : `${pendientes} fotos sin subir`}
                    detalle="Están guardadas en tu celular"
                    alerta
                />
                <Boton variante="secundario" icono={<RefreshCw />} onClick={reintentar} disabled={subiendo}>
                    {subiendo ? "Subiendo…" : "Reintentar"}
                </Boton>
            </>
        );
    } else if (completas === 9) {
        pie = <Estado icono={<PartyPopper />} titulo="¡Completaste el tablero!" detalle="Tocá Finalizar para elegir tus fotos" />;
    } else {
        pie = <Estado icono={<Hand />} titulo="Tocá una celda para sacar una foto" detalle="Manteniéndola apretada, borrás la última" />;
    }

    return (
        <>
            <MarcoTablero barra={barra} pie={pie}>
                {/* Interior de la grilla roja del póster, en % para que coincida en cualquier ancho */}
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
                {/* Con las 9 celdas completas aparece Finalizar en el centro de la grilla (RF-15, RF-26) */}
                {!cerrado && !modoCambio && completas === 9 && (
                    <div className={styles.finalizar}>
                        <Boton href="/finalizar">¡Bingo! Finalizar</Boton>
                    </div>
                )}
            </MarcoTablero>

            <MenuTablero
                abierto={menuAbierto}
                onCerrar={() => setMenuAbierto(false)}
                cerrado={cerrado}
                hayFotos={fotos.length > 0}
                cambiosRestantes={cambiosRestantes}
                onRespaldo={() => setRespaldoAbierto(true)}
                onCambiar={() => setModoCambio(true)}
                onBorrarTodo={() => setBorrandoTodo(fotos.length)}
                onRevision={() => router.push("/revision")}
            />
            <Respaldo
                abierto={respaldoAbierto}
                onCerrar={() => setRespaldoAbierto(false)}
                jugador={jugador}
                fotos={fotos}
                cambios={cambios}
            />
            <ConfirmarBorrado
                foto={porBorrar}
                fotosEnCelda={fotos.filter((foto) => foto.categoria === porBorrar?.categoria).length}
                urlDeFoto={urlDeFoto}
                onConfirmar={eliminarFoto}
                onCerrar={() => setPorBorrar(null)}
            />
            <Confirmacion
                abierta={aCambiar !== null}
                titulo={`¿Cambiar «${aCambiar?.categoria}»?`}
                texto={`Va a pasar a ser una categoría al azar. ${!aCambiar || aCambiar.cantidadFotos === 0
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
                abierta={borrandoTodo !== null}
                titulo="¿Borrar todo el tablero?"
                texto={`Se van a borrar ${borrandoTodo === 1 ? "tu foto" : `tus ${borrandoTodo} fotos`} del celular y de la nube. Las categorías se mantienen. No se puede deshacer.`}
                accion="Borrar todo"
                accionEnCurso="Borrando…"
                peligro
                onConfirmar={borrarTodo}
                onCerrar={() => setBorrandoTodo(null)}
            />
            <Confirmacion
                abierta={reabriendo}
                titulo="¿Reabrir tu tablero?"
                texto="Tu entrega sale de la revisión y vas a poder agregar y borrar fotos otra vez. Después tenés que volver a confirmar tus 9 fotos."
                accion="Reabrir"
                accionEnCurso="Reabriendo…"
                onConfirmar={reabrir}
                onCerrar={() => setReabriendo(false)}
            />
        </>
    );
}

type EstadoProps = {
    icono: ReactNode;
    titulo: string;
    detalle: string;
    alerta?: boolean;
};

// Estado del tablero en la barra de abajo: ícono, título y una línea de detalle
function Estado({ icono, titulo, detalle, alerta = false }: EstadoProps) {
    return (
        <div className={alerta ? `${styles.estado} ${styles.estadoAlerta}` : styles.estado} role="status">
            <span className={styles.estadoIcono} aria-hidden="true">{icono}</span>
            <span className={styles.estadoTextos}>
                <span className={styles.estadoTitulo}>{titulo}</span>
                <span className={styles.estadoDetalle}>{detalle}</span>
            </span>
        </div>
    );
}
