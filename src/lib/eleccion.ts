import type { Foto } from "@/lib/fotos";

// Foto final elegida por celda (RF-16) y si el tablero ya se cerró.
// Se guarda en localStorage junto al jugador, una por UUID
export type Eleccion = {
  // categoría → id de la foto elegida
  elegidas: Record<string, string>;
  confirmadaEn: string | null;
};

const PREFIJO = "bingo-halloween:eleccion:";

const ELECCION_VACIA: Eleccion = { elegidas: {}, confirmadaEn: null };

function esEleccion(valor: unknown): valor is Eleccion {
  if (typeof valor !== "object" || valor === null) return false;
  const { elegidas, confirmadaEn } = valor as Record<string, unknown>;
  return (
    typeof elegidas === "object" &&
    elegidas !== null &&
    Object.values(elegidas).every((id) => typeof id === "string") &&
    (confirmadaEn === null || typeof confirmadaEn === "string")
  );
}

// Solo en el navegador
export function obtenerEleccion(uuid: string): Eleccion {
  try {
    const guardada: unknown = JSON.parse(localStorage.getItem(PREFIJO + uuid) ?? "null");
    return esEleccion(guardada) ? guardada : ELECCION_VACIA;
  } catch {
    return ELECCION_VACIA;
  }
}

export function guardarEleccion(uuid: string, eleccion: Eleccion): void {
  localStorage.setItem(PREFIJO + uuid, JSON.stringify(eleccion));
}

// Descarta las elegidas que ya no existen (se borraron) y elige sola
// la foto de las celdas que tienen una única foto
export function completarElegidas(
  categorias: readonly string[],
  fotos: Foto[],
  elegidas: Record<string, string>,
): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const categoria of categorias) {
    const fotosCelda = fotos.filter((foto) => foto.categoria === categoria);
    if (fotosCelda.some((foto) => foto.id === elegidas[categoria])) {
      resultado[categoria] = elegidas[categoria];
    } else if (fotosCelda.length === 1) {
      resultado[categoria] = fotosCelda[0].id;
    }
  }
  return resultado;
}
