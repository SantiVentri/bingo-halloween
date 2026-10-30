'use client'

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, CloudUpload } from "lucide-react";
import styles from "./Carrusel.module.css";
import type { Foto } from "@/lib/fotos";

type CarruselProps = {
    fotos: Foto[];
    indiceInicial: number;
    urlDeFoto: (foto: Foto) => string;
    onCambiar: (indice: number) => void;
};

const AUMENTO = 2.5;

// Fotos de una celda en grande: se desliza entre fotos y un toque hace zoom;
// con zoom se recorre la foto arrastrando (RF-27)
export default function Carrusel({ fotos, indiceInicial, urlDeFoto, onCambiar }: CarruselProps) {
    const pista = useRef<HTMLDivElement>(null);
    const [indice, setIndice] = useState(indiceInicial);
    const [conZoom, setConZoom] = useState(false);

    useEffect(() => {
        const elemento = pista.current;
        if (elemento) elemento.scrollLeft = indiceInicial * elemento.clientWidth;
    }, [indiceInicial]);

    function cambiar(nuevo: number) {
        setIndice(nuevo);
        setConZoom(false);
        onCambiar(nuevo);
    }

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
        if (actual !== indice) cambiar(actual);
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
        <div
            className={styles.carrusel}
            tabIndex={0}
            aria-roledescription="carrusel"
            aria-label={`Foto ${indice + 1} de ${fotos.length}`}
            onKeyDown={(evento) => {
                if (evento.key === "ArrowLeft") irA(indice - 1);
                if (evento.key === "ArrowRight") irA(indice + 1);
            }}
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
                                draggable={false}
                            />
                            {foto.estado === "pendiente" && (
                                <span className={styles.pendiente}><CloudUpload aria-hidden="true" /> Sin subir</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {fotos.length > 1 && (
                <>
                    <button type="button" className={`${styles.flecha} ${styles.flechaAnterior}`} onClick={() => irA(indice - 1)} disabled={indice === 0} aria-label="Foto anterior">
                        <ChevronLeft />
                    </button>
                    <button type="button" className={`${styles.flecha} ${styles.flechaSiguiente}`} onClick={() => irA(indice + 1)} disabled={indice === fotos.length - 1} aria-label="Foto siguiente">
                        <ChevronRight />
                    </button>
                    <div className={styles.puntos} aria-hidden="true">
                        {fotos.map((foto, posicion) => (
                            <span key={foto.id} className={posicion === indice ? styles.puntoActual : styles.punto} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
