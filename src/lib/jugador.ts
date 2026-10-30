import { asegurarSesion, supabase } from "@/lib/supabase/cliente";

// Jugador sin login (RF-01, RF-02, RF-03): cada navegador entra a Supabase con un
// usuario anónimo y queda vinculado a un jugador. Con el código de recuperación se
// vincula otro navegador al mismo jugador; los dos siguen funcionando.
// En localStorage queda el jugador activo de este navegador
export type Jugador = {
  // Público: es la semilla del tablero
  id: string;
  nombre: string;
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

function esJugador(valor: unknown): valor is Jugador {
  if (typeof valor !== "object" || valor === null) return false;
  const { id, nombre } = valor as Record<string, unknown>;
  return typeof id === "string" && FORMATO_UUID.test(id) && typeof nombre === "string";
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

// Crea el jugador en la base; devuelve también el código para mostrarlo una vez
export async function crearJugador(nombre: string): Promise<{ jugador: Jugador; codigo: string }> {
  await asegurarSesion();
  const { data, error } = await supabase().rpc("crear_jugador", {
    p_nombre: nombre.trim().slice(0, LARGO_MAXIMO_NOMBRE),
  });
  const fila = data?.[0];
  if (error || !fila) throw error ?? new Error("No se pudo crear el jugador");
  const jugador = { id: fila.id, nombre: fila.nombre };
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
  const jugador = { id: fila.id, nombre: fila.nombre };
  guardarJugador(jugador);
  return jugador;
}

// El código de recuperación del jugador (solo lo puede leer el propio jugador)
export async function obtenerCodigo(jugadorId: string): Promise<string | null> {
  const { data } = await supabase().from("codigos").select("codigo").eq("jugador_id", jugadorId).maybeSingle();
  return data?.codigo ?? null;
}
