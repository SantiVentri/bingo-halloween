// Aviso de cambios en localStorage para las pantallas que lo leen.
// Next guarda las páginas visitadas ocultas con su estado (<Activity>): sin esto,
// al volver al tablero se vería la elección o los cambios de antes
const EVENTO = "bingo-halloween:almacen";

export function suscribirAlmacen(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO, alCambiar);
  // Otra pestaña del mismo navegador
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

export function avisarCambioAlmacen(): void {
  window.dispatchEvent(new Event(EVENTO));
}

// El texto guardado sirve de "foto" estable para useSyncExternalStore
export function leerAlmacen(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
