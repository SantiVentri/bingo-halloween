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

const TAMANO_TABLERO = 9;

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

// Elige 9 categorías distintas y su orden a partir del UUID (RF-04, RF-05)
export function generarTablero(uuid: string): Categoria[] {
  const aleatorio = crearAleatorio(hashSemilla(uuid.trim().toLowerCase()));
  const mezcladas: Categoria[] = [...CATEGORIAS];

  // Fisher-Yates
  for (let i = mezcladas.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [mezcladas[i], mezcladas[j]] = [mezcladas[j], mezcladas[i]];
  }

  return mezcladas.slice(0, TAMANO_TABLERO);
}
