'use client'

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { leerTablero, type TableroRemoto } from "@/lib/tableroRemoto";

type EstadoTablero =
  | { tipo: "cargando" }
  // Este navegador ya no tiene acceso al jugador
  | { tipo: "sinAcceso" }
  | { tipo: "listo"; tablero: TableroRemoto };

const VACIO: TableroRemoto = { cambios: [], elegidas: {}, entregadoEn: null, entregasCerradas: false };

// Cambios, elección y entrega del jugador, leídos de la base y actualizados en vivo
// (también si se tocan desde otro celular del mismo jugador), más el cierre de
// entregas del grupo. Sin conexión se usa
// lo último que se leyó. Next deja las páginas visitadas ocultas (<Activity>):
// al volver a mostrarse, los efectos corren de nuevo y se vuelve a leer
export function useTableroRemoto(jugadorId: string, grupoId: string) {
  const [estado, setEstado] = useState<EstadoTablero>({ tipo: "cargando" });

  const recargar = useCallback(async () => {
    try {
      const tablero = await leerTablero(jugadorId, grupoId);
      setEstado(tablero ? { tipo: "listo", tablero } : { tipo: "sinAcceso" });
    } catch {
      // Sin conexión: se queda con lo que había (o vacío la primera vez)
      setEstado((anterior) => (anterior.tipo === "cargando" ? { tipo: "listo", tablero: VACIO } : anterior));
    }
  }, [jugadorId, grupoId]);

  useEffect(() => {
    let vigente = true;
    leerTablero(jugadorId, grupoId)
      .then((tablero) => vigente && setEstado(tablero ? { tipo: "listo", tablero } : { tipo: "sinAcceso" }))
      .catch(() => vigente && setEstado((anterior) => (anterior.tipo === "cargando" ? { tipo: "listo", tablero: VACIO } : anterior)));

    const filtro = `jugador_id=eq.${jugadorId}`;
    const canal = supabase()
      .channel(`tablero-${jugadorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cambios", filter: filtro }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "elecciones", filter: filtro }, recargar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jugadores", filter: `id=eq.${jugadorId}` }, recargar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "grupos", filter: `id=eq.${grupoId}` }, recargar)
      .subscribe();
    window.addEventListener("online", recargar);
    return () => {
      vigente = false;
      supabase().removeChannel(canal);
      window.removeEventListener("online", recargar);
    };
  }, [jugadorId, grupoId, recargar]);

  return { estado, recargar };
}
