import { asegurarSesion, supabase } from "@/lib/supabase/cliente";

// Estado del grupo para el menú: los que todavía no entregaron no aparecen en la
// revisión, pero cuentan como miembros
export type ResumenGrupo = {
  codigo: string;
  esCreador: boolean;
  entregasCerradas: boolean;
  miembros: number;
  entregados: number;
};

export const ENTREGAS_MINIMAS_PARA_CERRAR = 2;

export async function leerResumenGrupo(jugadorId: string): Promise<ResumenGrupo> {
  await asegurarSesion();
  const { data, error } = await supabase().rpc("resumen_grupo", { p_jugador: jugadorId });
  const fila = data?.[0];
  if (error || !fila) throw error ?? new Error("No se pudo leer el grupo");
  return {
    codigo: fila.codigo,
    esCreador: fila.es_creador,
    entregasCerradas: fila.entregas_cerradas_en !== null,
    miembros: fila.miembros,
    entregados: fila.entregados,
  };
}

// Solo el creador. Después nadie más entra, entrega ni reabre: queda votar.
// La base exige al menos 2 entregas (BH002): con una sola no hay quién vote
export async function cerrarEntregas(jugadorId: string): Promise<void> {
  const { error } = await supabase().rpc("cerrar_entregas", { p_jugador: jugadorId });
  if (error) throw error;
}
