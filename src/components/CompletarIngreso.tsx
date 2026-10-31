'use client'

import { use, useEffect, useState } from "react";
import { browser } from "react-dom";
import { TriangleAlert } from "lucide-react";
import styles from "./Ingreso.module.css";
import Boton from "@/components/ui/Boton";
import PantallaMensaje from "@/components/ui/PantallaMensaje";
import { completarIngreso, ErrorDeIngreso } from "@/lib/cuenta";

// Una sola vez por carga: en desarrollo los efectos corren dos veces y el
// traspaso no se puede repetir
let enCurso: Promise<string | null> | null = null;

// Termina el ingreso con Google y sigue a donde iba (el inicio o una invitación)
export default function CompletarIngreso() {
    use(browser("La sesión de Supabase vive en el navegador"));
    const [error, setError] = useState("");

    useEffect(() => {
        enCurso ??= completarIngreso(new URL(window.location.href));
        enCurso
            .then((siguiente) => {
                // Navegación completa: el inicio arranca de cero con la sesión nueva
                if (siguiente) window.location.replace(siguiente);
            })
            .catch((causa: unknown) => {
                enCurso = null;
                setError(causa instanceof ErrorDeIngreso
                    ? causa.message
                    : "No se pudo entrar. Revisá la conexión y probá de nuevo.");
            });
    }, []);

    if (error) {
        return (
            <PantallaMensaje
                icono={<TriangleAlert />}
                titulo="No pudimos entrar"
                texto={error}
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- vuelve a empezar el ingreso
                accion={<Boton onClick={() => window.location.assign("/")}>Volver a intentar</Boton>}
            />
        );
    }
    return <p className={styles.cargando}>Entrando…</p>;
}
