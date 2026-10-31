'use client'

import { useEffect, useState } from "react";
import styles from "./Respaldo.module.css";
import Dialogo from "@/components/ui/Dialogo";
import CodigoRecuperacion from "@/components/CodigoRecuperacion";
import { obtenerCodigo } from "@/lib/jugador";

type RespaldoProps = {
    abierto: boolean;
    onCerrar: () => void;
    jugadorId: string;
};

// Código de recuperación (RF-03): con la base guardando todo, alcanza para
// recuperar el tablero, las fotos y los cambios en otro celular
export default function Respaldo({ abierto, onCerrar, jugadorId }: RespaldoProps) {
    const [codigo, setCodigo] = useState<string | null>(null);
    const [sinConexion, setSinConexion] = useState(false);

    useEffect(() => {
        if (!abierto || codigo) return;
        let vigente = true;
        obtenerCodigo(jugadorId)
            .then((leido) => vigente && (leido ? setCodigo(leido) : setSinConexion(true)))
            .catch(() => vigente && setSinConexion(true));
        return () => {
            vigente = false;
        };
    }, [abierto, codigo, jugadorId]);

    return (
        <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Código de recuperación">
            <div className={styles.seccion}>
                <p className={styles.texto}>
                    Con este código recuperás tu tablero y tus fotos en otro celular, o si se borran los
                    datos del navegador. Mandátelo por WhatsApp y pegalo en «Ya tengo código».
                </p>
                {codigo ? (
                    <CodigoRecuperacion codigo={codigo} />
                ) : (
                    <p className={styles.texto} role="status">
                        {sinConexion ? "No se pudo leer el código. Revisá la conexión." : "Cargando…"}
                    </p>
                )}
            </div>
        </Dialogo>
    );
}
