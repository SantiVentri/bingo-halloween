'use client'

import { CloudOff } from "lucide-react";
import styles from "./Respaldo.module.css";
import Dialogo from "@/components/ui/Dialogo";
import CodigoRecuperacion from "@/components/CodigoRecuperacion";
import BotonCopiar from "@/components/BotonCopiar";
import { generarRespaldo } from "@/lib/respaldo";
import type { Jugador } from "@/lib/jugador";
import type { Foto } from "@/lib/fotos";
import type { Cambio } from "@/lib/tablero";

type RespaldoProps = {
    abierto: boolean;
    onCerrar: () => void;
    jugador: Jugador;
    fotos: Foto[];
    cambios: readonly Cambio[];
};

function plural(cantidad: number, singular: string, plural: string): string {
    return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

// Código de recuperación y respaldo completo para otro celular (RF-03, RF-21)
export default function Respaldo({ abierto, onCerrar, jugador, fotos, cambios }: RespaldoProps) {
    const respaldo = generarRespaldo(jugador, fotos, cambios);
    const subidas = fotos.filter((foto) => foto.estado === "subida").length;
    const pendientes = fotos.length - subidas;
    const partes = [
        "tu código",
        plural(subidas, "foto subida", "fotos subidas"),
        ...(cambios.length > 0 ? [plural(cambios.length, "cambio de categoría", "cambios de categoría")] : []),
    ];
    const incluye = `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;

    return (
        <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Respaldo">
            <section className={styles.seccion}>
                <h3 className={styles.subtitulo}>Código de recuperación</h3>
                <p className={styles.texto}>
                    Con este código recuperás tu tablero si cambiás de celular o se borran los datos del navegador.
                </p>
                <CodigoRecuperacion codigo={jugador.uuid} />
            </section>

            <section className={styles.seccion}>
                <h3 className={styles.subtitulo}>Respaldo completo</h3>
                <p className={styles.texto}>
                    {subidas === 0 && cambios.length === 0
                        ? "Por ahora tiene solo tu código: todavía no hay fotos subidas."
                        : `Incluye ${incluye}.`}{" "}
                    Mandátelo por WhatsApp y pegalo en «Ya tengo código» para recuperar todo.
                </p>
                {pendientes > 0 && (
                    <p className={styles.advertencia}>
                        <CloudOff aria-hidden="true" />
                        {pendientes === 1
                            ? "1 foto todavía no se subió y no entra en el respaldo."
                            : `${pendientes} fotos todavía no se subieron y no entran en el respaldo.`}
                    </p>
                )}
                <BotonCopiar texto={respaldo} etiqueta="Copiar respaldo" variante="primario" />
                <details className={styles.detalle}>
                    <summary>Ver el texto del respaldo</summary>
                    <pre className={styles.respaldo}>{respaldo}</pre>
                </details>
            </section>
        </Dialogo>
    );
}
