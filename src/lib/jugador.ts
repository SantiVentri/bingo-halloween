import { asegurarSesion, supabase } from "@/lib/supabase/cliente";

// Jugador sin login (RF-01, RF-02, RF-03): cada navegador entra a Supabase con un
// usuario anónimo y queda vinculado a un jugador. Con el código de recuperación se
// vincula otro navegador al mismo jugador; los dos siguen funcionando.
// Cada jugador es de un solo grupo, para siempre: solo ve y vota a los de su grupo.
// En localStorage queda el jugador activo de este navegador
export type Grupo = {
  id: string;
  // Código corto para invitar: 6 letras y números, sin 0/O ni 1/I
  codigo: string;
  // El creador es quien cierra las entregas
  esCreador: boolean;
};

export type Jugador = {
  // Público: es la semilla del tablero
  id: string;
  nombre: string;
  grupo: Grupo;
};

const CLAVE_JUGADOR = "bingo-halloween:jugador";

export const LARGO_MAXIMO_NOMBRE = 30;

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// El código se acepta con espacios o en mayúsculas
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toLowerCase();
}

export function esCodigoValido(codigo: string): boolean {
  return FORMATO_UUID.test(normalizarCodigo(codigo));
}

export const LARGO_CODIGO_GRUPO = 6;
const FORMATO_CODIGO_GRUPO = /^[A-HJ-NP-Z2-9]{6}$/;

// El código del grupo se acepta en minúsculas y con espacios en el medio
export function normalizarCodigoGrupo(codigo: string): string {
  return codigo.replace(/\s+/g, "").toUpperCase();
}

export function esCodigoGrupoValido(codigo: string): boolean {
  return FORMATO_CODIGO_GRUPO.test(normalizarCodigoGrupo(codigo));
}

// El link de invitación precarga el código en el ingreso
export function linkDeInvitacion(codigo: string): string {
  return `${window.location.origin}/?grupo=${codigo}`;
}

// crypto.randomUUID solo existe en HTTPS o localhost; por la IP de la red local
// (http://192.168.x.x) se arma un UUID v4 a mano con getRandomValues
export function generarUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function esGrupo(valor: unknown): valor is Grupo {
  if (typeof valor !== "object" || valor === null) return false;
  const { id, codigo, esCreador } = valor as Record<string, unknown>;
  return typeof id === "string" && FORMATO_UUID.test(id)
    && typeof codigo === "string" && FORMATO_CODIGO_GRUPO.test(codigo)
    && typeof esCreador === "boolean";
}

// Los jugadores guardados antes de los grupos no tienen grupo: vuelven a entrar
function esJugador(valor: unknown): valor is Jugador {
  if (typeof valor !== "object" || valor === null) return false;
  const { id, nombre, grupo } = valor as Record<string, unknown>;
  return typeof id === "string" && FORMATO_UUID.test(id) && typeof nombre === "string" && esGrupo(grupo);
}

// Solo en el navegador. Devuelve null si no hay jugador o el guardado está roto
export function obtenerJugador(): Jugador | null {
  try {
    const guardado = localStorage.getItem(CLAVE_JUGADOR);
    if (!guardado) return null;
    const jugador: unknown = JSON.parse(guardado);
    return esJugador(jugador) ? jugador : null;
  } catch {
    return null;
  }
}

function guardarJugador(jugador: Jugador): void {
  localStorage.setItem(CLAVE_JUGADOR, JSON.stringify(jugador));
}

export function olvidarJugador(): void {
  localStorage.removeItem(CLAVE_JUGADOR);
}

type FilaJugadorConGrupo = {
  id: string;
  nombre: string;
  grupo_id: string;
  grupo_codigo: string;
  es_creador: boolean;
};

function aJugador(fila: FilaJugadorConGrupo): Jugador {
  return {
    id: fila.id,
    nombre: fila.nombre,
    grupo: { id: fila.grupo_id, codigo: fila.grupo_codigo, esCreador: fila.es_creador },
  };
}

// Errores de la base: el grupo no existe (P0002) o ya cerró las entregas (BH001)
export class ErrorDeGrupo extends Error {
  constructor(readonly motivo: "inexistente" | "cerrado") {
    super(motivo === "inexistente" ? "El grupo no existe" : "El grupo cerró las entregas");
  }
}

// Busca el grupo antes de pedir el nombre. Devuelve el código normalizado
export async function buscarGrupo(codigo: string): Promise<string> {
  await asegurarSesion();
  const normalizado = normalizarCodigoGrupo(codigo);
  const { data, error } = await supabase().rpc("buscar_grupo", { p_codigo: normalizado });
  if (error?.code === "P0002") throw new ErrorDeGrupo("inexistente");
  const fila = data?.[0];
  if (error || !fila) throw error ?? new Error("No se pudo buscar el grupo");
  if (fila.cerrado) throw new ErrorDeGrupo("cerrado");
  return normalizado;
}

// Crea el jugador en la base; devuelve también el código para mostrarlo una vez.
// Sin código de grupo, crea un grupo nuevo y el jugador queda como su creador
export async function crearJugador(
  nombre: string,
  codigoGrupo: string | null,
): Promise<{ jugador: Jugador; codigo: string }> {
  await asegurarSesion();
  const { data, error } = await supabase().rpc("crear_jugador", {
    p_nombre: nombre.trim().slice(0, LARGO_MAXIMO_NOMBRE),
    p_codigo_grupo: codigoGrupo,
  });
  if (error?.code === "P0002") throw new ErrorDeGrupo("inexistente");
  if (error?.code === "BH001") throw new ErrorDeGrupo("cerrado");
  const fila = data?.[0];
  if (error || !fila) throw error ?? new Error("No se pudo crear el jugador");
  const jugador = aJugador(fila);
  guardarJugador(jugador);
  return { jugador, codigo: fila.codigo };
}

// Vincula este navegador al jugador del código. null si el código no existe
export async function recuperarJugador(codigo: string): Promise<Jugador | null> {
  await asegurarSesion();
  const { data, error } = await supabase().rpc("recuperar_jugador", {
    p_codigo: normalizarCodigo(codigo),
  });
  // P0002: el código no existe
  if (error?.code === "P0002") return null;
  const fila = data?.[0];
  if (error || !fila) throw error ?? new Error("No se pudo recuperar el jugador");
  const jugador = aJugador(fila);
  guardarJugador(jugador);
  return jugador;
}

// El código de recuperación del jugador (solo lo puede leer el propio jugador)
export async function obtenerCodigo(jugadorId: string): Promise<string | null> {
  const { data } = await supabase().from("codigos").select("codigo").eq("jugador_id", jugadorId).maybeSingle();
  return data?.codigo ?? null;
}
