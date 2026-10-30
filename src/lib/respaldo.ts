import { CATEGORIAS } from "@/lib/tablero";
import { esCodigoValido, generarUuid, normalizarCodigo, type Jugador } from "@/lib/jugador";
import type { Foto } from "@/lib/fotos";

// Respaldo en texto plano para mandarse por WhatsApp (RF-21) y pegarlo en otro celular (RF-22).
// Una línea por foto subida: "Categoría | fecha ISO | URL"
const ENCABEZADO = "🎃 Respaldo Bingo Halloween";
const SEPARADOR = " | ";

export type FotoRespaldada = {
  categoria: string;
  capturadaEn: string;
  url: string;
};

export type Respaldo = {
  uuid: string;
  nombre: string;
  fotos: FotoRespaldada[];
};

// Las fotos pendientes no entran: todavía no tienen URL
export function generarRespaldo(jugador: Jugador, fotos: Foto[]): string {
  const lineas = fotos
    .filter((foto) => foto.estado === "subida" && foto.url)
    .map((foto) => [foto.categoria, foto.capturadaEn, foto.url].join(SEPARADOR));

  return [ENCABEZADO, `Jugador: ${jugador.nombre}`, `Código: ${jugador.uuid}`, ...lineas].join("\n");
}

const LINEA_FOTO = /^(.+?)\s*\|\s*(\S+)\s*\|\s*(https:\/\/\S+)\s*$/;

// Devuelve null si el texto no es un respaldo (por ejemplo, si es solo el código)
export function leerRespaldo(texto: string): Respaldo | null {
  const codigo = texto.match(/Código:\s*(\S+)/i)?.[1];
  if (!codigo || !esCodigoValido(codigo)) return null;

  const nombre = texto.match(/Jugador:\s*(.+)/i)?.[1].trim() ?? "";
  const categorias: readonly string[] = CATEGORIAS;
  const fotos: FotoRespaldada[] = [];

  for (const linea of texto.split(/\r?\n/)) {
    const partes = linea.trim().match(LINEA_FOTO);
    if (!partes) continue;
    const [, categoria, capturadaEn, url] = partes;
    if (!categorias.includes(categoria) || Number.isNaN(Date.parse(capturadaEn))) continue;
    fotos.push({ categoria, capturadaEn, url });
  }

  return { uuid: normalizarCodigo(codigo), nombre, fotos };
}

// Las fotos restauradas ya están en UploadThing: entran como subidas y sin blob
export function fotosDelRespaldo(respaldo: Respaldo): Foto[] {
  return respaldo.fotos.map((foto) => ({
    id: generarUuid(),
    uuid: respaldo.uuid,
    categoria: foto.categoria,
    blob: null,
    estado: "subida",
    url: foto.url,
    capturadaEn: foto.capturadaEn,
    subidaEn: null,
  }));
}
