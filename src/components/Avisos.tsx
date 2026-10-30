'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import styles from "./Avisos.module.css";

type TipoAviso = "info" | "exito" | "error";

export type NuevoAviso = {
    texto: string;
    tipo?: TipoAviso;
    accion?: { etiqueta: string; alHacer: () => void };
    // Milisegundos hasta que se va solo; null lo deja hasta que se cierre
    duracion?: number | null;
};

type Aviso = NuevoAviso & { id: number; tipo: TipoAviso };

const DURACIONES: Record<TipoAviso, number> = { info: 4500, exito: 4500, error: 7000 };
const MAXIMO_VISIBLES = 3;

const ContextoAvisos = createContext<(aviso: NuevoAviso) => void>(() => { });

export function useAvisos() {
    return useContext(ContextoAvisos);
}

const ICONOS: Record<TipoAviso, ReactNode> = {
    info: <Info />,
    exito: <CircleCheck />,
    error: <CircleAlert />,
};

// Avisos flotantes abajo de la pantalla: se apilan y nunca se enciman con el contenido
export default function Avisos({ children }: { children: ReactNode }) {
    const [avisos, setAvisos] = useState<Aviso[]>([]);
    const siguienteId = useRef(0);

    const cerrar = useCallback((id: number) => {
        setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id));
    }, []);

    const avisar = useCallback((nuevo: NuevoAviso) => {
        const tipo = nuevo.tipo ?? "info";
        const aviso: Aviso = { ...nuevo, tipo, id: siguienteId.current++ };
        // El mismo mensaje no se repite: el nuevo reemplaza al anterior
        setAvisos((actuales) => [
            ...actuales.filter((otro) => otro.texto !== aviso.texto),
            aviso,
        ].slice(-MAXIMO_VISIBLES));
        const duracion = nuevo.duracion === undefined ? DURACIONES[tipo] : nuevo.duracion;
        if (duracion !== null) window.setTimeout(() => cerrar(aviso.id), duracion);
    }, [cerrar]);

    return (
        <ContextoAvisos value={avisar}>
            {children}
            <ol className={styles.avisos} aria-live="polite">
                {avisos.map((aviso) => (
                    <li key={aviso.id} className={`${styles.aviso} ${styles[aviso.tipo]}`} role={aviso.tipo === "error" ? "alert" : "status"}>
                        <span className={styles.icono} aria-hidden="true">{ICONOS[aviso.tipo]}</span>
                        <span className={styles.texto}>{aviso.texto}</span>
                        {aviso.accion && (
                            <button
                                type="button"
                                className={styles.accion}
                                onClick={() => {
                                    aviso.accion?.alHacer();
                                    cerrar(aviso.id);
                                }}
                            >
                                {aviso.accion.etiqueta}
                            </button>
                        )}
                        <button type="button" className={styles.cerrar} onClick={() => cerrar(aviso.id)} aria-label="Cerrar aviso">
                            <X />
                        </button>
                    </li>
                ))}
            </ol>
        </ContextoAvisos>
    );
}
