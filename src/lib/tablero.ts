export const CATEGORIAS = [
  "Preso",
  "Conejita",
  "Pirata",
  "Policía",
  "Militar",
  "Princesa",
  "Político",
  "Animal",
  "Harry Potter",
  "Personajes de Series",
  "Diablita/o",
  "Angelita/o",
  "Superhéroe",
  "Payaso",
  "Jugador de Fútbol",
  "Personaje Argentino",
  "Villano",
  "Hombres de negro",
  "Personaje de videojuegos",
  "Otaku / Emo",
  "Brainrot / Meme",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

// Tiene que ser un cuadrado perfecto. La base también exige esta cantidad al entregar
// (función `entregar` en supabase/migrations): cambiarla acá solo cambia la interfaz
export const CELDAS_TABLERO = 9;
export const LADO_TABLERO = Math.sqrt(CELDAS_TABLERO);

// Convierte el UUID en un número de 32 bits (hash FNV-1a)
function hashSemilla(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Generador pseudoaleatorio con semilla (mulberry32): misma semilla, misma secuencia
function crearAleatorio(semilla: number): () => number {
  let estado = semilla;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cambio de una celda por una categoría al azar; se aplican en orden
export type Cambio = {
  posicion: number;
  categoria: Categoria;
};

export const CAMBIOS_MAXIMOS = 2;

// Elige las categorías del tablero, todas distintas, y su orden a partir del UUID (RF-04, RF-05)
// y después aplica los cambios de categoría que haya hecho el jugador
export function generarTablero(uuid: string, cambios: readonly Cambio[] = []): Categoria[] {
  const tablero = tableroOriginal(uuid);
  for (const { posicion, categoria } of cambios) tablero[posicion] = categoria;
  return tablero;
}

// Sortea la categoría del próximo cambio entre las que nunca estuvieron en el tablero.
// La semilla es el UUID y el número de cambio: recargar o recuperar el código
// en otro celular da el mismo resultado, así que no se puede volver a tirar
export function sortearCategoria(uuid: string, cambios: readonly Cambio[]): Categoria {
  const usadas = new Set<string>([
    ...tableroOriginal(uuid),
    ...cambios.map((cambio) => cambio.categoria),
  ]);
  const disponibles = CATEGORIAS.filter((categoria) => !usadas.has(categoria));
  const aleatorio = crearAleatorio(hashSemilla(`${normalizar(uuid)}:cambio:${cambios.length}`));
  return disponibles[Math.floor(aleatorio() * disponibles.length)];
}

function normalizar(uuid: string): string {
  return uuid.trim().toLowerCase();
}

function tableroOriginal(uuid: string): Categoria[] {
  const aleatorio = crearAleatorio(hashSemilla(normalizar(uuid)));
  const mezcladas: Categoria[] = [...CATEGORIAS];

  // Fisher-Yates
  for (let i = mezcladas.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [mezcladas[i], mezcladas[j]] = [mezcladas[j], mezcladas[i]];
  }

  return mezcladas.slice(0, CELDAS_TABLERO);
}
