'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { generarUuid } from "@/lib/jugador";
import { borrarFoto, guardarFoto, listarFotos, obtenerFoto, sincronizarFotos, type Foto } from "@/lib/fotos";
import { comprimirImagen, TAMANO_MAXIMO } from "@/lib/imagenes";
import { borrarFotosRemotas, listarFotosRemotas, subirFoto } from "@/lib/fotosRemotas";
import { asegurarSesion, supabase } from "@/lib/supabase/cliente";
import { useAvisos } from "@/components/Avisos";

const CLAVE_CONSEJO = "bingo-halloween:consejo-borrar";

type UsoFotos = {
    fotos: Foto[];
    // true hasta leer las fotos (de la base o, sin conexión, del celular)
    cargando: boolean;
    subiendo: boolean;
    agregarFotos: (categoria: string, archivos: File[]) => Promise<void>;
    reintentar: () => void;
    urlDeFoto: (foto: Foto) => string;
    eliminarFoto: (foto: Foto) => Promise<boolean>;
    eliminarTodas: () => Promise<boolean>;
};

// Fotos del jugador: se guardan primero en IndexedDB, se muestran al instante y
// después se suben a Supabase. Si falla, quedan pendientes (RF-06 a RF-13, NF-10).
// Se sincronizan en vivo con los otros celulares del mismo jugador.
// Los mensajes salen como avisos flotantes
export function useFotos(uuid: string): UsoFotos {
    const [fotos, setFotos] = useState<Foto[]>([]);
    const [cargando, setCargando] = useState(true);
    const [subiendo, setSubiendo] = useState(false);
    const avisar = useAvisos();
    const enCurso = useRef(false);
    const urlsLocales = useRef(new Map<string, string>());
    // Fotos ya borradas: si alguna terminaba de subirse justo después, se borra también de la nube
    const eliminadas = useRef(new Set<string>());

    function reemplazarFoto(actualizada: Foto) {
        setFotos((anteriores) =>
            anteriores.map((foto) => (foto.id === actualizada.id ? actualizada : foto)),
        );
    }

    // Sube de a una. Relee IndexedDB en cada vuelta para tomar las fotos que se
    // agregaron mientras subía; las que fallan se dejan para el próximo intento.
    // Solo avisa del error si se reintentó a mano: si no, ya lo muestra el tablero
    const subirPendientes = useCallback(async (manual = false) => {
        if (enCurso.current) return;
        enCurso.current = true;
        setSubiendo(true);
        const fallidas = new Set<string>();
        try {
            while (true) {
                const pendiente = (await listarFotos(uuid)).find(
                    (foto): foto is Foto & { blob: Blob } =>
                        foto.estado === "pendiente" && foto.blob !== null && !fallidas.has(foto.id),
                );
                if (!pendiente) break;
                try {
                    const { url, subidaEn } = await subirFoto(pendiente);
                    if (eliminadas.current.has(pendiente.id)) {
                        borrarFotosRemotas(uuid, [pendiente.id]).catch(() => { });
                        continue;
                    }
                    const subida: Foto = { ...pendiente, estado: "subida", url, subidaEn };
                    await guardarFoto(subida);
                    reemplazarFoto(subida);
                } catch {
                    fallidas.add(pendiente.id);
                }
            }
            if (fallidas.size > 0 && manual) {
                avisar({
                    tipo: "error",
                    texto: fallidas.size === 1
                        ? "No se pudo subir 1 foto. Quedó guardada en el celular."
                        : `No se pudieron subir ${fallidas.size} fotos. Quedaron guardadas en el celular.`,
                });
            }
        } catch {
            avisar({ tipo: "error", texto: "No se pudieron leer las fotos guardadas en este celular." });
        } finally {
            enCurso.current = false;
            setSubiendo(false);
        }
    }, [uuid, avisar]);

    // Borra primero de Supabase y después del celular (RF-14). Si la base falla,
    // la foto se queda para que se pueda volver a intentar y no quede huérfana
    async function eliminarFoto(foto: Foto): Promise<boolean> {
        try {
            // Se relee porque pudo haberse subido después de dibujar la celda
            const estado = (await obtenerFoto(foto.id))?.estado ?? foto.estado;
            if (estado === "subida") await borrarFotosRemotas(uuid, [foto.id]);
            // Si se estaba subiendo justo ahora, la cola la borra de la nube al terminar
            eliminadas.current.add(foto.id);
            await borrarFoto(foto.id);
        } catch {
            avisar({ tipo: "error", texto: "No se pudo borrar la foto. Revisá la conexión y probá de nuevo." });
            return false;
        }
        setFotos((anteriores) => anteriores.filter((otra) => otra.id !== foto.id));
        const urlLocal = urlsLocales.current.get(foto.id);
        if (urlLocal) {
            URL.revokeObjectURL(urlLocal);
            urlsLocales.current.delete(foto.id);
        }
        return true;
    }

    // Borra todas las fotos del jugador: primero de Supabase (también las subidas
    // desde otro celular) y después del celular. Si la base falla, no se borra nada
    async function eliminarTodas(): Promise<boolean> {
        try {
            const remotas = await listarFotosRemotas(uuid);
            await borrarFotosRemotas(uuid, remotas.map((foto) => foto.id));
            const guardadas = await listarFotos(uuid);
            for (const foto of guardadas) {
                eliminadas.current.add(foto.id);
                await borrarFoto(foto.id);
            }
        } catch {
            avisar({ tipo: "error", texto: "No se pudieron borrar las fotos. Revisá la conexión y probá de nuevo." });
            return false;
        }
        setFotos([]);
        urlsLocales.current.forEach((url) => URL.revokeObjectURL(url));
        urlsLocales.current.clear();
        return true;
    }

    // Junta las fotos de la base con las del celular. Sin conexión quedan las locales
    const sincronizar = useCallback(async () => {
        const locales = await listarFotos(uuid);
        try {
            await asegurarSesion();
            return await sincronizarFotos(uuid, await listarFotosRemotas(uuid));
        } catch {
            return locales;
        }
    }, [uuid]);

    // Carga las fotos e intenta subir las que quedaron pendientes
    useEffect(() => {
        let vigente = true;
        sincronizar()
            .then((juntas) => {
                if (!vigente) return;
                setFotos(juntas);
                setCargando(false);
                if (juntas.some((foto) => foto.estado === "pendiente")) subirPendientes();
            })
            .catch(() => {
                if (!vigente) return;
                setCargando(false);
                avisar({ tipo: "error", texto: "No se pudieron leer las fotos guardadas en este celular.", duracion: null });
            });
        return () => {
            vigente = false;
        };
    }, [sincronizar, subirPendientes, avisar]);

    // Cambios hechos desde otro celular del mismo jugador: se vuelve a sincronizar
    useEffect(() => {
        let temporizador: number | undefined;
        const canal = supabase()
            .channel(`fotos-${uuid}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "fotos", filter: `jugador_id=eq.${uuid}` }, () => {
                window.clearTimeout(temporizador);
                temporizador = window.setTimeout(() => {
                    sincronizar().then((juntas) => {
                        // Las que se borraron acá mientras tanto no vuelven
                        setFotos(juntas.filter((foto) => !eliminadas.current.has(foto.id)));
                    }).catch(() => { });
                }, 400);
            })
            .subscribe();
        return () => {
            window.clearTimeout(temporizador);
            supabase().removeChannel(canal);
        };
    }, [uuid, sincronizar]);

    // Reintento automático al recuperar la conexión (RF-12) y aviso al perderla
    useEffect(() => {
        const alVolver = () => subirPendientes();
        const alCortarse = () => avisar({ texto: "Sin conexión: tus fotos se guardan en el celular y se suben cuando vuelva." });
        window.addEventListener("online", alVolver);
        window.addEventListener("offline", alCortarse);
        return () => {
            window.removeEventListener("online", alVolver);
            window.removeEventListener("offline", alCortarse);
        };
    }, [subirPendientes, avisar]);

    // Libera las vistas previas al salir del tablero
    useEffect(() => {
        const urls = urlsLocales.current;
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
        };
    }, []);

    // Vista previa desde el blob local si existe; si no, la URL firmada de Storage
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
        // Con la primera foto se explica, una sola vez, cómo borrar
        try {
            if (!localStorage.getItem(CLAVE_CONSEJO)) {
                localStorage.setItem(CLAVE_CONSEJO, "1");
                avisar({ texto: "Para borrar una foto, mantené apretada su celda." });
            }
        } catch {
            // Sin localStorage no se muestra el consejo
        }
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
                avisar({ tipo: "error", texto: "No se pudo guardar la foto en este celular." });
                return;
            }
            setFotos((anteriores) => [...anteriores, foto]);
        }

        if (descartadas > 0) {
            avisar({
                tipo: "error",
                texto: descartadas === 1
                    ? "Una foto pesa más de 8 MB y no se agregó."
                    : `${descartadas} fotos pesan más de 8 MB y no se agregaron.`,
            });
        }
        subirPendientes();
    }

    return {
        fotos,
        cargando,
        subiendo,
        agregarFotos,
        reintentar: () => subirPendientes(true),
        urlDeFoto,
        eliminarFoto,
        eliminarTodas,
    };
}
