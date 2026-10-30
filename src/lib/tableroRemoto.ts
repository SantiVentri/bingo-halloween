import { asegurarSesion, supabase } from "@/lib/supabase/cliente";
import type { Cambio, Categoria } from "@/lib/tablero";

// Estado del tablero en Supabase: cambios de categoría, foto elegida por celda
// y si ya se entregó para la revisión
export type TableroRemoto = {
  cambios: Cambio[];
  // categoría → id de la foto elegida
  elegidas: Record<string, string>;
  entregadoEn: string | null;
};

// null si este navegador ya no tiene acceso al jugador (por ejemplo, se borró la sesión)
export async function leerTablero(jugadorId: string): Promise<TableroRemoto | null> {
  await asegurarSesion();
  const [jugador, cambios, elecciones] = await Promise.all([
    supabase().from("jugadores").select("entregado_en").eq("id", jugadorId).maybeSingle(),
    supabase().from("cambios").select("numero, posicion, categoria").eq("jugador_id", jugadorId).order("numero"),
    supabase().from("elecciones").select("categoria, foto_id").eq("jugador_id", jugadorId),
  ]);
  const error = jugador.error ?? cambios.error ?? elecciones.error;
  if (error) throw error;
  if (!jugador.data) return null;
  return {
    entregadoEn: jugador.data.entregado_en,
    cambios: (cambios.data ?? []).map((cambio) => ({ posicion: cambio.posicion, categoria: cambio.categoria as Categoria })),
    elegidas: Object.fromEntries((elecciones.data ?? []).map((eleccion) => [eleccion.categoria, eleccion.foto_id])),
  };
}

// Guarda la foto elegida de una o varias celdas (RF-16, RF-17)
export async function guardarElegidas(jugadorId: string, elegidas: Record<string, string>): Promise<void> {
  const filas = Object.entries(elegidas).map(([categoria, fotoId]) => ({
    jugador_id: jugadorId,
    categoria,
    foto_id: fotoId,
  }));
  if (filas.length === 0) return;
  const { error } = await supabase().from("elecciones").upsert(filas, { onConflict: "jugador_id,categoria" });
  if (error) throw error;
}

// Cierra el tablero y lo entrega para la revisión; la base exige todas las elecciones
export async function entregarTablero(jugadorId: string): Promise<void> {
  const { error } = await supabase().rpc("entregar", { p_jugador: jugadorId });
  if (error) throw error;
}

export async function reabrirTablero(jugadorId: string): Promise<void> {
  const { error } = await supabase().rpc("reabrir", { p_jugador: jugadorId });
  if (error) throw error;
}

// El servidor sortea la categoría nueva (no se puede elegir a mano) y borra las
// fotos de la celda. Devuelve la categoría que salió
export async function cambiarCategoria(jugadorId: string, posicion: number): Promise<string> {
  await asegurarSesion();
  const { data } = await supabase().auth.getSession();
  const respuesta = await fetch("/api/cambios", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify({ jugadorId, posicion }),
  });
  if (!respuesta.ok) throw new Error("No se pudo cambiar la categoría");
  const { categoria } = await respuesta.json();
  return categoria;
}
