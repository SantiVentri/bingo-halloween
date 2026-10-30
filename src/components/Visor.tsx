'use client'

import { useEffect, useRef, useState, type MouseEvent } from "react";
import styles from "./Visor.module.css";
import type { Foto } from "@/lib/fotos";

type VisorProps = {
    fotos: Foto[];
    indiceInicial: number;
    urlDeFoto: (foto: Foto) => string;
    onCerrar: () => void;
};

const AUMENTO = 2.5;

// Fotos de la celda a pantalla completa: se desliza entre fotos y un toque
// hace zoom; con zoom se recorre la foto arrastrando (RF-27)
export default function Visor({ fotos, indiceInicial, urlDeFoto, onCerrar }: VisorProps) {
    const dialogo = useRef<HTMLDialogElement>(null);
    const pista = useRef<HTMLDivElement>(null);
    const [indice, setIndice] = useState(indiceInicial);
    const [conZoom, setConZoom] = useState(false);

    useEffect(() => {
        dialogo.current?.showModal();
        const elemento = pista.current;
        if (elemento) elemento.scrollLeft = indiceInicial * elemento.clientWidth;
    }, [indiceInicial]);

    function irA(destino: number) {
        const elemento = pista.current;
        if (!elemento || destino < 0 || destino >= fotos.length) return;
        setConZoom(false);
        elemento.scrollTo({ left: destino * elemento.clientWidth, behavior: "smooth" });
    }

    function alDesplazar() {
        const elemento = pista.current;
        if (!elemento) return;
        const actual = Math.round(elemento.scrollLeft / elemento.clientWidth);
        if (actual !== indice) {
            setIndice(actual);
            setConZoom(false);
        }
    }

    // Al hacer zoom, centra la parte de la foto que se tocó
    function alternarZoom(evento: MouseEvent<HTMLImageElement>) {
        const imagen = evento.currentTarget;
        const marco = imagen.parentElement;
        if (!marco) return;
        if (conZoom) {
            setConZoom(false);
            return;
        }
        const caja = imagen.getBoundingClientRect();
        const x = (evento.clientX - caja.left) / caja.width;
        const y = (evento.clientY - caja.top) / caja.height;
        setConZoom(true);
        requestAnimationFrame(() => {
            marco.scrollLeft = x * marco.scrollWidth - marco.clientWidth / 2;
            marco.scrollTop = y * marco.scrollHeight - marco.clientHeight / 2;
        });
    }

    return (
        <dialog
            ref={dialogo}
            className={styles.visor}
            onClose={onCerrar}
            onKeyDown={(evento) => {
                if (evento.key === "ArrowLeft") irA(indice - 1);
                if (evento.key === "ArrowRight") irA(indice + 1);
            }}
            aria-label="Fotos a pantalla completa"
        >
            <div
                ref={pista}
                className={conZoom ? `${styles.pista} ${styles.pistaFija}` : styles.pista}
                onScroll={alDesplazar}
            >
                {fotos.map((foto, posicion) => {
                    const ampliada = conZoom && posicion === indice;
                    return (
                        <div key={foto.id} className={ampliada ? `${styles.marco} ${styles.marcoAmpliado}` : styles.marco}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local */}
                            <img
                                src={urlDeFoto(foto)}
                                alt={`Foto ${posicion + 1} de ${fotos.length}`}
                                className={styles.imagen}
                                style={ampliada ? { width: `${AUMENTO * 100}%`, height: `${AUMENTO * 100}%` } : undefined}
                                onClick={alternarZoom}
                            />
                        </div>
                    );
                })}
            </div>

            <div className={styles.barra}>
                <button type="button" className={styles.boton} onClick={() => irA(indice - 1)} disabled={indice === 0} aria-label="Foto anterior">
                    ‹
                </button>
                <span className={styles.posicion}>{indice + 1} / {fotos.length}</span>
                <button type="button" className={styles.boton} onClick={() => irA(indice + 1)} disabled={indice === fotos.length - 1} aria-label="Foto siguiente">
                    ›
                </button>
                <button type="button" className={styles.boton} onClick={() => dialogo.current?.close()} aria-label="Cerrar">
                    ✕
                </button>
            </div>
        </dialog>
    );
}
