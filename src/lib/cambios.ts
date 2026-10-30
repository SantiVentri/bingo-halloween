import { CAMBIOS_MAXIMOS, CATEGORIAS, type Cambio } from "@/lib/tablero";
import { avisarCambioAlmacen, leerAlmacen } from "@/lib/almacen";

// Cambios de categoría del jugador, en localStorage, uno por UUID
const PREFIJO = "bingo-halloween:cambios:";

const categorias: readonly string[] = CATEGORIAS;

export function esCambio(valor: unknown): valor is Cambio {
  if (typeof valor !== "object" || valor === null) return false;
  const { posicion, categoria } = valor as Record<string, unknown>;
  return (
    Number.isInteger(posicion) &&
    (posicion as number) >= 0 &&
    (posicion as number) < 9 &&
    typeof categoria === "string" &&
    categorias.includes(categoria)
  );
}

export function claveCambios(uuid: string): string {
  return PREFIJO + uuid;
}

export function interpretarCambios(texto: string | null): Cambio[] {
  try {
    const guardados: unknown = JSON.parse(texto ?? "[]");
    return Array.isArray(guardados) && guardados.every(esCambio)
      ? guardados.slice(0, CAMBIOS_MAXIMOS)
      : [];
  } catch {
    return [];
  }
}

// Solo en el navegador
export function obtenerCambios(uuid: string): Cambio[] {
  return interpretarCambios(leerAlmacen(claveCambios(uuid)));
}

export function guardarCambios(uuid: string, cambios: Cambio[]): void {
  localStorage.setItem(claveCambios(uuid), JSON.stringify(cambios.slice(0, CAMBIOS_MAXIMOS)));
  avisarCambioAlmacen();
}
