'use client'

import { use } from "react";
import { browser } from "react-dom";
import { redirect } from "next/navigation";
import styles from "./TableroDelJugador.module.css";
import Tablero from "@/components/Tablero";
import MiCodigo from "@/components/MiCodigo";
import { obtenerJugador } from "@/lib/jugador";

// Lee el jugador de localStorage; sin jugador vuelve al ingreso (RF-02)
export default function TableroDelJugador() {
    use(browser("El jugador se guarda en localStorage"));

    const jugador = obtenerJugador();
    if (!jugador) {
        redirect("/");
    }

    return (
        <>
            <div className={styles.barra}>
                <span className={styles.saludo}>Hola, {jugador.nombre}</span>
                <MiCodigo codigo={jugador.uuid} />
            </div>
            <div className={styles.grilla}>
                <Tablero uuid={jugador.uuid} />
            </div>
        </>
    );
}
