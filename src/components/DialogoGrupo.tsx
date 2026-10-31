'use client'

import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import styles from "./DialogoGrupo.module.css";
import Dialogo from "@/components/ui/Dialogo";
import Boton from "@/components/ui/Boton";
import Confirmacion from "@/components/Confirmacion";
import InvitarGrupo from "@/components/InvitarGrupo";
import { useAvisos } from "@/components/Avisos";
import { cerrarEntregas, ENTREGAS_MINIMAS_PARA_CERRAR, leerResumenGrupo, type ResumenGrupo } from "@/lib/grupo";
import type { Jugador } from "@/lib/jugador";

type DialogoGrupoProps = {
    abierto: boolean;
    onCerrar: () => void;
    jugador: Jugador;
};

// Mi grupo: código para invitar, cuántos entregaron y, para el creador, el botón
// para cerrar las entregas
export default function DialogoGrupo({ abierto, onCerrar, jugador }: DialogoGrupoProps) {
    const avisar = useAvisos();
    const [resumen, setResumen] = useState<ResumenGrupo | null>(null);
    const [sinConexion, setSinConexion] = useState(false);
    const [confirmando, setConfirmando] = useState(false);

    const leer = useCallback(async () => {
        try {
            setResumen(await leerResumenGrupo(jugador.id));
            setSinConexion(false);
        } catch {
            setSinConexion(true);
        }
    }, [jugador.id]);

    // Se relee cada vez que se abre: los demás pueden haber entregado mientras tanto
    useEffect(() => {
        if (!abierto) return;
        let vigente = true;
        leerResumenGrupo(jugador.id)
            .then((leido) => {
                if (!vigente) return;
                setResumen(leido);
                setSinConexion(false);
            })
            .catch(() => vigente && setSinConexion(true));
        return () => {
            vigente = false;
        };
    }, [abierto, jugador.id]);

    async function cerrar() {
        try {
            await cerrarEntregas(jugador.id);
            avisar({ tipo: "exito", texto: "Entregas cerradas: ahora a votar." });
        } catch (error) {
            const codigo = (error as { code?: string } | null)?.code;
            avisar({
                tipo: "error",
                texto: codigo === "BH002"
                    ? `Hacen falta al menos ${ENTREGAS_MINIMAS_PARA_CERRAR} tableros entregados para cerrar.`
                    : "No se pudieron cerrar las entregas. Revisá la conexión y probá de nuevo.",
            });
        }
        await leer();
    }

    const esCreador = resumen?.esCreador ?? jugador.grupo.esCreador;
    const faltan = resumen ? resumen.miembros - resumen.entregados : 0;

    return (
        <>
            <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={`Grupo ${jugador.grupo.codigo}`}>
                <div className={styles.contenido}>
                    {resumen ? (
                        <p className={styles.estado} role="status">
                            {resumen.miembros === 1 ? "1 jugador" : `${resumen.miembros} jugadores`} ·{" "}
                            {resumen.entregados === 1 ? "1 entregó" : `${resumen.entregados} entregaron`}
                        </p>
                    ) : (
                        <p className={styles.estado} role="status">
                            {sinConexion ? "No se pudo leer el grupo. Revisá la conexión." : "Cargando…"}
                        </p>
                    )}

                    {resumen?.entregasCerradas ? (
                        <p className={styles.cerrado}>
                            <Lock aria-hidden="true" />
                            <span>Las entregas están cerradas: ya no se suma nadie y solo queda votar.</span>
                        </p>
                    ) : (
                        <>
                            <p className={styles.texto}>
                                Pasales el código o el link a tus amigos: solo los de este grupo ven y votan las fotos.
                            </p>
                            <InvitarGrupo codigo={jugador.grupo.codigo} />
                        </>
                    )}

                    {esCreador && resumen && !resumen.entregasCerradas && (
                        <div className={styles.cierre}>
                            <p className={styles.texto}>
                                Creaste el grupo: cuando hayan entregado todos, cerrá las entregas para que el
                                ganador salga cuando estén todos los votos.
                            </p>
                            <Boton
                                variante="secundario"
                                anchoCompleto
                                icono={<Lock />}
                                disabled={resumen.entregados < ENTREGAS_MINIMAS_PARA_CERRAR}
                                onClick={() => setConfirmando(true)}
                            >
                                Cerrar entregas
                            </Boton>
                            {resumen.entregados < ENTREGAS_MINIMAS_PARA_CERRAR && (
                                <p className={styles.ayuda}>
                                    Se puede con al menos {ENTREGAS_MINIMAS_PARA_CERRAR} tableros entregados.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </Dialogo>
            <Confirmacion
                abierta={confirmando}
                titulo="¿Cerrar las entregas?"
                texto={`${faltan === 0
                    ? "Ya entregaron todos."
                    : faltan === 1
                        ? "1 jugador todavía no entregó y se queda afuera."
                        : `${faltan} jugadores todavía no entregaron y se quedan afuera.`} Nadie más va a poder sumarse, entregar ni reabrir su tablero. No se puede deshacer.`}
                accion="Cerrar entregas"
                accionEnCurso="Cerrando…"
                onConfirmar={cerrar}
                onCerrar={() => setConfirmando(false)}
            />
        </>
    );
}
