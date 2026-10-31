import { avisarCambioAlmacen } from "@/lib/almacen";

// Votos de la revisión: se hace en un solo dispositivo, así que viven en su localStorage.
// Van por URL de foto: si alguien vuelve a entregar con otra foto, ese voto no se arrastra
export type Votos = Record<string, boolean>;

export const CLAVE_VOTOS = "bingo-halloween:votos";

export function interpretarVotos(texto: string | null): Votos {
  try {
    const guardados: unknown = JSON.parse(texto ?? "{}");
    if (typeof guardados !== "object" || guardados === null || Array.isArray(guardados)) return {};
    return Object.fromEntries(
      Object.entries(guardados).filter(([, voto]) => typeof voto === "boolean"),
    ) as Votos;
  } catch {
    return {};
  }
}

// vale: true (vale), false (no vale) o null (sin votar)
export function votar(votos: Votos, url: string, vale: boolean | null): void {
  const actualizados = { ...votos };
  if (vale === null) delete actualizados[url];
  else actualizados[url] = vale;
  localStorage.setItem(CLAVE_VOTOS, JSON.stringify(actualizados));
  avisarCambioAlmacen();
}
