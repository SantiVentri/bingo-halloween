'use client'

import { use, useCallback, useEffect, useState } from "react";
import { browser } from "react-dom";
import { ArrowLeft, ArrowRight, Check, ChevronRight, RefreshCw, X } from "lucide-react";
import styles from "./RevisionGrupo.module.css";
import Boton from "@/components/ui/Boton";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import BotonCopiar from "@/components/BotonCopiar";
import { useAvisos } from "@/components/Avisos";
import Calabaza from "@/components/ilustraciones/Calabaza";
import Fantasma from "@/components/ilustraciones/Fantasma";
import { supabase } from "@/lib/supabase/cliente";
import { obtenerJugador } from "@/lib/jugador";
import { CELDAS_TABLERO } from "@/lib/tablero";
import {
    horaUltimaFoto,
    leerRevision,
    votar,
    type EntregaEnRevision,
    type FotoEnRevision,
    type Votos,
} from "@/lib/revision";

type Fila = {
    entrega: EntregaEnRevision;
    validas: number;
    votadas: number;
    ultimaFoto: number;
};

function formatearHora(milisegundos: number): string {
    return new Date(milisegundos).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

// Gana quien tenga más fotos válidas; si empatan, quien subió su última foto antes
function armarRanking(entregas: EntregaEnRevision[], votos: Votos): Fila[] {
    return entregas
        .map((entrega) => ({
            entrega,
            validas: entrega.fotos.filter((foto) => votos[foto.id] === true).length,
            votadas: entrega.fotos.filter((foto) => votos[foto.id] !== undefined).length,
            ultimaFoto: horaUltimaFoto(entrega),
        }))
        .sort((a, b) =>
            b.validas - a.validas
            || a.ultimaFoto - b.ultimaFoto
            || a.entrega.nombre.localeCompare(b.entrega.nombre));
}

function textoResultado(ranking: Fila[], completo: boolean): string {
    const lineas = ranking.map((fila, posicion) =>
        `${posicion + 1}. ${fila.entrega.nombre}: ${fila.validas}/${CELDAS_TABLERO} válidas · última foto ${formatearHora(fila.ultimaFoto)}`);
    const cierre = completo ? `🏆 Ganó ${ranking[0].entrega.nombre}` : "Faltan votos: resultado parcial";
    return ["🎃 Resultado Bingo Halloween", ...lineas, cierre].join("\n");
}

type EstadoCarga =
    | { tipo: "cargando" }
    | { tipo: "error" }
    | { tipo: "listo"; entregas: EntregaEnRevision[]; votos: Votos };

// Revisión del grupo (reemplaza al informe PDF): se ven las entregas de todos y se
// decide si cada foto vale. Los votos van a la base y se ven en vivo en todos los
// dispositivos que tengan la revisión abierta
export default function RevisionGrupo() {
    use(browser("La sesión de Supabase vive en el navegador"));

    const avisar = useAvisos();
    const [carga, setCarga] = useState<EstadoCarga>({ tipo: "cargando" });
    const [revisando, setRevisando] = useState<string | null>(null);

    // Resultados y jugador comparten la página: al pasar de uno a otro se vuelve arriba,
    // si no queda el scroll del final de la lista de fotos
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [revisando]);

    // Si falla una actualización, se siguen mostrando los datos que ya había
    const recargar = useCallback(async () => {
        try {
            const { entregas, votos } = await leerRevision();
            setCarga({ tipo: "listo", entregas, votos });
        } catch {
            setCarga((anterior) => (anterior.tipo === "listo" ? anterior : { tipo: "error" }));
        }
    }, []);

    // Carga inicial y actualización en vivo: votos nuevos y tableros que se entregan o reabren
    useEffect(() => {
        let vigente = true;
        let temporizador: number | undefined;
        leerRevision()
            .then(({ entregas, votos }) => vigente && setCarga({ tipo: "listo", entregas, votos }))
            .catch(() => vigente && setCarga({ tipo: "error" }));
        const enUnRato = () => {
            window.clearTimeout(temporizador);
            temporizador = window.setTimeout(recargar, 300);
        };
        const canal = supabase()
            .channel("revision")
            .on("postgres_changes", { event: "*", schema: "public", table: "votos" }, enUnRato)
            .on("postgres_changes", { event: "*", schema: "public", table: "jugadores" }, enUnRato)
            .subscribe();
        window.addEventListener("focus", enUnRato);
        return () => {
            vigente = false;
            window.clearTimeout(temporizador);
            supabase().removeChannel(canal);
            window.removeEventListener("focus", enUnRato);
        };
    }, [recargar]);

    // El voto se ve al instante; si la base no lo guarda, vuelve atrás
    async function cambiarVoto(fotoId: string, vale: boolean | null) {
        if (carga.tipo !== "listo") return;
        const anteriores = carga.votos;
        const nuevos = { ...anteriores };
        if (vale === null) delete nuevos[fotoId];
        else nuevos[fotoId] = vale;
        setCarga({ ...carga, votos: nuevos });
        try {
            await votar(fotoId, vale);
        } catch {
            setCarga((actual) => (actual.tipo === "listo" ? { ...actual, votos: anteriores } : actual));
            avisar({ tipo: "error", texto: "No se pudo guardar el voto. Revisá la conexión y probá de nuevo." });
        }
    }

    if (carga.tipo === "cargando") {
        return <p className={styles.cargando} role="status">Buscando las entregas…</p>;
    }

    if (carga.tipo === "error") {
        return (
            <PantallaMensaje
                icono={<RefreshCw />}
                titulo="No se pudieron cargar las entregas"
                texto="Revisá la conexión y probá de nuevo."
                accion={<Boton onClick={recargar}>Reintentar</Boton>}
            />
        );
    }

    const { entregas, votos } = carga;
    // Las fotos propias no se votan: las votan los demás
    const miId = obtenerJugador()?.id ?? null;
    const entregue = entregas.some((entrega) => entrega.uuid === miId);
    if (entregas.every((entrega) => entrega.uuid === miId)) {
        return (
            <PantallaMensaje
                icono={<Fantasma />}
                titulo={entregue ? "Todavía nadie más cerró su tablero" : "Todavía nadie cerró su tablero"}
                texto="Cuando alguien lo cierre, aparece acá para votar sus fotos."
                accion={<Boton href="/tablero" variante="secundario">Ir a mi tablero</Boton>}
            />
        );
    }

    const ranking = armarRanking(entregas, votos);
    const jugador = ranking.find((fila) => fila.entrega.uuid === revisando);
    if (jugador) {
        const posicion = ranking.indexOf(jugador);
        const siguiente = ranking.find((fila, indice) =>
            indice !== posicion && fila.entrega.uuid !== miId && fila.votadas < CELDAS_TABLERO) ?? null;
        return (
            <RevisionJugador
                key={jugador.entrega.uuid}
                fila={jugador}
                propio={jugador.entrega.uuid === miId}
                votos={votos}
                onVotar={cambiarVoto}
                siguiente={siguiente}
                onVolver={() => setRevisando(null)}
                onSiguiente={() => setRevisando(siguiente?.entrega.uuid ?? null)}
            />
        );
    }

    const completo = ranking.every((fila) => fila.votadas === CELDAS_TABLERO);
    const empate = completo && ranking.length > 1 && ranking[0].validas === ranking[1].validas;

    return (
        <div className={styles.resultados}>
            <header className={styles.encabezado}>
                <h1 className={styles.titulo}>Revisión</h1>
                <p className={styles.bajada}>
                    Decidan juntos si cada foto vale. Gana quien tenga más fotos válidas; si empatan,
                    quien subió su última foto antes.
                </p>
            </header>

            {completo ? (
                <Podio ranking={ranking} empate={empate} />
            ) : (
                <p className={styles.faltan}>Faltan votos: tocá cada jugador para revisar sus fotos.</p>
            )}

            <ol className={styles.ranking}>
                {ranking.map((fila, posicion) => (
                    <li key={fila.entrega.uuid}>
                        <button type="button" className={styles.fila} onClick={() => setRevisando(fila.entrega.uuid)}>
                            <span className={posicion === 0 && completo ? `${styles.puesto} ${styles.puestoGanador}` : styles.puesto}>
                                {posicion + 1}
                            </span>
                            <span className={styles.filaTextos}>
                                <span className={styles.filaNombre}>
                                    {fila.entrega.nombre}
                                    {fila.entrega.uuid === miId && <span className={styles.vos}>Vos</span>}
                                </span>
                                <span className={styles.filaDetalle}>
                                    {fila.votadas < CELDAS_TABLERO
                                        ? fila.entrega.uuid === miId
                                            ? `Las votan los demás · ${fila.votadas}/${CELDAS_TABLERO}`
                                            : `Votadas ${fila.votadas}/${CELDAS_TABLERO}`
                                        : `Última foto ${formatearHora(fila.ultimaFoto)}`}
                                </span>
                            </span>
                            <span className={styles.puntos} aria-label={`${fila.validas} de ${CELDAS_TABLERO} válidas`}>
                                {fila.validas}<span>/{CELDAS_TABLERO}</span>
                            </span>
                            <ChevronRight className={styles.flecha} aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ol>

            <div className={styles.acciones}>
                <BotonCopiar texto={textoResultado(ranking, completo)} etiqueta="Copiar resultado" />
            </div>
        </div>
    );
}

// Lápidas de los tres primeros, con el ganador en el medio. Son decorativas:
// el puesto y el puntaje de todos están en el ranking de abajo
function Podio({ ranking, empate }: { ranking: Fila[]; empate: boolean }) {
    const [primero, segundo, tercero] = ranking;
    const lapidas = [
        { fila: segundo, clase: styles.lapidaSegundo, puesto: 2 },
        { fila: primero, clase: styles.lapidaPrimero, puesto: 1 },
        { fila: tercero, clase: styles.lapidaTercero, puesto: 3 },
    ];

    return (
        <section className={styles.podio}>
            <p className={styles.ganadorNombre}>¡Ganó {primero.entrega.nombre}!</p>
            <p className={styles.ganadorDetalle}>
                {primero.validas}/{CELDAS_TABLERO} válidas{empate ? " · ganó el desempate por la hora de su última foto" : ""}
            </p>
            <div className={styles.lapidas} aria-hidden="true">
                {lapidas.map(({ fila, clase, puesto }) => fila && (
                    <div key={fila.entrega.uuid} className={`${styles.lapida} ${clase}`}>
                        {puesto === 1 && <Calabaza className={styles.lapidaCalabaza} />}
                        <span className={styles.lapidaPuesto}>{puesto}</span>
                        <span className={styles.lapidaNombre}>{fila.entrega.nombre}</span>
                        <span>{fila.validas}/{CELDAS_TABLERO}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

type RevisionJugadorProps = {
    fila: Fila;
    // El tablero propio se ve, pero no se vota
    propio: boolean;
    votos: Votos;
    onVotar: (fotoId: string, vale: boolean | null) => void;
    siguiente: Fila | null;
    onVolver: () => void;
    onSiguiente: () => void;
};

// Las fotos de un jugador, una abajo de la otra, con "Vale" / "No vale"
function RevisionJugador({ fila, propio, votos, onVotar, siguiente, onVolver, onSiguiente }: RevisionJugadorProps) {
    return (
        <div className={styles.jugador}>
            <header className={styles.encabezadoJugador}>
                <button type="button" className={styles.volver} onClick={onVolver} aria-label="Volver a los resultados">
                    <ArrowLeft />
                </button>
                <div className={styles.jugadorTextos}>
                    <h1 className={styles.jugadorNombre}>{fila.entrega.nombre}</h1>
                    <span className={styles.jugadorDetalle}>
                        {propio ? "Tus fotos las votan los demás · " : ""}{fila.validas} válidas · votadas {fila.votadas}/{CELDAS_TABLERO}
                    </span>
                </div>
            </header>

            <ul className={styles.fotos}>
                {fila.entrega.fotos.map((foto) => (
                    <FotoParaVotar key={foto.id} foto={foto} voto={votos[foto.id]} onVotar={propio ? null : onVotar} />
                ))}
            </ul>

            <div className={styles.pieJugador}>
                {siguiente ? (
                    <Boton anchoCompleto icono={<ArrowRight />} onClick={onSiguiente}>
                        Seguir con {siguiente.entrega.nombre}
                    </Boton>
                ) : (
                    <Boton anchoCompleto onClick={onVolver}>Ver resultados</Boton>
                )}
            </div>
        </div>
    );
}

type FotoParaVotarProps = {
    foto: FotoEnRevision;
    voto: boolean | undefined;
    // null: foto propia, solo se muestra cómo la votaron los demás
    onVotar: ((fotoId: string, vale: boolean | null) => void) | null;
};

function FotoParaVotar({ foto, voto, onVotar }: FotoParaVotarProps) {
    return (
        <li className={styles.foto}>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de Supabase Storage, sin optimizar */}
            <img src={foto.url} alt={`Foto de ${foto.categoria}`} className={styles.imagen} loading="lazy" />
            <div className={styles.fotoDatos}>
                <span className={styles.fotoCategoria}>{foto.categoria}</span>
                {/* Hora de subida según el servidor */}
                <span className={styles.fotoHora}>{formatearHora(Date.parse(foto.subidaEn))}</span>
            </div>
            {onVotar ? (
                <div className={styles.votacion} role="group" aria-label={`¿Vale la foto de ${foto.categoria}?`}>
                    <button
                        type="button"
                        className={voto === false ? `${styles.voto} ${styles.noVale}` : styles.voto}
                        aria-pressed={voto === false}
                        onClick={() => onVotar(foto.id, voto === false ? null : false)}
                    >
                        <X aria-hidden="true" /> No vale
                    </button>
                    <button
                        type="button"
                        className={voto === true ? `${styles.voto} ${styles.vale}` : styles.voto}
                        aria-pressed={voto === true}
                        onClick={() => onVotar(foto.id, voto === true ? null : true)}
                    >
                        <Check aria-hidden="true" /> Vale
                    </button>
                </div>
            ) : (
                <p className={styles.votoAjeno}>
                    {voto === undefined
                        ? "Todavía nadie la votó"
                        : voto ? "Los demás dijeron que vale" : "Los demás dijeron que no vale"}
                </p>
            )}
        </li>
    );
}
