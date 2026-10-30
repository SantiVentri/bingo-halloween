'use client'

import { use, useState } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SinJugador from "@/components/SinJugador";
import styles from "./EleccionFotos.module.css";
import Carrusel from "@/components/Carrusel";
import Confirmacion from "@/components/Confirmacion";
import { obtenerJugador, type Jugador } from "@/lib/jugador";
import { generarTablero } from "@/lib/tablero";
import { completarElegidas, guardarEleccion, obtenerEleccion } from "@/lib/eleccion";
import type { Foto } from "@/lib/fotos";
import { useFotos } from "@/hooks/useFotos";

// Elección de la foto final de cada celda, paso a paso (RF-16, RF-17, RF-26)
export default function EleccionFotos() {
    use(browser("El jugador se guarda en localStorage"));

    // Sin jugador no se redirige: el router recordaría la redirección y la
    // repetiría después de crear el jugador
    const jugador = obtenerJugador();
    if (!jugador) {
        return <SinJugador />;
    }
    // Con el tablero ya cerrado no hay nada que elegir. No se redirige: el router
    // recordaría la redirección y la repetiría después de reabrir el tablero
    if (obtenerEleccion(jugador.uuid).confirmadaEn) {
        return (
            <div className={styles.incompleto}>
                <h1 className={styles.titulo}>Tu tablero ya está cerrado</h1>
                <p>Para cambiar alguna foto, reabrilo desde el tablero.</p>
                <Link href="/tablero" className={styles.principal}>Ir al tablero</Link>
            </div>
        );
    }

    return <Eleccion jugador={jugador} />;
}

// paso: eligiendo una celda; desdeResumen vuelve al resumen al elegir
type Vista = { tipo: "paso"; categoria: string; desdeResumen: boolean } | { tipo: "resumen" };

function Eleccion({ jugador }: { jugador: Jugador }) {
    const router = useRouter();
    const { fotos, cargando, subiendo, reintentar, urlDeFoto } = useFotos(jugador.uuid);
    const [guardadas, setGuardadas] = useState(() => obtenerEleccion(jugador.uuid).elegidas);
    const [vista, setVista] = useState<Vista | null>(null);
    const [confirmando, setConfirmando] = useState(false);

    if (cargando) {
        return <p className={styles.cargando}>Cargando tus fotos…</p>;
    }

    const categorias: readonly string[] = generarTablero(jugador.uuid);
    const fotosDe = (categoria: string) => fotos.filter((foto) => foto.categoria === categoria);
    const completas = categorias.filter((categoria) => fotosDe(categoria).length > 0).length;

    // Detección de tablero completo (RF-15): sin las 9 no se puede finalizar
    if (completas < categorias.length) {
        return (
            <div className={styles.incompleto}>
                <h1 className={styles.titulo}>Todavía no completaste el tablero</h1>
                <p>Llevás {completas}/9 celdas. Cuando tengas una foto en cada una, vas a poder finalizar.</p>
                <Link href="/tablero" className={styles.principal}>Volver al tablero</Link>
            </div>
        );
    }

    // Las celdas con una sola foto se eligen solas y se saltean
    const elegidas = completarElegidas(categorias, fotos, guardadas);
    const porElegir = categorias.filter((categoria) => fotosDe(categoria).length > 1);
    const primeraSinElegir = porElegir.find((categoria) => !elegidas[categoria]);
    const vistaActual: Vista = vista
        ?? (primeraSinElegir ? { tipo: "paso", categoria: primeraSinElegir, desdeResumen: false } : { tipo: "resumen" });

    function elegir(categoria: string, foto: Foto, desdeResumen: boolean) {
        const nuevas = { ...elegidas, [categoria]: foto.id };
        setGuardadas(nuevas);
        guardarEleccion(jugador.uuid, { elegidas: nuevas, confirmadaEn: null });
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
                onAnterior={!desdeResumen && anterior
                    ? () => setVista({ tipo: "paso", categoria: anterior, desdeResumen: false })
                    : undefined}
                onResumen={desdeResumen || porElegir.every((otra) => elegidas[otra])
                    ? () => setVista({ tipo: "resumen" })
                    : undefined}
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
            <h1 className={styles.titulo}>¡Bingo! Estas son tus 9 fotos</h1>
            <p className={styles.texto}>
                Tocá una celda para cambiar su foto. Las celdas con una sola foto ya están elegidas.
            </p>

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
                            {foto?.estado === "pendiente" && <span className={styles.pendiente}>⏳</span>}
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
                    <span>
                        {sinSubir === 1
                            ? "Falta subir 1 foto elegida."
                            : `Faltan subir ${sinSubir} fotos elegidas.`}
                    </span>
                    <button type="button" className={styles.reintentar} onClick={reintentar} disabled={subiendo}>
                        {subiendo ? "Subiendo…" : "Reintentar"}
                    </button>
                </div>
            )}

            <button
                type="button"
                className={styles.principal}
                disabled={!listas}
                onClick={() => setConfirmando(true)}
            >
                Confirmar elección
            </button>
            <Link href="/tablero" className={styles.secundario}>Volver al tablero</Link>

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
    onAnterior?: () => void;
    onResumen?: () => void;
};

// Una celda: se desliza entre sus fotos y se elige la que se ve
function Paso({ categoria, fotos, elegida, numero, total, urlDeFoto, onElegir, onAnterior, onResumen }: PasoProps) {
    // Arranca en la elegida o, si no hay, en la más reciente
    const inicial = Math.max(0, elegida ? fotos.findIndex((foto) => foto.id === elegida) : fotos.length - 1);
    const [indice, setIndice] = useState(inicial);
    const actual = fotos[indice];

    return (
        <div className={styles.paso}>
            <div className={styles.encabezado}>
                <span className={styles.etiqueta}>Elegí tu foto · {numero} de {total}</span>
                <h1 className={styles.titulo}>{categoria}</h1>
            </div>

            <Carrusel fotos={fotos} indiceInicial={inicial} urlDeFoto={urlDeFoto} onCambiar={setIndice} />

            <button type="button" className={styles.principal} onClick={() => onElegir(actual)}>
                {actual.id === elegida ? "✓ Elegida · Seguir" : "Elegir esta"}
            </button>
            <div className={styles.navegacion}>
                {onAnterior ? (
                    <button type="button" className={styles.secundario} onClick={onAnterior}>‹ Anterior</button>
                ) : (
                    <Link href="/tablero" className={styles.secundario}>‹ Tablero</Link>
                )}
                {onResumen && (
                    <button type="button" className={styles.secundario} onClick={onResumen}>Ver resumen ›</button>
                )}
            </div>
        </div>
    );
}
