'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { generarUuid } from "@/lib/jugador";
import { borrarFoto, guardarFoto, listarFotos, obtenerFoto, type Foto } from "@/lib/fotos";
import { comprimirImagen, TAMANO_MAXIMO } from "@/lib/imagenes";
import { subirFoto } from "@/lib/subidas";
import { borrarFotoSubida } from "@/lib/acciones";

const AVISO_FALLA = "Algunas fotos no se pudieron subir. Quedaron guardadas para reintentar.";

// Tiempo para deshacer antes de borrar de verdad (RF-29)
export const SEGUNDOS_DESHACER = 5;

type UsoFotos = {
    fotos: Foto[];
    subiendo: boolean;
    aviso: string;
    agregarFotos: (categoria: string, archivos: File[]) => Promise<void>;
    reintentar: () => void;
    urlDeFoto: (foto: Foto) => string;
    porBorrar: Foto | null;
    eliminarFoto: (foto: Foto) => void;
    deshacerBorrado: () => void;
};

// Fotos del jugador: se guardan primero en IndexedDB, se muestran al instante
// y después se suben a UploadThing. Si falla, quedan pendientes (RF-06 a RF-13, NF-10)
export function useFotos(uuid: string): UsoFotos {
    const [fotos, setFotos] = useState<Foto[]>([]);
    const [subiendo, setSubiendo] = useState(false);
    const [aviso, setAviso] = useState("");
    const enCurso = useRef(false);
    const urlsLocales = useRef(new Map<string, string>());
    const [porBorrar, setPorBorrar] = useState<Foto | null>(null);
    const borradoEnEspera = useRef<{ foto: Foto; temporizador: number } | null>(null);
    // Fotos ya borradas: si alguna terminaba de subirse justo después, se borra también de la nube
    const eliminadas = useRef(new Set<string>());

    function reemplazarFoto(actualizada: Foto) {
        setFotos((anteriores) =>
            anteriores.map((foto) => (foto.id === actualizada.id ? actualizada : foto)),
        );
    }

    // Sube de a una. Relee IndexedDB en cada vuelta para tomar las fotos que se
    // agregaron mientras subía; las que fallan se dejan para el próximo intento
    const subirPendientes = useCallback(async () => {
        if (enCurso.current) return;
        enCurso.current = true;
        setSubiendo(true);
        setAviso((anterior) => (anterior === AVISO_FALLA ? "" : anterior));
        const fallidas = new Set<string>();
        try {
            while (true) {
                const pendiente = (await listarFotos(uuid)).find(
                    (foto): foto is Foto & { blob: Blob } =>
                        foto.estado === "pendiente" && foto.blob !== null && !fallidas.has(foto.id),
                );
                if (!pendiente) break;
                try {
                    const url = await subirFoto(pendiente);
                    if (eliminadas.current.has(pendiente.id)) {
                        borrarFotoSubida(uuid, url).catch(() => { });
                        continue;
                    }
                    const subida: Foto = {
                        ...pendiente,
                        estado: "subida",
                        url,
                        subidaEn: new Date().toISOString(),
                    };
                    await guardarFoto(subida);
                    reemplazarFoto(subida);
                } catch {
                    fallidas.add(pendiente.id);
                }
            }
            if (fallidas.size > 0) {
                setAviso(AVISO_FALLA);
            }
        } catch {
            setAviso("No se pudieron leer las fotos guardadas en este dispositivo.");
        } finally {
            enCurso.current = false;
            setSubiendo(false);
        }
    }, [uuid]);

    // Borra de verdad: del celular y, si ya estaba subida, de UploadThing (RF-14)
    const confirmarBorrado = useCallback(async (foto: Foto) => {
        eliminadas.current.add(foto.id);
        setFotos((anteriores) => anteriores.filter((otra) => otra.id !== foto.id));
        const urlLocal = urlsLocales.current.get(foto.id);
        if (urlLocal) {
            URL.revokeObjectURL(urlLocal);
            urlsLocales.current.delete(foto.id);
        }
        try {
            // Se relee porque pudo haberse subido durante la espera
            const url = (await obtenerFoto(foto.id))?.url ?? foto.url;
            await borrarFoto(foto.id);
            if (url && !(await borrarFotoSubida(uuid, url))) throw new Error("No se borró de UploadThing");
        } catch {
            setAviso("La foto se borró de tu tablero, pero no se pudo borrar de la nube.");
        }
    }, [uuid]);

    // La foto desaparece al instante y queda unos segundos para deshacer (RF-29)
    function eliminarFoto(foto: Foto) {
        const anterior = borradoEnEspera.current;
        if (anterior) {
            window.clearTimeout(anterior.temporizador);
            confirmarBorrado(anterior.foto);
        }
        const temporizador = window.setTimeout(() => {
            borradoEnEspera.current = null;
            setPorBorrar(null);
            confirmarBorrado(foto);
        }, SEGUNDOS_DESHACER * 1000);
        borradoEnEspera.current = { foto, temporizador };
        setPorBorrar(foto);
    }

    function deshacerBorrado() {
        const enEspera = borradoEnEspera.current;
        if (!enEspera) return;
        window.clearTimeout(enEspera.temporizador);
        borradoEnEspera.current = null;
        setPorBorrar(null);
    }

    // Si se sale del tablero durante la espera, el borrado se confirma
    useEffect(() => {
        return () => {
            const enEspera = borradoEnEspera.current;
            if (!enEspera) return;
            window.clearTimeout(enEspera.temporizador);
            borradoEnEspera.current = null;
            confirmarBorrado(enEspera.foto);
        };
    }, [confirmarBorrado]);

    // Carga las fotos guardadas e intenta subir las que quedaron pendientes
    useEffect(() => {
        let vigente = true;
        listarFotos(uuid)
            .then((guardadas) => {
                if (!vigente) return;
                setFotos(guardadas);
                if (guardadas.some((foto) => foto.estado === "pendiente")) subirPendientes();
            })
            .catch(() => vigente && setAviso("No se pudieron leer las fotos guardadas en este dispositivo."));
        return () => {
            vigente = false;
        };
    }, [uuid, subirPendientes]);

    // Reintento automático al recuperar la conexión (RF-12)
    useEffect(() => {
        window.addEventListener("online", subirPendientes);
        return () => window.removeEventListener("online", subirPendientes);
    }, [subirPendientes]);

    // Libera las vistas previas al salir del tablero
    useEffect(() => {
        const urls = urlsLocales.current;
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
        };
    }, []);

    // Vista previa desde el blob local si existe; si no, la URL de UploadThing
    const urlDeFoto = useCallback((foto: Foto) => {
        if (!foto.blob) return foto.url ?? "";
        let url = urlsLocales.current.get(foto.id);
        if (!url) {
            url = URL.createObjectURL(foto.blob);
            urlsLocales.current.set(foto.id, url);
        }
        return url;
    }, []);

    async function agregarFotos(categoria: string, archivos: File[]) {
        setAviso("");
        // Pide que el navegador no borre las fotos guardadas (NF-05)
        navigator.storage?.persist?.().catch(() => { });

        let descartadas = 0;
        for (const archivo of archivos) {
            const capturadaEn = new Date().toISOString();
            const blob = await comprimirImagen(archivo);
            if (blob.size > TAMANO_MAXIMO) {
                descartadas++;
                continue;
            }
            const foto: Foto = {
                id: generarUuid(),
                uuid,
                categoria,
                blob,
                estado: "pendiente",
                url: null,
                capturadaEn,
                subidaEn: null,
            };
            try {
                await guardarFoto(foto);
            } catch {
                setAviso("No se pudo guardar la foto en este dispositivo.");
                return;
            }
            setFotos((anteriores) => [...anteriores, foto]);
        }

        if (descartadas > 0) {
            setAviso(descartadas === 1
                ? "Una foto pesa más de 8 MB y no se agregó."
                : `${descartadas} fotos pesan más de 8 MB y no se agregaron.`);
        }
        subirPendientes();
    }

    return {
        fotos: porBorrar ? fotos.filter((foto) => foto.id !== porBorrar.id) : fotos,
        subiendo,
        aviso,
        agregarFotos,
        reintentar: subirPendientes,
        urlDeFoto,
        porBorrar,
        eliminarFoto,
        deshacerBorrado,
    };
}
