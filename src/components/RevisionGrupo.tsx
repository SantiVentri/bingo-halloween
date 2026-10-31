'use client'

import { use, useEffect, useRef, useState } from "react";
import { browser } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, ImageOff, RefreshCw, Trophy, X } from "lucide-react";
import styles from "./RevisionGrupo.module.css";
import Boton from "@/components/ui/Boton";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import SinJugador from "@/components/SinJugador";
import { useAvisos } from "@/components/Avisos";
import Fantasma from "@/components/ilustraciones/Fantasma";
import { obtenerJugador, type Jugador } from "@/lib/jugador";
import { CELDAS_TABLERO } from "@/lib/tablero";
import {
    armarRanking,
    cantidadDeVotantes,
    formatearHora,
    hayResultado,
    misVotosFaltantes,
    SIN_VOTOS,
    votosFaltantes,
    type Conteo,
    type FilaRanking,
    type FotoEnRevision,
    type Votos,
} from "@/lib/revision";
import { useRevision } from "@/hooks/useRevision";

// Revisión del grupo (reemplaza al informe PDF): se ven las entregas del grupo y
// cada uno vota las fotos de los demás. Los conteos se ven en vivo en todos los
// dispositivos que tengan la revisión abierta. Cuando el creador cerró las entregas
// y están todos los votos, se pasa solo a la pantalla del ganador
export default function RevisionGrupo() {
    use(browser("La sesión de Supabase vive en el navegador"));

    const jugador = obtenerJugador();
    if (!jugador) {
        return <SinJugador />;
    }
    return <RevisionDelGrupo jugador={jugador} />;
}

function RevisionDelGrupo({ jugador }: { jugador: Jugador }) {
    const avisar = useAvisos();
    const router = useRouter();
    const { estado, recargar, cambiarVoto } = useRevision(jugador.id, jugador.grupo.id);
    const [revisando, setRevisando] = useState<string | null>(null);

    // Resultados y jugador comparten la página: al pasar de uno a otro se vuelve arriba,
    // si no queda el scroll del final de la lista de fotos
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [revisando]);

    // Si la votación termina con la revisión abierta, se va al ganador. Si ya había
    // terminado al entrar, no: se vino a mirar las fotos
    const completo = estado.tipo === "listo" ? hayResultado(estado.revision) : null;
    const completoAntes = useRef<boolean | null>(null);
    useEffect(() => {
        if (completo === null) return;
        if (completoAntes.current === false && completo) router.push("/resultado");
        completoAntes.current = completo;
    }, [completo, router]);

    async function votar(fotoId: string, vale: boolean | null) {
        if (!(await cambiarVoto(fotoId, vale))) {
            avisar({ tipo: "error", texto: "No se pudo guardar el voto. Revisá la conexión y probá de nuevo." });
        }
    }

    if (estado.tipo === "cargando") {
        return <p className={styles.cargando} role="status">Buscando las entregas…</p>;
    }

    if (estado.tipo === "error") {
        return (
            <PantallaMensaje
                icono={<RefreshCw />}
                titulo="No se pudieron cargar las entregas"
                texto="Revisá la conexión y probá de nuevo."
                accion={<Boton onClick={recargar}>Reintentar</Boton>}
            />
        );
    }

    const { entregas, conteos, misVotos, cerrado } = estado.revision;
    const miId = jugador.id;
    // Votan solo los que entregaron, y nunca sus propias fotos
    const entregue = entregas.some((entrega) => entrega.uuid === miId);
    if (entregas.every((entrega) => entrega.uuid === miId)) {
        return (
            <PantallaMensaje
                icono={<Fantasma />}
                titulo={entregue ? "Todavía nadie más del grupo entregó" : "Todavía nadie del grupo entregó"}
                texto="Cuando alguien de tu grupo entregue su tablero, aparece acá para votar sus fotos."
                accion={<Boton href="/tablero" variante="secundario">Ir a mi tablero</Boton>}
            />
        );
    }

    const ranking = armarRanking(entregas, conteos);
    const votantes = cantidadDeVotantes(entregas);
    const misFaltantes = entregue ? misVotosFaltantes(entregas, misVotos, miId) : 0;
    const faltanEnElGrupo = votosFaltantes(entregas, conteos);

    const jugadorRevisado = ranking.find((fila) => fila.entrega.uuid === revisando);
    if (jugadorRevisado) {
        const posicion = ranking.indexOf(jugadorRevisado);
        const meFaltan = (fila: FilaRanking) => fila.entrega.fotos.some((foto) => misVotos[foto.id] === undefined);
        const siguiente = ranking.find((fila, indice) =>
            indice !== posicion && fila.entrega.uuid !== miId && (!entregue || meFaltan(fila))) ?? null;
        return (
            <RevisionJugador
                key={jugadorRevisado.entrega.uuid}
                fila={jugadorRevisado}
                bloqueo={jugadorRevisado.entrega.uuid === miId ? "propio" : entregue ? null : "sinEntregar"}
                votantes={votantes}
                conteos={conteos}
                misVotos={misVotos}
                onVotar={votar}
                siguiente={siguiente}
                onVolver={() => setRevisando(null)}
                onSiguiente={() => setRevisando(siguiente?.entrega.uuid ?? null)}
            />
        );
    }

    let situacion: string;
    if (completo) {
        situacion = "¡Ya votaron todos! El resultado está listo.";
    } else if (!cerrado) {
        situacion = "Las entregas siguen abiertas: el ganador sale cuando el creador del grupo las cierre y estén todos los votos.";
    } else {
        situacion = `Entregas cerradas. ${faltanEnElGrupo === 1 ? "Falta 1 voto" : `Faltan ${faltanEnElGrupo} votos`} para conocer al ganador.`;
    }

    return (
        <div className={styles.resultados}>
            <header className={styles.encabezado}>
                <h1 className={styles.titulo}>Revisión</h1>
                <p className={styles.grupo}>Grupo <span className={styles.grupoCodigo}>{jugador.grupo.codigo}</span></p>
                <p className={styles.bajada}>
                    Voten cada foto de los demás: vale si más de la mitad dice que vale. Gana quien tenga
                    más fotos válidas; si empatan, quien subió su última foto antes.
                </p>
            </header>

            <div className={styles.faltan} role="status">
                <p>{situacion}</p>
                {!completo && (entregue
                    ? misFaltantes > 0 && <p className={styles.faltanMios}>{misFaltantes === 1 ? "Te falta votar 1 foto." : `Te faltan votar ${misFaltantes} fotos.`}</p>
                    : <p className={styles.faltanMios}>Solo votan los que entregaron su tablero: podés mirar las fotos.</p>)}
            </div>

            {completo && (
                <Boton href="/resultado" anchoCompleto icono={<Trophy />}>Ver el resultado</Boton>
            )}

            <ol className={styles.ranking}>
                {ranking.map((fila, posicion) => {
                    const propio = fila.entrega.uuid === miId;
                    const misVotadas = fila.entrega.fotos.filter((foto) => misVotos[foto.id] !== undefined).length;
                    let detalle: string;
                    if (propio) detalle = `Las votan los demás · ${fila.votadas}/${CELDAS_TABLERO} con todos los votos`;
                    else if (entregue) detalle = misVotadas < CELDAS_TABLERO ? `Votaste ${misVotadas}/${CELDAS_TABLERO}` : "Ya votaste todas";
                    else detalle = `${fila.votadas}/${CELDAS_TABLERO} con todos los votos`;
                    return (
                        <li key={fila.entrega.uuid}>
                            <button type="button" className={styles.fila} onClick={() => setRevisando(fila.entrega.uuid)}>
                                <span className={posicion === 0 && completo ? `${styles.puesto} ${styles.puestoGanador}` : styles.puesto}>
                                    {posicion + 1}
                                </span>
                                <span className={styles.filaTextos}>
                                    <span className={styles.filaNombre}>
                                        {fila.entrega.nombre}
                                        {propio && <span className={styles.vos}>Vos</span>}
                                    </span>
                                    <span className={styles.filaDetalle}>{detalle}</span>
                                </span>
                                <span className={styles.puntos} aria-label={`${fila.validas} de ${CELDAS_TABLERO} válidas`}>
                                    {fila.validas}<span>/{CELDAS_TABLERO}</span>
                                </span>
                                <ChevronRight className={styles.flecha} aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

type RevisionJugadorProps = {
    fila: FilaRanking;
    // Por qué no se puede votar: tablero propio o no entregué el mío
    bloqueo: "propio" | "sinEntregar" | null;
    votantes: number;
    conteos: Record<string, Conteo>;
    misVotos: Votos;
    onVotar: (fotoId: string, vale: boolean | null) => void;
    siguiente: FilaRanking | null;
    onVolver: () => void;
    onSiguiente: () => void;
};

// Las fotos de un jugador, una abajo de la otra, con "Vale" / "No vale"
function RevisionJugador({ fila, bloqueo, votantes, conteos, misVotos, onVotar, siguiente, onVolver, onSiguiente }: RevisionJugadorProps) {
    return (
        <div className={styles.jugador}>
            <header className={styles.encabezadoJugador}>
                <button type="button" className={styles.volver} onClick={onVolver} aria-label="Volver a la revisión">
                    <ArrowLeft />
                </button>
                <div className={styles.jugadorTextos}>
                    <h1 className={styles.jugadorNombre}>{fila.entrega.nombre}</h1>
                    <span className={styles.jugadorDetalle}>
                        {bloqueo === "propio" ? "Tus fotos las votan los demás · " : ""}{fila.validas} válidas · {fila.votadas}/{CELDAS_TABLERO} con todos los votos
                    </span>
                </div>
            </header>

            <ul className={styles.fotos}>
                {fila.entrega.fotos.map((foto) => (
                    <FotoParaVotar
                        key={foto.id}
                        foto={foto}
                        conteo={conteos[foto.id] ?? SIN_VOTOS}
                        votantes={votantes}
                        voto={misVotos[foto.id]}
                        bloqueo={bloqueo}
                        onVotar={onVotar}
                    />
                ))}
            </ul>

            <div className={styles.pieJugador}>
                {siguiente ? (
                    <Boton anchoCompleto icono={<ArrowRight />} onClick={onSiguiente}>
                        Seguir con {siguiente.entrega.nombre}
                    </Boton>
                ) : (
                    <Boton anchoCompleto onClick={onVolver}>Volver a la revisión</Boton>
                )}
            </div>
        </div>
    );
}

type FotoParaVotarProps = {
    foto: FotoEnRevision;
    conteo: Conteo;
    votantes: number;
    voto: boolean | undefined;
    bloqueo: "propio" | "sinEntregar" | null;
    onVotar: (fotoId: string, vale: boolean | null) => void;
};

function FotoParaVotar({ foto, conteo, votantes, voto, bloqueo, onVotar }: FotoParaVotarProps) {
    const faltan = Math.max(votantes - conteo.aFavor - conteo.enContra, 0);
    return (
        <li className={styles.foto}>
            {foto.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto de Supabase Storage, sin optimizar
                <img src={foto.url} alt={`Foto de ${foto.categoria}`} className={styles.imagen} loading="lazy" />
            ) : (
                <p className={styles.sinImagen}><ImageOff aria-hidden="true" /> No se pudo cargar la foto</p>
            )}
            <div className={styles.fotoDatos}>
                <span className={styles.fotoCategoria}>{foto.categoria}</span>
                {/* Hora de subida según el servidor */}
                <span className={styles.fotoHora}>{formatearHora(Date.parse(foto.subidaEn))}</span>
            </div>
            {/* Conteo anónimo: cuántos dijeron que vale y cuántos que no, no quién */}
            <p className={styles.conteo}>
                <span className={styles.conteoVale}><Check aria-hidden="true" /> {conteo.aFavor}</span>
                <span className={styles.conteoNoVale}><X aria-hidden="true" /> {conteo.enContra}</span>
                <span className={styles.conteoFaltan}>
                    {faltan === 0 ? "Votaron todos" : faltan === 1 ? "Falta 1 voto" : `Faltan ${faltan} votos`}
                </span>
            </p>
            {bloqueo === null ? (
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
                    {bloqueo === "propio" ? "Es tuya: la votan los demás" : "Solo votan los que entregaron su tablero"}
                </p>
            )}
        </li>
    );
}
