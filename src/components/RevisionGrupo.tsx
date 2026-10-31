'use client'

import { use, useCallback, useEffect, useState } from "react";
import { browser } from "react-dom";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Ghost, RefreshCw, Trophy, X } from "lucide-react";
import styles from "./RevisionGrupo.module.css";
import Boton from "@/components/ui/Boton";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import BotonCopiar from "@/components/BotonCopiar";
import { horaUltimaFoto, type EntregaEnRevision, type FotoEnRevision } from "@/lib/entrega";
import { votar, type Votos } from "@/lib/votos";
import { useVotos } from "@/hooks/useAlmacen";

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
            validas: entrega.fotos.filter((foto) => votos[foto.url] === true).length,
            votadas: entrega.fotos.filter((foto) => votos[foto.url] !== undefined).length,
            ultimaFoto: horaUltimaFoto(entrega),
        }))
        .sort((a, b) =>
            b.validas - a.validas
            || a.ultimaFoto - b.ultimaFoto
            || a.entrega.nombre.localeCompare(b.entrega.nombre));
}

function textoResultado(ranking: Fila[], completo: boolean): string {
    const lineas = ranking.map((fila, posicion) =>
        `${posicion + 1}. ${fila.entrega.nombre}: ${fila.validas}/9 válidas · última foto ${formatearHora(fila.ultimaFoto)}`);
    const cierre = completo ? `🏆 Ganó ${ranking[0].entrega.nombre}` : "Faltan votos: resultado parcial";
    return ["🎃 Resultado Bingo Halloween", ...lineas, cierre].join("\n");
}

async function pedirEntregas(): Promise<EntregaEnRevision[]> {
    const respuesta = await fetch("/api/entregas", { cache: "no-store" });
    if (!respuesta.ok) throw new Error("No se pudieron leer las entregas");
    return respuesta.json();
}

type EstadoCarga =
    | { tipo: "cargando" }
    | { tipo: "error" }
    | { tipo: "listo"; entregas: EntregaEnRevision[] };

// Revisión del grupo (reemplaza al informe PDF): se juntan, ven las entregas de
// todos en un solo dispositivo y deciden si cada foto vale
export default function RevisionGrupo() {
    use(browser("Los votos se guardan en este dispositivo"));

    const votos = useVotos();
    const [carga, setCarga] = useState<EstadoCarga>({ tipo: "cargando" });
    const [revisando, setRevisando] = useState<string | null>(null);
    const [actualizando, setActualizando] = useState(false);

    // Si falla una actualización, se siguen mostrando las entregas que ya había
    const mostrarError = useCallback(() => {
        setCarga((anterior) => (anterior.tipo === "listo" ? anterior : { tipo: "error" }));
    }, []);

    async function cargar() {
        setActualizando(true);
        try {
            setCarga({ tipo: "listo", entregas: await pedirEntregas() });
        } catch {
            mostrarError();
        } finally {
            setActualizando(false);
        }
    }

    useEffect(() => {
        let vigente = true;
        pedirEntregas()
            .then((entregas) => vigente && setCarga({ tipo: "listo", entregas }))
            .catch(() => vigente && mostrarError());
        return () => {
            vigente = false;
        };
    }, [mostrarError]);

    if (carga.tipo === "cargando") {
        return <p className={styles.cargando} role="status">Buscando las entregas…</p>;
    }

    if (carga.tipo === "error") {
        return (
            <PantallaMensaje
                icono={<RefreshCw />}
                titulo="No se pudieron cargar las entregas"
                texto="Revisá la conexión y probá de nuevo."
                accion={<Boton onClick={cargar}>Reintentar</Boton>}
            />
        );
    }

    const { entregas } = carga;
    if (entregas.length === 0) {
        return (
            <PantallaMensaje
                icono={<Ghost />}
                titulo="Todavía nadie entregó"
                texto="Las entregas aparecen cuando alguien cierra su tablero. Pueden tardar unos minutos en llegar."
                accion={<Boton variante="secundario" icono={<RefreshCw />} onClick={cargar} disabled={actualizando}>{actualizando ? "Buscando…" : "Actualizar"}</Boton>}
            />
        );
    }

    const ranking = armarRanking(entregas, votos);
    const jugador = ranking.find((fila) => fila.entrega.uuid === revisando);
    if (jugador) {
        const posicion = ranking.indexOf(jugador);
        const siguiente = ranking.find((fila, indice) => indice !== posicion && fila.votadas < 9) ?? null;
        return (
            <RevisionJugador
                key={jugador.entrega.uuid}
                fila={jugador}
                votos={votos}
                siguiente={siguiente}
                onVolver={() => setRevisando(null)}
                onSiguiente={() => setRevisando(siguiente?.entrega.uuid ?? null)}
            />
        );
    }

    const completo = ranking.every((fila) => fila.votadas === 9);
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
                <div className={styles.ganador}>
                    <Trophy aria-hidden="true" />
                    <div>
                        <p className={styles.ganadorNombre}>¡Ganó {ranking[0].entrega.nombre}!</p>
                        <p className={styles.ganadorDetalle}>
                            {ranking[0].validas}/9 válidas{empate ? " · ganó el desempate por la hora de su última foto" : ""}
                        </p>
                    </div>
                </div>
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
                                <span className={styles.filaNombre}>{fila.entrega.nombre}</span>
                                <span className={styles.filaDetalle}>
                                    {fila.votadas < 9 ? `Votadas ${fila.votadas}/9` : `Última foto ${formatearHora(fila.ultimaFoto)}`}
                                </span>
                            </span>
                            <span className={styles.puntos} aria-label={`${fila.validas} de 9 válidas`}>
                                {fila.validas}<span>/9</span>
                            </span>
                            <ChevronRight className={styles.flecha} aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ol>

            <div className={styles.acciones}>
                <BotonCopiar texto={textoResultado(ranking, completo)} etiqueta="Copiar resultado" />
                <Boton variante="fantasma" anchoCompleto icono={<RefreshCw />} onClick={cargar} disabled={actualizando}>
                    {actualizando ? "Buscando…" : "Buscar entregas nuevas"}
                </Boton>
            </div>
        </div>
    );
}

type RevisionJugadorProps = {
    fila: Fila;
    votos: Votos;
    siguiente: Fila | null;
    onVolver: () => void;
    onSiguiente: () => void;
};

// Las 9 fotos de un jugador, una abajo de la otra, con "Vale" / "No vale"
function RevisionJugador({ fila, votos, siguiente, onVolver, onSiguiente }: RevisionJugadorProps) {
    return (
        <div className={styles.jugador}>
            <header className={styles.encabezadoJugador}>
                <button type="button" className={styles.volver} onClick={onVolver} aria-label="Volver a los resultados">
                    <ArrowLeft />
                </button>
                <div className={styles.jugadorTextos}>
                    <h1 className={styles.jugadorNombre}>{fila.entrega.nombre}</h1>
                    <span className={styles.jugadorDetalle}>
                        {fila.validas} válidas · votadas {fila.votadas}/9
                    </span>
                </div>
            </header>

            <ul className={styles.fotos}>
                {fila.entrega.fotos.map((foto) => (
                    <FotoParaVotar key={foto.url} foto={foto} voto={votos[foto.url]} votos={votos} />
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

function FotoParaVotar({ foto, voto, votos }: { foto: FotoEnRevision; voto: boolean | undefined; votos: Votos }) {
    const hora = foto.subidaServidor ?? Date.parse(foto.subidaEn ?? foto.capturadaEn);
    return (
        <li className={styles.foto}>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de UploadThing, sin optimizar */}
            <img src={foto.url} alt={`Foto de ${foto.categoria}`} className={styles.imagen} loading="lazy" />
            <div className={styles.fotoDatos}>
                <span className={styles.fotoCategoria}>{foto.categoria}</span>
                {/* Sin la hora del servidor se usa la del celular, aproximada */}
                <span className={styles.fotoHora}>
                    {foto.subidaServidor ? "" : "≈ "}{formatearHora(hora)}
                </span>
            </div>
            <div className={styles.votacion} role="group" aria-label={`¿Vale la foto de ${foto.categoria}?`}>
                <button
                    type="button"
                    className={voto === false ? `${styles.voto} ${styles.noVale}` : styles.voto}
                    aria-pressed={voto === false}
                    onClick={() => votar(votos, foto.url, voto === false ? null : false)}
                >
                    <X aria-hidden="true" /> No vale
                </button>
                <button
                    type="button"
                    className={voto === true ? `${styles.voto} ${styles.vale}` : styles.voto}
                    aria-pressed={voto === true}
                    onClick={() => votar(votos, foto.url, voto === true ? null : true)}
                >
                    <Check aria-hidden="true" /> Vale
                </button>
            </div>
        </li>
    );
}
