'use client'

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Camera, Check, CloudUpload, Dices, Star } from "lucide-react";
import styles from "./Tablero.module.css";
import type { Foto } from "@/lib/fotos";

type TableroProps = {
    categorias: readonly string[];
    fotos: Foto[];
    urlDeFoto: (foto: Foto) => string;
    onAgregarFotos: (categoria: string, archivos: File[]) => void;
    onPedirBorrado: (foto: Foto) => void;
    // Con el tablero cerrado cada celda muestra su foto elegida y no se puede tocar
    elegidas?: Record<string, string>;
    // En modo cambio, tocar una celda la elige para cambiar su categoría
    onElegirCambio?: (posicion: number) => void;
};

const MILISEGUNDOS_MANTENER = 550;
const TOLERANCIA_MOVIMIENTO = 10;

export default function Tablero({
    categorias,
    fotos,
    urlDeFoto,
    onAgregarFotos,
    onPedirBorrado,
    elegidas,
    onElegirCambio,
}: TableroProps) {
    const presion = useRef<{ temporizador: number; x: number; y: number } | null>(null);
    // Evita que el toque largo abra además el selector de fotos
    const seMantuvo = useRef(false);
    const ultimoPuntero = useRef("");
    // Celda que se está manteniendo apretada, para mostrar cuánto falta
    const [manteniendo, setManteniendo] = useState<string | null>(null);

    function cancelarPresion() {
        if (presion.current) window.clearTimeout(presion.current.temporizador);
        presion.current = null;
        setManteniendo(null);
    }

    function pedirBorrado(foto: Foto) {
        seMantuvo.current = true;
        setManteniendo(null);
        navigator.vibrate?.(30);
        onPedirBorrado(foto);
    }

    return (
        <ul
            className={styles.tablero}
            aria-label="Tablero de bingo"
            style={{ "--mantener": `${MILISEGUNDOS_MANTENER}ms` } as CSSProperties}
        >
            {categorias.map((categoria, posicion) => {
                const fotosCelda = fotos.filter((foto) => foto.categoria === categoria);
                const ultima = fotosCelda.at(-1);
                const pendientes = fotosCelda.filter((foto) => foto.estado === "pendiente").length;

                if (onElegirCambio) {
                    return (
                        <li key={categoria} className={styles.celda}>
                            <button
                                type="button"
                                className={`${styles.boton} ${styles.cambiable}`}
                                data-con-foto={ultima ? true : undefined}
                                aria-label={`Cambiar la categoría ${categoria}`}
                                onClick={() => onElegirCambio(posicion)}
                            >
                                {ultima && (
                                    // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local
                                    <img src={urlDeFoto(ultima)} alt="" className={styles.miniatura} draggable={false} />
                                )}
                                <span className={styles.categoria}>{categoria}</span>
                                <span className={`${styles.estado} ${styles.estadoCambio}`} aria-hidden="true"><Dices /></span>
                            </button>
                        </li>
                    );
                }

                if (elegidas) {
                    const elegida = fotosCelda.find((foto) => foto.id === elegidas[categoria]);
                    return (
                        <li key={categoria} className={styles.celda}>
                            <div className={styles.boton} data-con-foto={elegida ? true : undefined} aria-label={`${categoria}: foto elegida`}>
                                {elegida && (
                                    // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local
                                    <img src={urlDeFoto(elegida)} alt="" className={styles.miniatura} draggable={false} />
                                )}
                                <span className={styles.categoria}>{categoria}</span>
                                <span className={`${styles.estado} ${styles.estadoElegida}`} aria-hidden="true"><Star /></span>
                            </div>
                        </li>
                    );
                }

                return (
                    <li key={categoria} className={styles.celda}>
                        {/* Tocar abre el selector nativo: cámara o galería (RF-06).
                            Mantener apretado pide borrar la última foto (RF-14) */}
                        <label
                            className={styles.boton}
                            data-con-foto={ultima ? true : undefined}
                            data-manteniendo={manteniendo === categoria || undefined}
                            onPointerDown={(evento: PointerEvent) => {
                                seMantuvo.current = false;
                                ultimoPuntero.current = evento.pointerType;
                                if (!ultima || evento.pointerType === "mouse") return;
                                cancelarPresion();
                                setManteniendo(categoria);
                                presion.current = {
                                    x: evento.clientX,
                                    y: evento.clientY,
                                    temporizador: window.setTimeout(() => pedirBorrado(ultima), MILISEGUNDOS_MANTENER),
                                };
                            }}
                            onPointerMove={(evento) => {
                                const inicio = presion.current;
                                if (inicio && Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y) > TOLERANCIA_MOVIMIENTO) {
                                    cancelarPresion();
                                }
                            }}
                            onPointerUp={cancelarPresion}
                            onPointerCancel={cancelarPresion}
                            onPointerLeave={cancelarPresion}
                            onClick={(evento) => {
                                if (seMantuvo.current) evento.preventDefault();
                            }}
                            onContextMenu={(evento) => {
                                // Sin el menú del sistema; con mouse, el clic derecho equivale a mantener
                                evento.preventDefault();
                                if (ultima && ultimoPuntero.current === "mouse") pedirBorrado(ultima);
                            }}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className={styles.input}
                                aria-label={ultima
                                    ? `Agregar foto de ${categoria}. Suprimir borra la última`
                                    : `Agregar foto de ${categoria}`}
                                onChange={(evento) => {
                                    const archivos = Array.from(evento.target.files ?? []);
                                    // Se limpia para poder elegir de nuevo la misma foto
                                    evento.target.value = "";
                                    if (archivos.length > 0) onAgregarFotos(categoria, archivos);
                                }}
                                onKeyDown={(evento) => {
                                    if (ultima && (evento.key === "Delete" || evento.key === "Backspace")) {
                                        evento.preventDefault();
                                        onPedirBorrado(ultima);
                                    }
                                }}
                            />
                            {ultima && (
                                // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local
                                <img src={urlDeFoto(ultima)} alt="" className={styles.miniatura} draggable={false} />
                            )}
                            {!ultima && <Camera className={styles.camara} aria-hidden="true" />}
                            <span className={styles.categoria}>{categoria}</span>
                            {fotosCelda.length > 0 && (
                                <span
                                    className={`${styles.estado} ${pendientes > 0 ? styles.estadoPendiente : styles.estadoSubida}`}
                                    aria-label={pendientes > 0
                                        ? `${fotosCelda.length} fotos, ${pendientes} sin subir`
                                        : `${fotosCelda.length} fotos subidas`}
                                >
                                    {pendientes > 0 ? <CloudUpload /> : <Check />}
                                    {fotosCelda.length > 1 && <span>{fotosCelda.length}</span>}
                                </span>
                            )}
                        </label>
                    </li>
                );
            })}
        </ul>
    );
}
