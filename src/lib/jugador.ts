// Jugador sin login: se identifica con un UUID guardado en localStorage (RF-01, RF-02, RF-03)
export type Jugador = {
  uuid: string;
  nombre: string;
  creadoEn: string;
};

const CLAVE_JUGADOR = "bingo-halloween:jugador";

export const LARGO_MAXIMO_NOMBRE = 30;

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// El código de recuperación es el mismo UUID; se acepta con espacios o en mayúsculas
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toLowerCase();
}

export function esCodigoValido(codigo: string): boolean {
  return FORMATO_UUID.test(normalizarCodigo(codigo));
}

// crypto.randomUUID solo existe en HTTPS o localhost; por la IP de la red local
// (http://192.168.x.x) se arma un UUID v4 a mano con getRandomValues
function generarUuid(): string {
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
  const { uuid, nombre, creadoEn } = valor as Record<string, unknown>;
  return (
    typeof uuid === "string" &&
    esCodigoValido(uuid) &&
    typeof nombre === "string" &&
    typeof creadoEn === "string"
  );
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

// Sin código crea un jugador nuevo; con código recupera el tablero de otro dispositivo
export function crearJugador(nombre: string, codigo?: string): Jugador {
  const jugador: Jugador = {
    uuid: codigo ? normalizarCodigo(codigo) : generarUuid(),
    nombre: nombre.trim().slice(0, LARGO_MAXIMO_NOMBRE),
    creadoEn: new Date().toISOString(),
  };
  guardarJugador(jugador);
  return jugador;
}
