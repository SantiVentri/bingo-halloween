'use client'

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { leerTablero, type TableroRemoto } from "@/lib/tableroRemoto";

type EstadoTablero =
  | { tipo: "cargando" }
  // Este navegador ya no tiene acceso al jugador
  | { tipo: "sinAcceso" }
  | { tipo: "listo"; tablero: TableroRemoto };

const VACIO: TableroRemoto = { cambios: [], elegidas: {}, entregadoEn: null };

// Cambios, elección y entrega del jugador, leídos de la base y actualizados en vivo
// (también si se tocan desde otro celular del mismo jugador). Sin conexión se usa
// lo último que se leyó. Next deja las páginas visitadas ocultas (<Activity>):
// al volver a mostrarse, los efectos corren de nuevo y se vuelve a leer
export function useTableroRemoto(jugadorId: string) {
  const [estado, setEstado] = useState<EstadoTablero>({ tipo: "cargando" });

  const recargar = useCallback(async () => {
    try {
      const tablero = await leerTablero(jugadorId);
      setEstado(tablero ? { tipo: "listo", tablero } : { tipo: "sinAcceso" });
    } catch {
      // Sin conexión: se queda con lo que había (o vacío la primera vez)
      setEstado((anterior) => (anterior.tipo === "cargando" ? { tipo: "listo", tablero: VACIO } : anterior));
    }
  }, [jugadorId]);

  useEffect(() => {
    let vigente = true;
    leerTablero(jugadorId)
      .then((tablero) => vigente && setEstado(tablero ? { tipo: "listo", tablero } : { tipo: "sinAcceso" }))
      .catch(() => vigente && setEstado((anterior) => (anterior.tipo === "cargando" ? { tipo: "listo", tablero: VACIO } : anterior)));

    const filtro = `jugador_id=eq.${jugadorId}`;
    const canal = supabase()
      .channel(`tablero-${jugadorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cambios", filter: filtro }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "elecciones", filter: filtro }, recargar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jugadores", filter: `id=eq.${jugadorId}` }, recargar)
      .subscribe();
    window.addEventListener("online", recargar);
    return () => {
      vigente = false;
      supabase().removeChannel(canal);
      window.removeEventListener("online", recargar);
    };
  }, [jugadorId, recargar]);

  return { estado, recargar };
}
