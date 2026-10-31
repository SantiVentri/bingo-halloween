'use client'

import { use, type CSSProperties } from "react";
import { browser } from "react-dom";
import { Check, Hourglass, ImageOff, RefreshCw, X } from "lucide-react";
import styles from "./Resultado.module.css";
import Boton from "@/components/ui/Boton";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import SinJugador from "@/components/SinJugador";
import BotonCopiar from "@/components/BotonCopiar";
import Calabaza from "@/components/ilustraciones/Calabaza";
import { obtenerJugador, type Jugador } from "@/lib/jugador";
import { CELDAS_TABLERO, LADO_TABLERO } from "@/lib/tablero";
import {
    armarRanking,
    cantidadDeVotantes,
    esValida,
    formatearHora,
    hayResultado,
    SIN_VOTOS,
    textoResultado,
    type Conteos,
    type FilaRanking,
} from "@/lib/revision";
import { useRevision } from "@/hooks/useRevision";

// Pantalla del ganador: aparece cuando el creador cerró las entregas y todos los
// entregados votaron todas las fotos de los demás. Sigue en vivo por si alguien
// cambia un voto
export default function Resultado() {
    use(browser("La sesión de Supabase vive en el navegador"));

    const jugador = obtenerJugador();
    if (!jugador) {
        return <SinJugador />;
    }
    return <ResultadoDelGrupo jugador={jugador} />;
}

function ResultadoDelGrupo({ jugador }: { jugador: Jugador }) {
    const { estado, recargar } = useRevision(jugador.id, jugador.grupo.id);

    if (estado.tipo === "cargando") {
        return <p className={styles.cargando} role="status">Contando los votos…</p>;
    }

    if (estado.tipo === "error") {
        return (
            <PantallaMensaje
                icono={<RefreshCw />}
                titulo="No se pudo cargar el resultado"
                texto="Revisá la conexión y probá de nuevo."
                accion={<Boton onClick={recargar}>Reintentar</Boton>}
            />
        );
    }

    const { revision } = estado;
    if (!hayResultado(revision)) {
        return (
            <PantallaMensaje
                icono={<Hourglass />}
                titulo="Todavía no hay ganador"
                texto={revision.cerrado
                    ? "Faltan votos: el ganador aparece cuando todos hayan votado todas las fotos."
                    : "El creador del grupo todavía no cerró las entregas."}
                accion={<Boton href="/revision">Ir a la revisión</Boton>}
            />
        );
    }

    const ranking = armarRanking(revision.entregas, revision.conteos);
    const votantes = cantidadDeVotantes(revision.entregas);
    const [ganador] = ranking;
    const empate = ranking.length > 1 && ranking[0].validas === ranking[1].validas;

    return (
        <div className={styles.resultado}>
            <header className={styles.encabezado}>
                <h1 className={styles.titulo}>Resultado</h1>
                <p className={styles.grupo}>Grupo <span className={styles.grupoCodigo}>{jugador.grupo.codigo}</span></p>
            </header>

            <Podio ranking={ranking} empate={empate} />

            <section className={styles.seccion}>
                <h2 className={styles.subtitulo}>
                    {ganador.entrega.uuid === jugador.id ? "Tu tablero" : `El tablero de ${ganador.entrega.nombre}`}
                </h2>
                <TableroGanador fila={ganador} conteos={revision.conteos} votantes={votantes} />
            </section>

            <section className={styles.seccion}>
                <h2 className={styles.subtitulo}>Posiciones</h2>
                <ol className={styles.ranking}>
                    {ranking.map((fila, posicion) => (
                        <li key={fila.entrega.uuid} className={styles.fila}>
                            <span className={posicion === 0 ? `${styles.puesto} ${styles.puestoGanador}` : styles.puesto}>
                                {posicion + 1}
                            </span>
                            <span className={styles.filaTextos}>
                                <span className={styles.filaNombre}>
                                    {fila.entrega.nombre}
                                    {fila.entrega.uuid === jugador.id && <span className={styles.vos}>Vos</span>}
                                </span>
                                <span className={styles.filaDetalle}>Última foto {formatearHora(fila.ultimaFoto)}</span>
                            </span>
                            <span className={styles.puntos} aria-label={`${fila.validas} de ${CELDAS_TABLERO} válidas`}>
                                {fila.validas}<span>/{CELDAS_TABLERO}</span>
                            </span>
                        </li>
                    ))}
                </ol>
            </section>

            <div className={styles.acciones}>
                <BotonCopiar texto={textoResultado(ranking)} etiqueta="Copiar resultado" />
                <Boton href="/revision" variante="fantasma" anchoCompleto>Ver todas las fotos</Boton>
            </div>
        </div>
    );
}

// Lápidas de los tres primeros, con el ganador en el medio. Son decorativas:
// el puesto y el puntaje de todos están en las posiciones de abajo
function Podio({ ranking, empate }: { ranking: FilaRanking[]; empate: boolean }) {
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
                {primero.validas}/{CELDAS_TABLERO} fotos válidas{empate ? " · ganó el desempate por la hora de su última foto" : ""}
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

// Las 9 fotos del ganador: las que no valieron quedan apagadas
function TableroGanador({ fila, conteos, votantes }: { fila: FilaRanking; conteos: Conteos; votantes: number }) {
    return (
        <ul className={styles.grilla} style={{ "--lado": LADO_TABLERO } as CSSProperties}>
            {fila.entrega.fotos.map((foto) => {
                const conteo = conteos[foto.id] ?? SIN_VOTOS;
                const valida = esValida(conteo, votantes);
                return (
                    <li key={foto.id} className={valida ? styles.celda : `${styles.celda} ${styles.celdaNoVale}`}>
                        {foto.url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- foto de Supabase Storage, sin optimizar
                            <img src={foto.url} alt={`Foto de ${foto.categoria}`} className={styles.imagen} />
                        ) : (
                            <span className={styles.sinImagen}><ImageOff aria-hidden="true" /></span>
                        )}
                        <span className={valida ? `${styles.marca} ${styles.marcaVale}` : `${styles.marca} ${styles.marcaNoVale}`}>
                            {valida ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                            {conteo.aFavor}/{votantes}
                        </span>
                        <span className={styles.celdaCategoria}>{foto.categoria}</span>
                    </li>
                );
            })}
        </ul>
    );
}
