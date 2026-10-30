import type { Foto } from "@/lib/fotos";

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
