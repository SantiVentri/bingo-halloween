'use client'

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./GaleriaCelda.module.css";
import Visor from "@/components/Visor";
import type { Foto } from "@/lib/fotos";

type GaleriaCeldaProps = {
    categoria: string | null;
    fotos: Foto[];
    urlDeFoto: (foto: Foto) => string;
    onAgregarFotos: (categoria: string, archivos: File[]) => void;
    onEliminarFoto: (foto: Foto) => void;
    onCerrar: () => void;
    // El diálogo modal vuelve inerte al resto de la página: el aviso "Deshacer" va adentro
    aviso: ReactNode;
};

function formatearHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

// Fotos de una celda: agregar, ver a pantalla completa y borrar (RF-14, RF-27)
export default function GaleriaCelda({
    categoria,
    fotos,
    urlDeFoto,
    onAgregarFotos,
    onEliminarFoto,
    onCerrar,
    aviso,
}: GaleriaCeldaProps) {
    const dialogo = useRef<HTMLDialogElement>(null);
    const [fotoEnVisor, setFotoEnVisor] = useState<number | null>(null);

    useEffect(() => {
        const elemento = dialogo.current;
        if (!elemento) return;
        if (categoria && !elemento.open) elemento.showModal();
        if (!categoria && elemento.open) elemento.close();
    }, [categoria]);

    return (
        <dialog
            ref={dialogo}
            className={styles.dialogo}
            closedby="any"
            onClose={(evento) => {
                // React propaga el close del visor (que está adentro); solo cuenta el propio
                if (evento.target === evento.currentTarget) onCerrar();
            }}
        >
            {categoria && (
                <>
                    <div className={styles.encabezado}>
                        <h2 className={styles.titulo}>{categoria}</h2>
                        <button type="button" className={styles.cerrar} onClick={() => dialogo.current?.close()}>
                            Cerrar
                        </button>
                    </div>

                    <label className={styles.agregar}>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className={styles.input}
                            onChange={(evento) => {
                                const archivos = Array.from(evento.target.files ?? []);
                                evento.target.value = "";
                                if (archivos.length > 0) onAgregarFotos(categoria, archivos);
                            }}
                        />
                        + Agregar foto
                    </label>

                    {fotos.length === 0 ? (
                        <p className={styles.vacia}>Todavía no hay fotos en esta celda.</p>
                    ) : (
                        <ul className={styles.grilla}>
                            {fotos.map((foto, indice) => (
                                <li key={foto.id} className={styles.foto}>
                                    <button
                                        type="button"
                                        className={styles.ver}
                                        aria-label={`Ver foto de las ${formatearHora(foto.capturadaEn)} a pantalla completa`}
                                        onClick={() => setFotoEnVisor(indice)}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local */}
                                        <img src={urlDeFoto(foto)} alt="" className={styles.imagen} />
                                    </button>
                                    <div className={styles.datos}>
                                        <span>{formatearHora(foto.capturadaEn)}</span>
                                        <span className={foto.estado === "pendiente" ? styles.pendiente : undefined}>
                                            {foto.estado === "pendiente" ? "⏳ Pendiente" : "✓ Subida"}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.borrar}
                                        aria-label={`Borrar foto de las ${formatearHora(foto.capturadaEn)}`}
                                        onClick={() => onEliminarFoto(foto)}
                                    >
                                        Borrar
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {fotoEnVisor !== null && fotos.length > 0 && (
                        <Visor
                            fotos={fotos}
                            indiceInicial={Math.min(fotoEnVisor, fotos.length - 1)}
                            urlDeFoto={urlDeFoto}
                            onCerrar={() => setFotoEnVisor(null)}
                        />
                    )}
                </>
            )}
            {aviso}
        </dialog>
    );
}
