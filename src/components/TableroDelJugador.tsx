'use client'

import { use, useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { browser } from "react-dom";
import { useRouter } from "next/navigation";
import { CloudUpload, Dices, Ellipsis, Hand, Lock, PartyPopper, RefreshCw, UserX } from "lucide-react";
import styles from "./TableroDelJugador.module.css";
import SinJugador from "@/components/SinJugador";
import MarcoTablero from "@/components/MarcoTablero";
import Tablero from "@/components/Tablero";
import MenuTablero from "@/components/MenuTablero";
import Respaldo from "@/components/Respaldo";
import ConfirmarBorrado from "@/components/ConfirmarBorrado";
import Confirmacion from "@/components/Confirmacion";
import Telon from "@/components/Telon";
import Calabaza from "@/components/ilustraciones/Calabaza";
import Boton from "@/components/ui/Boton";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import { useAvisos } from "@/components/Avisos";
import { obtenerJugador, olvidarJugador, type Jugador } from "@/lib/jugador";
import type { Foto } from "@/lib/fotos";
import { CAMBIOS_MAXIMOS, CELDAS_TABLERO, generarTablero } from "@/lib/tablero";
import { cambiarCategoria as cambiarCategoriaRemota, reabrirTablero } from "@/lib/tableroRemoto";
import { useFotos } from "@/hooks/useFotos";
import { useTableroRemoto } from "@/hooks/useTableroRemoto";

// Cada calabaza titila a su ritmo, entre 6 y 12 segundos: mezclados, parecen al azar.
// El arranque negativo las desfasa desde el principio
function ritmoDeCalabaza(posicion: number) {
    return {
        "--titilar-cada": `${6 + (posicion * 5) % 7}s`,
        "--titilar-desde": `-${(posicion * 3) % 11}s`,
    } as CSSProperties;
}

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
    const { fotos, cargando, subiendo, agregarFotos, reintentar, urlDeFoto, eliminarFoto, eliminarTodas } = useFotos(jugador.id);
    const avisar = useAvisos();
    const router = useRouter();
    // Cambios, elección y entrega vienen de la base y se actualizan en vivo
    const { estado, recargar } = useTableroRemoto(jugador.id);
    const tablero = estado.tipo === "listo" ? estado.tablero : null;
    const cambios = tablero?.cambios ?? [];

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

    const cerrado = Boolean(tablero?.entregadoEn);
    const categorias = generarTablero(jugador.id, cambios);
    const cambiosRestantes = CAMBIOS_MAXIMOS - cambios.length;
    const pendientes = fotos.filter((foto) => foto.estado === "pendiente").length;
    const completas = categorias
        .filter((categoria) => fotos.some((foto) => foto.categoria === categoria)).length;
    const fotosACambiar = fotos.filter((foto) => foto.categoria === aCambiar?.categoria);

    // El telón cae solo al completar el tablero acá: si ya estaba completo al cargar, no.
    // Se compara contra el valor anterior, que recién se guarda con todo cargado
    const [completasAntes, setCompletasAntes] = useState<number | null>(null);
    const [mostrarTelon, setMostrarTelon] = useState(false);
    const cerrarTelon = useCallback(() => setMostrarTelon(false), []);
    if (!cargando && tablero && completas !== completasAntes) {
        setCompletasAntes(completas);
        if (completasAntes !== null && completas === CELDAS_TABLERO && !cerrado) setMostrarTelon(true);
    }

    // Las fotos de la celda que todavía no subieron se borran acá; las subidas y el
    // sorteo de la categoría nueva los hace el servidor
    async function cambiarCategoria() {
        if (!aCambiar) return;
        for (const foto of fotosACambiar.filter((foto) => foto.estado === "pendiente")) {
            if (!(await eliminarFoto(foto))) return;
        }
        try {
            const nueva = await cambiarCategoriaRemota(jugador.id, aCambiar.posicion);
            setModoCambio(false);
            avisar({ tipo: "exito", texto: `«${aCambiar.categoria}» ahora es «${nueva}»` });
        } catch {
            avisar({ tipo: "error", texto: "No se pudo cambiar la categoría. Revisá la conexión y probá de nuevo." });
        }
        await recargar();
    }

    // Borra todas las fotos (y con ellas la elección); las categorías y los cambios se mantienen
    async function borrarTodo() {
        if (!(await eliminarTodas())) return;
        avisar({ tipo: "exito", texto: "Se borraron todas las fotos del tablero." });
        await recargar();
    }

    // Al reabrir, el tablero sale de la revisión hasta que se vuelva a entregar
    async function reabrir() {
        try {
            await reabrirTablero(jugador.id);
        } catch {
            avisar({ tipo: "error", texto: "No se pudo reabrir. Revisá la conexión y probá de nuevo." });
        }
        await recargar();
    }

    // Este navegador perdió la sesión con la que entró: hay que volver a entrar con el código
    if (estado.tipo === "sinAcceso") {
        return (
            <PantallaMensaje
                icono={<UserX />}
                titulo="Este celular perdió el acceso"
                texto="Volvé a entrar con tu código de recuperación para seguir con tu tablero."
                accion={
                    <Boton onClick={() => {
                        olvidarJugador();
                        router.push("/");
                    }}>
                        Ir al inicio
                    </Boton>
                }
            />
        );
    }

    // Hasta saber los cambios de categoría no se dibuja la grilla (evita mostrar categorías viejas)
    if (!tablero) {
        return <MarcoTablero />;
    }

    const barra = (
        <>
            {/* Contador de progreso (RF-28) */}
            <div className={styles.jugador} role="group" aria-label={`${completas} de ${CELDAS_TABLERO} celdas completadas`}>
                <span className={styles.linea}>
                    <span className={styles.nombre}>{jugador.nombre}</span>
                    <span className={styles.cuenta} aria-hidden="true">{completas}/{CELDAS_TABLERO}</span>
                </span>
                <span className={styles.calabazas}>
                    {categorias.map((categoria, posicion) => (
                        <Calabaza
                            key={categoria}
                            className={posicion < completas ? styles.calabazaPrendida : styles.calabaza}
                            style={ritmoDeCalabaza(posicion)}
                        />
                    ))}
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
    } else if (completas === CELDAS_TABLERO) {
        pie = <Estado icono={<PartyPopper />} titulo="¡Completaste el tablero!" detalle="Tocá Finalizar para elegir tus fotos" />;
    } else {
        pie = <Estado icono={<Hand />} titulo="Tocá una celda para sacar una foto" detalle="Manteniéndola apretada, borrás la última" />;
    }

    return (
        <>
            <MarcoTablero barra={barra} pie={pie} luz={completas / CELDAS_TABLERO}>
                <Tablero
                    categorias={categorias}
                    fotos={fotos}
                    urlDeFoto={urlDeFoto}
                    onAgregarFotos={agregarFotos}
                    onPedirBorrado={setPorBorrar}
                    elegidas={cerrado ? tablero.elegidas : undefined}
                    onElegirCambio={modoCambio && !cerrado
                        ? (posicion) => setACambiar({
                            posicion,
                            categoria: categorias[posicion],
                            cantidadFotos: fotos.filter((foto) => foto.categoria === categorias[posicion]).length,
                            restantes: cambiosRestantes,
                        })
                        : undefined}
                />
                {/* Con todas las celdas completas aparece Finalizar en el centro de la grilla (RF-15, RF-26) */}
                {!cerrado && !modoCambio && completas === CELDAS_TABLERO && (
                    <div className={styles.finalizar}>
                        <Boton href="/finalizar">¡Bingo! Finalizar</Boton>
                    </div>
                )}
            </MarcoTablero>

            {mostrarTelon && <Telon onTerminar={cerrarTelon} />}

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
                jugadorId={jugador.id}
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
                texto={`Tu entrega sale de la revisión y vas a poder agregar y borrar fotos otra vez. Después tenés que volver a confirmar tus ${CELDAS_TABLERO} fotos.`}
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
