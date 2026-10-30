import { asegurarSesion, supabase, urlPublica } from "@/lib/supabase/cliente";

// Revisión del grupo: los tableros entregados con sus 9 fotos elegidas y una
// decisión compartida por foto (vale / no vale), guardada en la base
export type FotoEnRevision = {
  id: string;
  categoria: string;
  url: string;
  capturadaEn: string;
  // Hora de subida según el servidor: la que se usa para desempatar
  subidaEn: string;
};

export type EntregaEnRevision = {
  uuid: string;
  nombre: string;
  confirmadaEn: string;
  fotos: FotoEnRevision[];
};

// id de foto → vale (true) o no vale (false); sin votar no aparece
export type Votos = Record<string, boolean>;

export function horaUltimaFoto(entrega: EntregaEnRevision): number {
  return Math.max(...entrega.fotos.map((foto) => Date.parse(foto.subidaEn)));
}

export async function leerRevision(): Promise<{ entregas: EntregaEnRevision[]; votos: Votos }> {
  await asegurarSesion();
  const [filas, votos] = await Promise.all([
    supabase().from("revision").select("*").order("entregado_en"),
    supabase().from("votos").select("foto_id, vale"),
  ]);
  const error = filas.error ?? votos.error;
  if (error) throw error;

  const porJugador = new Map<string, EntregaEnRevision>();
  for (const fila of filas.data ?? []) {
    const entrega = porJugador.get(fila.jugador_id) ?? {
      uuid: fila.jugador_id,
      nombre: fila.nombre,
      confirmadaEn: fila.entregado_en,
      fotos: [],
    };
    entrega.fotos.push({
      id: fila.foto_id,
      categoria: fila.categoria,
      url: urlPublica(fila.ruta),
      capturadaEn: fila.capturada_en,
      subidaEn: fila.subida_en,
    });
    porJugador.set(fila.jugador_id, entrega);
  }

  return {
    entregas: [...porJugador.values()],
    votos: Object.fromEntries((votos.data ?? []).map((voto) => [voto.foto_id, voto.vale])),
  };
}

// vale: true (vale), false (no vale) o null (sin votar). La base registra quién y cuándo
export async function votar(fotoId: string, vale: boolean | null): Promise<void> {
  const { error } = vale === null
    ? await supabase().from("votos").delete().eq("foto_id", fotoId)
    : await supabase().from("votos").upsert({ foto_id: fotoId, vale }, { onConflict: "foto_id" });
  if (error) throw error;
}
