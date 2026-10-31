'use client'

import { use, useState, type CSSProperties } from "react";
import { browser } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CloudUpload, Lock, LockKeyhole, PartyPopper, Pencil, RefreshCw, Share2 } from "lucide-react";
import styles from "./EleccionFotos.module.css";
import SinJugador from "@/components/SinJugador";
import Carrusel from "@/components/Carrusel";
import CompartirTablero from "@/components/CompartirTablero";
import Confirmacion from "@/components/Confirmacion";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import Boton from "@/components/ui/Boton";
import { useAvisos } from "@/components/Avisos";
import { ErrorDeGrupo, obtenerJugador, type Jugador } from "@/lib/jugador";
import { CELDAS_TABLERO, LADO_TABLERO, generarTablero } from "@/lib/tablero";
import { completarElegidas } from "@/lib/eleccion";
import { armarCeldas } from "@/lib/imagenTablero";
import { entregarTablero, guardarElegidas } from "@/lib/tableroRemoto";
import type { Foto } from "@/lib/fotos";
import { useFotos } from "@/hooks/useFotos";
import { useTableroRemoto } from "@/hooks/useTableroRemoto";

// Elección de la foto final de cada celda, paso a paso (RF-16, RF-17, RF-26)
export default function EleccionFotos() {
    use(browser("El jugador se guarda en localStorage"));

    // Sin jugador no se redirige: el router recordaría la redirección y la
    // repetiría después de crear el jugador
    const jugador = obtenerJugador();
    if (!jugador) {
        return <SinJugador />;
    }

    return <Eleccion jugador={jugador} />;
}

// paso: eligiendo una celda; desdeResumen vuelve al resumen al elegir
type Vista = { tipo: "paso"; categoria: string; desdeResumen: boolean } | { tipo: "resumen" };

function Eleccion({ jugador }: { jugador: Jugador }) {
    const router = useRouter();
    const avisar = useAvisos();
    const { fotos, cargando, subiendo, reintentar, urlDeFoto } = useFotos(jugador.id);
    // Cambios, elección y entrega vienen de la base
    const { estado, recargar } = useTableroRemoto(jugador.id, jugador.grupo.id);
    // Elecciones hechas acá que todavía no se guardaron (fotos sin subir)
    const [elegidasLocales, setElegidasLocales] = useState<Record<string, string>>({});
    const [vista, setVista] = useState<Vista | null>(null);
    const [confirmando, setConfirmando] = useState(false);
    // Entregó desde esta pantalla: se festeja en lugar de avisar que ya está cerrado
    const [recienEntregado, setRecienEntregado] = useState(false);
    const [compartiendo, setCompartiendo] = useState(false);

    if (estado.tipo === "sinAcceso") {
        return <SinJugador />;
    }

    // Con el tablero ya cerrado no hay nada que elegir. No se redirige: el router
    // recordaría la redirección y la repetiría después de reabrir el tablero
    if (estado.tipo === "listo" && estado.tablero.entregadoEn) {
        if (recienEntregado) {
            const { tablero } = estado;
            const celdas = armarCeldas(generarTablero(jugador.id, tablero.cambios), tablero.elegidas, fotos);
            return (
                <>
                    <PantallaMensaje
                        icono={<PartyPopper />}
                        titulo="¡Tablero entregado!"
                        texto="Llevate tus fotos de la noche para compartirlas en tus redes. Después, pasá a votar las del grupo."
                        accion={
                            <div className={styles.acciones}>
                                {celdas && (
                                    <Boton anchoCompleto icono={<Share2 />} onClick={() => setCompartiendo(true)}>
                                        Compartir mi tablero
                                    </Boton>
                                )}
                                <Boton href="/revision" variante={celdas ? "secundario" : "primario"} anchoCompleto>
                                    Ir a la revisión
                                </Boton>
                            </div>
                        }
                    />
                    {celdas && (
                        <CompartirTablero
                            abierto={compartiendo}
                            onCerrar={() => setCompartiendo(false)}
                            celdas={celdas}
                            nombre={jugador.nombre}
                        />
                    )}
                </>
            );
        }
        return (
            <PantallaMensaje
                icono={<Lock />}
                titulo="Tu tablero ya está cerrado"
                texto={estado.tablero.entregasCerradas
                    ? "El grupo ya cerró las entregas: ahora toca votar."
                    : "Para cambiar alguna foto, reabrilo desde el tablero."}
                accion={<Boton href="/tablero">Ir al tablero</Boton>}
            />
        );
    }

    // Llegó tarde: el creador del grupo ya cerró las entregas
    if (estado.tipo === "listo" && estado.tablero.entregasCerradas) {
        return (
            <PantallaMensaje
                icono={<Lock />}
                titulo="El grupo cerró las entregas"
                texto="Ya no se pueden entregar tableros, pero podés mirar las fotos del grupo en la revisión."
                accion={<Boton href="/revision">Ir a la revisión</Boton>}
            />
        );
    }

    if (cargando || estado.tipo !== "listo") {
        return <p className={styles.cargando} role="status">Cargando tus fotos…</p>;
    }

    const { tablero } = estado;
    const categorias: readonly string[] = generarTablero(jugador.id, tablero.cambios);
    const fotosDe = (categoria: string) => fotos.filter((foto) => foto.categoria === categoria);
    const completas = categorias.filter((categoria) => fotosDe(categoria).length > 0).length;

    // Detección de tablero completo (RF-15): sin todas las celdas no se puede finalizar
    if (completas < categorias.length) {
        return (
            <PantallaMensaje
                icono={<LockKeyhole />}
                titulo="Todavía no completaste el tablero"
                texto={`Llevás ${completas} de ${CELDAS_TABLERO} celdas. Cuando tengas una foto en cada una, vas a poder finalizar.`}
                accion={<Boton href="/tablero">Volver al tablero</Boton>}
            />
        );
    }

    // Las celdas con una sola foto se eligen solas y se saltean
    const elegidas = completarElegidas(categorias, fotos, { ...tablero.elegidas, ...elegidasLocales });
    const porElegir = categorias.filter((categoria) => fotosDe(categoria).length > 1);
    const primeraSinElegir = porElegir.find((categoria) => !elegidas[categoria]);
    const vistaActual: Vista = vista
        ?? (primeraSinElegir ? { tipo: "paso", categoria: primeraSinElegir, desdeResumen: false } : { tipo: "resumen" });

    // Se guarda en la base si la foto ya subió (la elección apunta a su fila);
    // si no, queda acá y se guarda al confirmar
    function elegir(categoria: string, foto: Foto, desdeResumen: boolean) {
        setElegidasLocales((anteriores) => ({ ...anteriores, [categoria]: foto.id }));
        if (foto.estado === "subida") guardarElegidas(jugador.id, { [categoria]: foto.id }).catch(() => { });
        const siguiente = porElegir[porElegir.indexOf(categoria) + 1];
        setVista(!desdeResumen && siguiente
            ? { tipo: "paso", categoria: siguiente, desdeResumen: false }
            : { tipo: "resumen" });
    }

    if (vistaActual.tipo === "paso") {
        const { categoria, desdeResumen } = vistaActual;
        const posicion = porElegir.indexOf(categoria);
        const anterior = porElegir[posicion - 1];
        return (
            <Paso
                key={categoria}
                categoria={categoria}
                fotos={fotosDe(categoria)}
                elegida={elegidas[categoria]}
                numero={posicion + 1}
                total={porElegir.length}
                urlDeFoto={urlDeFoto}
                onElegir={(foto) => elegir(categoria, foto, desdeResumen)}
                onVolver={desdeResumen
                    ? () => setVista({ tipo: "resumen" })
                    : anterior
                        ? () => setVista({ tipo: "paso", categoria: anterior, desdeResumen: false })
                        : () => router.push("/tablero")}
                etiquetaVolver={desdeResumen ? "Volver al resumen" : anterior ? "Celda anterior" : "Volver al tablero"}
            />
        );
    }

    const fotosElegidas = categorias.map((categoria) =>
        fotos.find((foto) => foto.id === elegidas[categoria]));
    const sinSubir = fotosElegidas.filter((foto) => foto?.estado === "pendiente").length;
    const listas = fotosElegidas.every((foto) => foto?.estado === "subida");

    // Se guardan las elegidas y se entrega; la base verifica que estén todas.
    // Si falla, el tablero no se cierra. Se marca antes de entregar porque la
    // actualización en vivo puede llegar antes de que termine la entrega
    async function confirmar() {
        setRecienEntregado(true);
        try {
            await guardarElegidas(jugador.id, elegidas);
            await entregarTablero(jugador.id);
        } catch (error) {
            setRecienEntregado(false);
            avisar({
                tipo: "error",
                texto: error instanceof ErrorDeGrupo
                    ? "El grupo ya cerró las entregas: tu tablero no se puede entregar."
                    : "No se pudo entregar tu tablero. Revisá la conexión y probá de nuevo.",
            });
            await recargar();
            return;
        }
        await recargar();
    }

    return (
        <div className={styles.resumen}>
            <header className={styles.encabezadoResumen}>
                <h1 className={styles.tituloGrande}>¡Bingo!</h1>
                <p className={styles.bajada}>Estas son tus {CELDAS_TABLERO} fotos. Tocá una para cambiarla.</p>
            </header>

            <ul className={styles.grilla} style={{ "--lado": LADO_TABLERO } as CSSProperties}>
                {categorias.map((categoria, posicion) => {
                    const foto = fotosElegidas[posicion];
                    const cambiable = fotosDe(categoria).length > 1;
                    const contenido = (
                        <>
                            {foto && (
                                // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local
                                <img src={urlDeFoto(foto)} alt="" className={styles.miniatura} />
                            )}
                            <span className={styles.categoria}>{categoria}</span>
                            {foto?.estado === "pendiente" ? (
                                <span className={`${styles.marca} ${styles.marcaPendiente}`} aria-label="Sin subir"><CloudUpload /></span>
                            ) : cambiable && (
                                <span className={styles.marca} aria-hidden="true"><Pencil /></span>
                            )}
                        </>
                    );
                    return (
                        <li key={categoria} className={styles.celda}>
                            {cambiable ? (
                                <button
                                    type="button"
                                    className={styles.celdaBoton}
                                    aria-label={`Cambiar la foto de ${categoria}`}
                                    onClick={() => setVista({ tipo: "paso", categoria, desdeResumen: true })}
                                >
                                    {contenido}
                                </button>
                            ) : (
                                <div className={styles.celdaBoton}>{contenido}</div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {/* El informe necesita la URL de cada foto: hay que esperar a que suban */}
            {sinSubir > 0 && (
                <div className={styles.avisoPendientes} role="status">
                    <CloudUpload aria-hidden="true" />
                    <span className={styles.avisoTexto}>
                        {sinSubir === 1 ? "Falta subir 1 foto elegida." : `Faltan subir ${sinSubir} fotos elegidas.`}
                    </span>
                    <Boton variante="secundario" tamano="s" icono={<RefreshCw />} onClick={reintentar} disabled={subiendo}>
                        {subiendo ? "Subiendo…" : "Reintentar"}
                    </Boton>
                </div>
            )}

            <div className={styles.acciones}>
                <Boton anchoCompleto icono={<Lock />} disabled={!listas} onClick={() => setConfirmando(true)}>
                    Confirmar elección
                </Boton>
                <Boton href="/tablero" variante="fantasma" anchoCompleto>Volver al tablero</Boton>
            </div>

            <Confirmacion
                abierta={confirmando}
                titulo="¿Cerrar tu tablero?"
                texto={`Tus ${CELDAS_TABLERO} fotos se entregan para la revisión y ya no vas a poder subir ni borrar fotos. Después vas a poder compartir tu tablero y votar las fotos de los demás. Si te equivocaste, podés reabrirlo desde tu tablero.`}
                accion="Cerrar y entregar"
                accionEnCurso="Entregando…"
                onConfirmar={confirmar}
                onCerrar={() => setConfirmando(false)}
            />
        </div>
    );
}

type PasoProps = {
    categoria: string;
    fotos: Foto[];
    elegida: string | undefined;
    numero: number;
    total: number;
    urlDeFoto: (foto: Foto) => string;
    onElegir: (foto: Foto) => void;
    onVolver: () => void;
    etiquetaVolver: string;
};

// Una celda: se desliza entre sus fotos y se elige la que se ve
function Paso({ categoria, fotos, elegida, numero, total, urlDeFoto, onElegir, onVolver, etiquetaVolver }: PasoProps) {
    // Arranca en la elegida o, si no hay, en la más reciente
    const inicial = Math.max(0, elegida ? fotos.findIndex((foto) => foto.id === elegida) : fotos.length - 1);
    const [indice, setIndice] = useState(inicial);
    const actual = fotos[indice];
    const yaElegida = actual.id === elegida;

    return (
        <div className={styles.paso}>
            <header className={styles.encabezadoPaso}>
                <button type="button" className={styles.volver} onClick={onVolver} aria-label={etiquetaVolver}>
                    <ArrowLeft />
                </button>
                <div className={styles.pasoTextos}>
                    <span className={styles.etiqueta}>Elegí tu foto · {numero} de {total}</span>
                    <h1 className={styles.titulo}>{categoria}</h1>
                </div>
            </header>
            <div className={styles.avance} aria-hidden="true">
                {Array.from({ length: total }, (_, posicion) => (
                    <span key={posicion} className={posicion < numero ? styles.avanceLleno : styles.avanceVacio} />
                ))}
            </div>

            <Carrusel fotos={fotos} indiceInicial={inicial} urlDeFoto={urlDeFoto} onCambiar={setIndice} />

            <Boton anchoCompleto icono={yaElegida ? <Check /> : undefined} onClick={() => onElegir(actual)}>
                {yaElegida ? "Elegida · Seguir" : "Elegir esta"}
            </Boton>
        </div>
    );
}
