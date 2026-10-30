'use client'

import { useEffect, useRef, useState } from "react";
import { Download, RectangleVertical, RefreshCw, Share2, Square } from "lucide-react";
import styles from "./CompartirTablero.module.css";
import Boton from "@/components/ui/Boton";
import Dialogo from "@/components/ui/Dialogo";
import {
    generarImagenTablero,
    nombreDeArchivo,
    type CeldaImagen,
    type FormatoImagen,
} from "@/lib/imagenTablero";

type CompartirTableroProps = {
    abierto: boolean;
    onCerrar: () => void;
    celdas: CeldaImagen[];
    nombre: string;
};

const OPCIONES = [
    { formato: "publicacion", etiqueta: "Publicación", icono: <Square /> },
    { formato: "historia", etiqueta: "Historia", icono: <RectangleVertical /> },
] as const;

// Genera la imagen del tablero y la comparte o la descarga
export default function CompartirTablero({ abierto, onCerrar, celdas, nombre }: CompartirTableroProps) {
    return (
        <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Compartí tu tablero">
            <Contenido celdas={celdas} nombre={nombre} />
        </Dialogo>
    );
}

// Vive solo con el diálogo abierto: al reabrirlo se regenera con las fotos del momento
function Contenido({ celdas: celdasIniciales, nombre: nombreInicial }: Omit<CompartirTableroProps, "abierto" | "onCerrar">) {
    // Fijos mientras está abierto: si no, cada actualización en vivo regeneraría la imagen
    const [{ celdas, nombre }] = useState({ celdas: celdasIniciales, nombre: nombreInicial });
    const [formato, setFormato] = useState<FormatoImagen>("publicacion");
    const [imagenes, setImagenes] = useState<Partial<Record<FormatoImagen, Blob>>>({});
    const [errorDe, setErrorDe] = useState<FormatoImagen | null>(null);
    const [intento, setIntento] = useState(0);
    const [avisoCompartir, setAvisoCompartir] = useState(false);
    const vistaPrevia = useRef<HTMLImageElement>(null);

    const imagen = imagenes[formato];

    // Se genera antes de que toque Compartir: Safari exige que navigator.share
    // salga directo del toque, sin esperas en el medio
    useEffect(() => {
        if (imagen) return;
        let cancelado = false;
        generarImagenTablero({ celdas, nombre, formato })
            .then((generada) => {
                if (!cancelado) setImagenes((anteriores) => ({ ...anteriores, [formato]: generada }));
            })
            .catch(() => {
                if (!cancelado) setErrorDe(formato);
            });
        return () => {
            cancelado = true;
        };
    }, [celdas, nombre, formato, imagen, intento]);

    useEffect(() => {
        const elemento = vistaPrevia.current;
        if (!imagen || !elemento) return;
        const url = URL.createObjectURL(imagen);
        elemento.src = url;
        return () => URL.revokeObjectURL(url);
    }, [imagen]);

    const nombreArchivo = nombreDeArchivo(nombre, formato);
    const archivo = imagen ? new File([imagen], nombreArchivo, { type: imagen.type }) : null;
    const puedeCompartir = archivo !== null && Boolean(navigator.canShare?.({ files: [archivo] }));
    const fallo = errorDe === formato;

    function elegirFormato(nuevo: FormatoImagen) {
        setFormato(nuevo);
        setAvisoCompartir(false);
    }

    function reintentar() {
        setErrorDe(null);
        setIntento((anterior) => anterior + 1);
    }

    async function compartir() {
        if (!archivo) return;
        setAvisoCompartir(false);
        try {
            await navigator.share({ files: [archivo] });
        } catch (error) {
            // AbortError: cerró la hoja de compartir sin elegir nada
            if (!(error instanceof DOMException && error.name === "AbortError")) setAvisoCompartir(true);
        }
    }

    function descargar() {
        if (!imagen) return;
        const url = URL.createObjectURL(imagen);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreArchivo;
        enlace.click();
        // Con margen: algunos navegadores empiezan la descarga después del clic
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    return (
        <div className={styles.contenedor}>
            <div className={styles.formatos} role="group" aria-label="Formato de la imagen">
                {OPCIONES.map((opcion) => (
                    <button
                        key={opcion.formato}
                        type="button"
                        className={styles.formato}
                        aria-pressed={formato === opcion.formato}
                        onClick={() => elegirFormato(opcion.formato)}
                    >
                        <span className={styles.formatoIcono} aria-hidden="true">{opcion.icono}</span>
                        {opcion.etiqueta}
                    </button>
                ))}
            </div>

            <div className={styles.vista}>
                {imagen && (
                    // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local
                    <img ref={vistaPrevia} key={formato} alt="Vista previa de tu tablero" className={styles.imagen} />
                )}
                {!imagen && !fallo && <p className={styles.estado} role="status">Preparando tu imagen…</p>}
                {fallo && (
                    <div className={styles.error} role="alert">
                        <p>No se pudieron cargar tus fotos. Revisá la conexión y probá de nuevo.</p>
                        <Boton variante="secundario" tamano="s" icono={<RefreshCw />} onClick={reintentar}>
                            Reintentar
                        </Boton>
                    </div>
                )}
            </div>

            <div className={styles.acciones}>
                {puedeCompartir && (
                    <Boton anchoCompleto icono={<Share2 />} onClick={compartir}>Compartir</Boton>
                )}
                <Boton
                    anchoCompleto
                    variante={puedeCompartir ? "secundario" : "primario"}
                    icono={<Download />}
                    disabled={!imagen}
                    onClick={descargar}
                >
                    Descargar
                </Boton>
                {/* Adentro de un diálogo los avisos flotantes no se ven: la ayuda va acá */}
                {avisoCompartir && (
                    <p className={styles.ayuda} role="alert">No se pudo compartir. Probá con Descargar.</p>
                )}
                {imagen && <p className={styles.ayuda}>Si no se descarga, mantené apretada la imagen para guardarla.</p>}
            </div>
        </div>
    );
}
