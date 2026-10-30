'use client'

import { use, useState } from "react";
import { browser } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CloudUpload, Lock, LockKeyhole, Pencil, RefreshCw } from "lucide-react";
import styles from "./EleccionFotos.module.css";
import SinJugador from "@/components/SinJugador";
import Carrusel from "@/components/Carrusel";
import Confirmacion from "@/components/Confirmacion";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import Boton from "@/components/ui/Boton";
import { obtenerJugador, type Jugador } from "@/lib/jugador";
import { generarTablero } from "@/lib/tablero";
import { completarElegidas, guardarEleccion } from "@/lib/eleccion";
import type { Foto } from "@/lib/fotos";
import { useFotos } from "@/hooks/useFotos";
import { useCambios, useEleccion } from "@/hooks/useAlmacen";

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
    const { fotos, cargando, subiendo, reintentar, urlDeFoto } = useFotos(jugador.uuid);
    // Se leen de localStorage en cada render: así se actualizan aunque Next
    // haya dejado esta pantalla oculta al navegar
    const eleccion = useEleccion(jugador.uuid);
    const cambios = useCambios(jugador.uuid);
    const [vista, setVista] = useState<Vista | null>(null);
    const [confirmando, setConfirmando] = useState(false);

    // Con el tablero ya cerrado no hay nada que elegir. No se redirige: el router
    // recordaría la redirección y la repetiría después de reabrir el tablero
    if (eleccion.confirmadaEn) {
        return (
            <PantallaMensaje
                icono={<Lock />}
                titulo="Tu tablero ya está cerrado"
                texto="Para cambiar alguna foto, reabrilo desde el tablero."
                accion={<Boton href="/tablero">Ir al tablero</Boton>}
            />
        );
    }

    if (cargando) {
        return <p className={styles.cargando} role="status">Cargando tus fotos…</p>;
    }

    const categorias: readonly string[] = generarTablero(jugador.uuid, cambios);
    const fotosDe = (categoria: string) => fotos.filter((foto) => foto.categoria === categoria);
    const completas = categorias.filter((categoria) => fotosDe(categoria).length > 0).length;

    // Detección de tablero completo (RF-15): sin las 9 no se puede finalizar
    if (completas < categorias.length) {
        return (
            <PantallaMensaje
                icono={<LockKeyhole />}
                titulo="Todavía no completaste el tablero"
                texto={`Llevás ${completas} de 9 celdas. Cuando tengas una foto en cada una, vas a poder finalizar.`}
                accion={<Boton href="/tablero">Volver al tablero</Boton>}
            />
        );
    }

    // Las celdas con una sola foto se eligen solas y se saltean
    const elegidas = completarElegidas(categorias, fotos, eleccion.elegidas);
    const porElegir = categorias.filter((categoria) => fotosDe(categoria).length > 1);
    const primeraSinElegir = porElegir.find((categoria) => !elegidas[categoria]);
    const vistaActual: Vista = vista
        ?? (primeraSinElegir ? { tipo: "paso", categoria: primeraSinElegir, desdeResumen: false } : { tipo: "resumen" });

    function elegir(categoria: string, foto: Foto, desdeResumen: boolean) {
        guardarEleccion(jugador.uuid, { elegidas: { ...elegidas, [categoria]: foto.id }, confirmadaEn: null });
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

    function confirmar() {
        guardarEleccion(jugador.uuid, { elegidas, confirmadaEn: new Date().toISOString() });
        router.push("/tablero");
    }

    return (
        <div className={styles.resumen}>
            <header className={styles.encabezadoResumen}>
                <h1 className={styles.tituloGrande}>¡Bingo!</h1>
                <p className={styles.bajada}>Estas son tus 9 fotos. Tocá una para cambiarla.</p>
            </header>

            <ul className={styles.grilla}>
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
                texto="Te quedás con estas 9 fotos y no vas a poder subir ni borrar fotos. Si te equivocaste, podés reabrirlo antes de generar el informe."
                accion="Cerrar tablero"
                accionEnCurso="Cerrando…"
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
