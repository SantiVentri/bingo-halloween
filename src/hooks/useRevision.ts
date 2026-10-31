'use client'

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { conteoConMiVoto, leerRevision, SIN_VOTOS, votar, type Revision } from "@/lib/revision";

export type EstadoRevision =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; revision: Revision };

// Revisión del grupo leída de la base y actualizada en vivo: conteos de votos,
// tableros que se entregan o reabren y el cierre de entregas. Las reglas de la base
// solo mandan los cambios del grupo; además se filtra por el grupo del jugador
export function useRevision(jugadorId: string, grupoId: string) {
  const [estado, setEstado] = useState<EstadoRevision>({ tipo: "cargando" });

  // Si falla una actualización, se siguen mostrando los datos que ya había
  const recargar = useCallback(async () => {
    try {
      const revision = await leerRevision(jugadorId, grupoId);
      setEstado({ tipo: "listo", revision });
    } catch {
      setEstado((anterior) => (anterior.tipo === "listo" ? anterior : { tipo: "error" }));
    }
  }, [jugadorId, grupoId]);

  useEffect(() => {
    let vigente = true;
    let temporizador: number | undefined;
    leerRevision(jugadorId, grupoId)
      .then((revision) => vigente && setEstado({ tipo: "listo", revision }))
      .catch(() => vigente && setEstado({ tipo: "error" }));
    const enUnRato = () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(recargar, 300);
    };
    const canal = supabase()
      .channel(`revision-${grupoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conteos", filter: `grupo_id=eq.${grupoId}` }, enUnRato)
      .on("postgres_changes", { event: "*", schema: "public", table: "jugadores", filter: `grupo_id=eq.${grupoId}` }, enUnRato)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "grupos", filter: `id=eq.${grupoId}` }, enUnRato)
      .subscribe();
    window.addEventListener("focus", enUnRato);
    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
      supabase().removeChannel(canal);
      window.removeEventListener("focus", enUnRato);
    };
  }, [jugadorId, grupoId, recargar]);

  // El voto y el conteo cambian al instante; si la base no lo guarda, se vuelve al
  // voto anterior. Devuelve false si falló
  const cambiarVoto = useCallback(async (fotoId: string, vale: boolean | null): Promise<boolean> => {
    if (estado.tipo !== "listo") return false;
    const anterior = estado.revision.misVotos[fotoId] ?? null;
    setEstado((actual) => aplicarVoto(actual, fotoId, vale));
    try {
      await votar(jugadorId, fotoId, vale);
      return true;
    } catch {
      setEstado((actual) => aplicarVoto(actual, fotoId, anterior));
      return false;
    }
  }, [estado, jugadorId]);

  return { estado, recargar, cambiarVoto };
}

function aplicarVoto(estado: EstadoRevision, fotoId: string, vale: boolean | null): EstadoRevision {
  if (estado.tipo !== "listo") return estado;
  const { conteos, misVotos } = estado.revision;
  const nuevosVotos = { ...misVotos };
  if (vale === null) delete nuevosVotos[fotoId];
  else nuevosVotos[fotoId] = vale;
  return {
    tipo: "listo",
    revision: {
      ...estado.revision,
      misVotos: nuevosVotos,
      conteos: { ...conteos, [fotoId]: conteoConMiVoto(conteos[fotoId] ?? SIN_VOTOS, misVotos[fotoId], vale) },
    },
  };
}
