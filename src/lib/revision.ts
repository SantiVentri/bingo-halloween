import { asegurarSesion, supabase, urlsFirmadas } from "@/lib/supabase/cliente";
import { CELDAS_TABLERO } from "@/lib/tablero";

// Revisión del grupo: los tableros entregados con sus fotos elegidas. Cada jugador
// entregado vota cada foto de los demás entregados; los votos son anónimos y del
// grupo solo se ven los conteos. Una foto vale si más de la mitad de sus votantes
// dice que vale (el empate no vale)
export type FotoEnRevision = {
  id: string;
  categoria: string;
  // null si no se pudo firmar la URL
  url: string | null;
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

export type Conteo = { aFavor: number; enContra: number };

// id de foto → conteo; sin votos no aparece
export type Conteos = Record<string, Conteo>;

// id de foto → mi voto: vale (true) o no vale (false); sin votar no aparece
export type Votos = Record<string, boolean>;

export type Revision = {
  entregas: EntregaEnRevision[];
  conteos: Conteos;
  misVotos: Votos;
  // El creador cerró las entregas: el resultado sale cuando estén todos los votos
  cerrado: boolean;
};

export const SIN_VOTOS: Conteo = { aFavor: 0, enContra: 0 };

export function horaUltimaFoto(entrega: EntregaEnRevision): number {
  return Math.max(...entrega.fotos.map((foto) => Date.parse(foto.subidaEn)));
}

export function formatearHora(milisegundos: number): string {
  return new Date(milisegundos).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Las reglas de la base ya limitan la revisión a los grupos de este navegador; se
// filtra por el grupo del jugador por si el navegador tiene jugadores de otros grupos
export async function leerRevision(jugadorId: string, grupoId: string): Promise<Revision> {
  await asegurarSesion();
  const [filas, conteos, votos, grupo] = await Promise.all([
    supabase().from("revision").select("*").eq("grupo_id", grupoId).order("entregado_en"),
    supabase().from("conteos").select("foto_id, a_favor, en_contra").eq("grupo_id", grupoId),
    supabase().from("votos").select("foto_id, vale").eq("votante_id", jugadorId),
    supabase().from("grupos").select("entregas_cerradas_en").eq("id", grupoId).maybeSingle(),
  ]);
  const error = filas.error ?? conteos.error ?? votos.error ?? grupo.error;
  if (error) throw error;

  const urls = await urlsFirmadas((filas.data ?? []).map((fila) => fila.ruta));
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
      url: urls.get(fila.ruta) ?? null,
      capturadaEn: fila.capturada_en,
      subidaEn: fila.subida_en,
    });
    porJugador.set(fila.jugador_id, entrega);
  }

  return {
    entregas: [...porJugador.values()],
    conteos: Object.fromEntries((conteos.data ?? []).map((conteo) =>
      [conteo.foto_id, { aFavor: conteo.a_favor, enContra: conteo.en_contra }])),
    misVotos: Object.fromEntries((votos.data ?? []).map((voto) => [voto.foto_id, voto.vale])),
    cerrado: Boolean(grupo.data?.entregas_cerradas_en),
  };
}

// vale: true (vale), false (no vale) o null (sacar el voto). La base verifica que el
// votante haya entregado y que la foto sea de otro tablero entregado del grupo
export async function votar(votanteId: string, fotoId: string, vale: boolean | null): Promise<void> {
  const { error } = await supabase().rpc("votar", { p_votante: votanteId, p_foto: fotoId, p_vale: vale });
  if (error) throw error;
}

// El conteo como queda al cambiar mi voto, para mostrarlo antes de que responda la base
export function conteoConMiVoto(conteo: Conteo, anterior: boolean | undefined, nuevo: boolean | null): Conteo {
  const ajustado = { ...conteo };
  if (anterior === true) ajustado.aFavor--;
  if (anterior === false) ajustado.enContra--;
  if (nuevo === true) ajustado.aFavor++;
  if (nuevo === false) ajustado.enContra++;
  return ajustado;
}

// ─── Resultado ──────────────────────────────────────────────────────────────

// Votan todos los entregados menos el dueño de la foto
export function cantidadDeVotantes(entregas: EntregaEnRevision[]): number {
  return Math.max(entregas.length - 1, 0);
}

// Mayoría estricta: el empate no vale
export function esValida(conteo: Conteo, votantes: number): boolean {
  return votantes > 0 && conteo.aFavor * 2 > votantes;
}

export type FilaRanking = {
  entrega: EntregaEnRevision;
  validas: number;
  // Fotos que ya votaron todos
  votadas: number;
  ultimaFoto: number;
};

// Gana quien tenga más fotos válidas; si empatan, quien subió su última foto antes
export function armarRanking(entregas: EntregaEnRevision[], conteos: Conteos): FilaRanking[] {
  const votantes = cantidadDeVotantes(entregas);
  return entregas
    .map((entrega) => ({
      entrega,
      validas: entrega.fotos.filter((foto) => esValida(conteos[foto.id] ?? SIN_VOTOS, votantes)).length,
      votadas: entrega.fotos.filter((foto) => {
        const conteo = conteos[foto.id] ?? SIN_VOTOS;
        return conteo.aFavor + conteo.enContra >= votantes;
      }).length,
      ultimaFoto: horaUltimaFoto(entrega),
    }))
    .sort((a, b) =>
      b.validas - a.validas
      || a.ultimaFoto - b.ultimaFoto
      || a.entrega.nombre.localeCompare(b.entrega.nombre));
}

// Votos que faltan en todo el grupo
export function votosFaltantes(entregas: EntregaEnRevision[], conteos: Conteos): number {
  const votantes = cantidadDeVotantes(entregas);
  return entregas.reduce((total, entrega) => total + entrega.fotos.reduce((suma, foto) => {
    const conteo = conteos[foto.id] ?? SIN_VOTOS;
    return suma + Math.max(votantes - conteo.aFavor - conteo.enContra, 0);
  }, 0), 0);
}

// Fotos de los demás que todavía no voté
export function misVotosFaltantes(entregas: EntregaEnRevision[], misVotos: Votos, miId: string): number {
  return entregas
    .filter((entrega) => entrega.uuid !== miId)
    .reduce((total, entrega) => total + entrega.fotos.filter((foto) => misVotos[foto.id] === undefined).length, 0);
}

// Hay ganador cuando el creador cerró las entregas y todos votaron todo
export function hayResultado(revision: Revision): boolean {
  return revision.cerrado
    && revision.entregas.length >= 2
    && revision.entregas.every((entrega) => entrega.fotos.length === CELDAS_TABLERO)
    && votosFaltantes(revision.entregas, revision.conteos) === 0;
}

export function textoResultado(ranking: FilaRanking[]): string {
  const lineas = ranking.map((fila, posicion) =>
    `${posicion + 1}. ${fila.entrega.nombre}: ${fila.validas}/${CELDAS_TABLERO} válidas · última foto ${formatearHora(fila.ultimaFoto)}`);
  return ["🎃 Resultado Bingo Halloween", ...lineas, `🏆 Ganó ${ranking[0].entrega.nombre}`].join("\n");
}
