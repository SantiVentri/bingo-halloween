'use client'

import styles from "./Tablero.module.css";
import { generarTablero } from "@/lib/tablero";
import type { Foto } from "@/lib/fotos";

type TableroProps = {
    uuid: string;
    fotos: Foto[];
    urlDeFoto: (foto: Foto) => string;
    onAgregarFotos: (categoria: string, archivos: File[]) => void;
};

export default function Tablero({ uuid, fotos, urlDeFoto, onAgregarFotos }: TableroProps) {
    const categorias = generarTablero(uuid);

    return (
        <ul className={styles.tablero} aria-label="Tablero de bingo">
            {categorias.map((categoria) => {
                const fotosCelda = fotos.filter((foto) => foto.categoria === categoria);
                const ultima = fotosCelda.at(-1);
                const pendientes = fotosCelda.filter((foto) => foto.estado === "pendiente").length;

                return (
                    <li key={categoria} className={styles.celda}>
                        {/* Tocar la celda abre el selector nativo: cámara o galería (RF-06) */}
                        <label className={styles.boton}>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className={styles.input}
                                aria-label={`Agregar foto de ${categoria}`}
                                onChange={(evento) => {
                                    const archivos = Array.from(evento.target.files ?? []);
                                    // Se limpia para poder elegir de nuevo la misma foto
                                    evento.target.value = "";
                                    if (archivos.length > 0) onAgregarFotos(categoria, archivos);
                                }}
                            />
                            {ultima && (
                                // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local
                                <img src={urlDeFoto(ultima)} alt="" className={styles.miniatura} />
                            )}
                            <span className={styles.categoria}>{categoria}</span>
                            {fotosCelda.length > 0 && (
                                <span
                                    className={pendientes > 0 ? styles.estadoPendiente : styles.estadoSubida}
                                    aria-label={pendientes > 0
                                        ? `${fotosCelda.length} fotos, ${pendientes} sin subir`
                                        : `${fotosCelda.length} fotos subidas`}
                                >
                                    {pendientes > 0 ? "⏳" : "✓"} {fotosCelda.length}
                                </span>
                            )}
                        </label>
                    </li>
                );
            })}
        </ul>
    );
}
