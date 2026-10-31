// Imagen del tablero con las fotos elegidas, para compartir en redes. Se dibuja en
// un canvas: el resultado no depende del tamaño de la pantalla del jugador
import { GIROS_CELDA, GIROS_SELLO } from "@/components/Tablero";
import { PATH_MARCO } from "@/components/MarcoGrilla";
import type { Foto } from "@/lib/fotos";
import { LADO_TABLERO } from "@/lib/tablero";

export type FormatoImagen = "publicacion" | "historia";

export type CeldaImagen = {
  categoria: string;
  foto: Foto;
};

// null si a alguna categoría le falta la foto elegida
export function armarCeldas(
  categorias: readonly string[],
  elegidas: Record<string, string>,
  fotos: Foto[],
): CeldaImagen[] | null {
  const celdas = categorias.flatMap((categoria) => {
    const foto = fotos.find((foto) => foto.id === elegidas[categoria]);
    return foto ? [{ categoria, foto }] : [];
  });
  return celdas.length === categorias.length ? celdas : null;
}

// Sin acentos ni símbolos: algunas apps rompen con esos nombres de archivo
export function nombreDeArchivo(nombre: string, formato: FormatoImagen) {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${["bingo-halloween", limpio, formato].filter(Boolean).join("-")}.jpg`;
}

type Alineacion = "left" | "center" | "right";

type Disposicion = {
  ancho: number;
  alto: number;
  grilla: { x: number; y: number; lado: number };
  logo: { x: number; y: number; tamano: number; alineacion: Alineacion };
  nombre: { x: number; y: number; tamano: number; alineacion: Alineacion; anchoMaximo: number };
};

// En historia, unos 250 px arriba y abajo quedan tapados por la interfaz de Instagram
export const FORMATOS: Record<FormatoImagen, Disposicion> = {
  publicacion: {
    ancho: 1080,
    alto: 1080,
    grilla: { x: 125, y: 176, lado: 830 },
    logo: { x: 125, y: 28, tamano: 104, alineacion: "left" },
    nombre: { x: 955, y: 74, tamano: 54, alineacion: "right", anchoMaximo: 480 },
  },
  historia: {
    ancho: 1080,
    alto: 1920,
    grilla: { x: 60, y: 480, lado: 960 },
    logo: { x: 540, y: 250, tamano: 150, alineacion: "center" },
    nombre: { x: 540, y: 1530, tamano: 76, alineacion: "center", anchoMaximo: 900 },
  },
};

const CALIDAD_JPEG = 0.9;

// Mismos valores que globals.css: el canvas no puede leer variables de CSS
const FONDO = "#0e0b0b";
const SANGRE = "#d0142c";
const CALABAZA = "#f47b20";
const HUESO = "#f2e8d8";
const TINTA = "#0e0b0b";
const VELO = "rgba(14, 11, 11, 0.8)";

// Borde rasgado de la celda, en porcentajes (Tablero.module.css)
const RASGADO_CELDA = [
  [0, 2], [12, 0], [34, 3], [58, 0], [82, 2], [100, 0], [98, 34],
  [100, 66], [98, 100], [74, 97], [48, 100], [26, 97], [2, 100], [0, 62],
];

// Posición en porcentaje del ancho; ancho y alto en cqw (MarcoGrilla.module.css)
const GOTAS = [
  { izquierda: 9, ancho: 1.4, alto: 6.6 },
  { izquierda: 27, ancho: 0.8, alto: 3.9 },
  { izquierda: 46, ancho: 1.1, alto: 5 },
  { izquierda: 63, ancho: 0.8, alto: 3.3 },
  { izquierda: 78, ancho: 1.7, alto: 7.2 },
  { izquierda: 92, ancho: 1.1, alto: 4.4 },
];

type Fuentes = { logo: string; titulo: string };

// next/font define las familias en variables sobre <html>
function leerFuentes(): Fuentes {
  const estilos = getComputedStyle(document.documentElement);
  return {
    logo: estilos.getPropertyValue("--fuente-logo"),
    titulo: estilos.getPropertyValue("--fuente-titulo"),
  };
}

// El canvas no espera a las fuentes: sin esto dibujaría con la de reemplazo
async function cargarFuentes(fuentes: Fuentes) {
  await Promise.all([
    document.fonts.load(`100px ${fuentes.logo}`, "BINGO"),
    document.fonts.load(`100px ${fuentes.titulo}`, "HALLOWEEN"),
  ]);
}

// Las fotos de otro celular solo están en Storage. Se pide con fetch porque una
// <img> sin CORS bloquearía la exportación del canvas; "reload" evita reutilizar
// la respuesta que esas <img> dejaron en la caché, que puede no traer las cabeceras
async function blobDeFoto(foto: Foto): Promise<Blob> {
  if (foto.blob) return foto.blob;
  if (!foto.url) throw new Error(`La foto ${foto.id} no tiene archivo`);
  const respuesta = await fetch(foto.url, { cache: "reload" });
  if (!respuesta.ok) throw new Error(`No se pudo descargar la foto ${foto.id}`);
  return respuesta.blob();
}

async function cargarFotos(celdas: CeldaImagen[]): Promise<ImageBitmap[]> {
  const resultados = await Promise.allSettled(celdas.map(async ({ foto }) =>
    createImageBitmap(await blobDeFoto(foto), { imageOrientation: "from-image" })));
  const bitmaps = resultados.flatMap((resultado) => resultado.status === "fulfilled" ? [resultado.value] : []);
  const fallida = resultados.find((resultado) => resultado.status === "rejected");
  if (fallida) {
    bitmaps.forEach((bitmap) => bitmap.close());
    throw fallida.reason;
  }
  return bitmaps;
}

// Escribe letra por letra: Safari no soporta letterSpacing en canvas
function textoEspaciado(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, espacio: number) {
  let posicion = x;
  for (const letra of texto) {
    ctx.fillText(letra, posicion, y);
    posicion += ctx.measureText(letra).width + espacio;
  }
}

function anchoEspaciado(ctx: CanvasRenderingContext2D, texto: string, espacio: number) {
  return [...texto].reduce((total, letra) => total + ctx.measureText(letra).width + espacio, -espacio);
}

// Equivale a object-fit: cover
function dibujarCubriendo(ctx: CanvasRenderingContext2D, imagen: ImageBitmap, lado: number) {
  const recorte = Math.min(imagen.width, imagen.height);
  ctx.drawImage(
    imagen,
    (imagen.width - recorte) / 2,
    (imagen.height - recorte) / 2,
    recorte,
    recorte,
    0,
    0,
    lado,
    lado,
  );
}

function partirEnLineas(ctx: CanvasRenderingContext2D, texto: string, anchoMaximo: number) {
  const lineas: string[] = [];
  for (const palabra of texto.split(" ")) {
    const candidata = lineas.length > 0 ? `${lineas.at(-1)} ${palabra}` : palabra;
    if (lineas.length > 0 && ctx.measureText(candidata).width <= anchoMaximo) {
      lineas[lineas.length - 1] = candidata;
    } else {
      lineas.push(palabra);
    }
  }
  return lineas;
}

// Hasta dos líneas: si no entra, achica la letra
function ajustarCategoria(ctx: CanvasRenderingContext2D, texto: string, anchoMaximo: number, tamanoInicial: number, familia: string) {
  let tamano = tamanoInicial;
  for (;;) {
    ctx.font = `${tamano}px ${familia}`;
    const lineas = partirEnLineas(ctx, texto, anchoMaximo);
    const entra = lineas.length <= 2 && lineas.every((linea) => ctx.measureText(linea).width <= anchoMaximo);
    if (entra || tamano < tamanoInicial / 2) return { lineas, tamano };
    tamano *= 0.92;
  }
}

function dibujarSello(ctx: CanvasRenderingContext2D, posicion: number, ladoCelda: number, cqw: number, familia: string) {
  const texto = "ENCONTRADO";
  const tamano = (8 * cqw) / LADO_TABLERO;
  const espacio = tamano * 0.06;
  const borde = 0.5 * cqw;
  const relleno = 0.7 * cqw;
  ctx.font = `${tamano}px ${familia}`;
  const anchoTexto = anchoEspaciado(ctx, texto, espacio);
  const ancho = anchoTexto + 2 * (relleno + borde);
  const alto = tamano * 1.3 + 2 * borde;

  ctx.save();
  ctx.translate(ladoCelda * 0.07 + ancho / 2, ladoCelda * 0.07 + alto / 2);
  ctx.rotate((GIROS_SELLO[posicion % GIROS_SELLO.length] * Math.PI) / 180);
  ctx.fillStyle = VELO;
  ctx.fillRect(-ancho / 2, -alto / 2, ancho, alto);
  ctx.strokeStyle = CALABAZA;
  ctx.lineWidth = borde;
  ctx.strokeRect(-ancho / 2 + borde / 2, -alto / 2 + borde / 2, ancho - borde, alto - borde);
  ctx.fillStyle = CALABAZA;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  textoEspaciado(ctx, texto, -anchoTexto / 2, 0, espacio);
  ctx.restore();
}

// Franja de papel con la categoría, pegada abajo de la celda
function dibujarCategoria(ctx: CanvasRenderingContext2D, categoria: string, ladoCelda: number, cqw: number, familia: string) {
  const rellenoX = 0.8 * cqw;
  const rellenoY = 0.5 * cqw;
  const { lineas, tamano } = ajustarCategoria(ctx, categoria, ladoCelda - 2 * rellenoX, (11 * cqw) / LADO_TABLERO, familia);
  const altoLinea = tamano * 1.08;
  const alto = altoLinea * lineas.length + 2 * rellenoY;

  ctx.fillStyle = HUESO;
  ctx.fillRect(0, ladoCelda - alto, ladoCelda, alto);
  ctx.fillStyle = TINTA;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lineas.forEach((linea, indice) => {
    ctx.fillText(linea, ladoCelda / 2, ladoCelda - alto + rellenoY + altoLinea * (indice + 0.5));
  });
}

function dibujarCelda(
  ctx: CanvasRenderingContext2D,
  celda: CeldaImagen,
  imagen: ImageBitmap,
  posicion: number,
  ladoCelda: number,
  cqw: number,
  familia: string,
) {
  ctx.save();
  ctx.translate(ladoCelda / 2, ladoCelda / 2);
  ctx.rotate((GIROS_CELDA[posicion % GIROS_CELDA.length] * Math.PI) / 180);
  ctx.translate(-ladoCelda / 2, -ladoCelda / 2);

  ctx.beginPath();
  RASGADO_CELDA.forEach(([x, y]) => ctx.lineTo((x * ladoCelda) / 100, (y * ladoCelda) / 100));
  ctx.closePath();
  ctx.clip();

  dibujarCubriendo(ctx, imagen, ladoCelda);
  dibujarSello(ctx, posicion, ladoCelda, cqw, familia);
  dibujarCategoria(ctx, celda.categoria, ladoCelda, cqw, familia);
  ctx.restore();
}

function dibujarGrilla(
  ctx: CanvasRenderingContext2D,
  { x, y, lado }: Disposicion["grilla"],
  celdas: CeldaImagen[],
  imagenes: ImageBitmap[],
  familia: string,
) {
  const cqw = lado / 100;
  const margen = 1.8 * cqw;
  const separacion = (4 * cqw) / LADO_TABLERO;
  const ladoCelda = (lado - 2 * margen - (LADO_TABLERO - 1) * separacion) / LADO_TABLERO;

  ctx.fillStyle = SANGRE;
  for (const gota of GOTAS) {
    ctx.beginPath();
    ctx.roundRect(x + (gota.izquierda * lado) / 100, y + lado - cqw, gota.ancho * cqw, (gota.alto + 1) * cqw, [0, 0, cqw, cqw]);
    ctx.fill();
  }

  celdas.forEach((celda, posicion) => {
    const columna = posicion % LADO_TABLERO;
    const fila = Math.floor(posicion / LADO_TABLERO);
    ctx.save();
    ctx.translate(x + margen + columna * (ladoCelda + separacion), y + margen + fila * (ladoCelda + separacion));
    dibujarCelda(ctx, celda, imagenes[posicion], posicion, ladoCelda, cqw, familia);
    ctx.restore();
  });

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(cqw, cqw);
  ctx.strokeStyle = SANGRE;
  ctx.lineWidth = 1.1;
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(PATH_MARCO));
  ctx.restore();
}

function dibujarLogo(ctx: CanvasRenderingContext2D, { x, y, tamano, alineacion }: Disposicion["logo"], fuentes: Fuentes) {
  const tamanoHalloween = tamano * 0.22;
  const espacio = tamanoHalloween * 0.34;

  ctx.textBaseline = "top";
  ctx.font = `${tamano}px ${fuentes.logo}`;
  const anchoBingo = ctx.measureText("BINGO").width;
  ctx.font = `${tamanoHalloween}px ${fuentes.titulo}`;
  const anchoHalloween = anchoEspaciado(ctx, "HALLOWEEN", espacio);
  const ancho = Math.max(anchoBingo, anchoHalloween);
  const inicio = alineacion === "center" ? x - ancho / 2 : alineacion === "right" ? x - ancho : x;

  ctx.textAlign = "left";
  ctx.fillStyle = SANGRE;
  ctx.font = `${tamano}px ${fuentes.logo}`;
  ctx.fillText("BINGO", inicio + (ancho - anchoBingo) / 2, y);
  ctx.fillStyle = CALABAZA;
  ctx.font = `${tamanoHalloween}px ${fuentes.titulo}`;
  textoEspaciado(ctx, "HALLOWEEN", inicio + (ancho - anchoHalloween) / 2, y + tamano * 1.02, espacio);
}

function dibujarNombre(ctx: CanvasRenderingContext2D, nombre: string, disposicion: Disposicion["nombre"], familia: string) {
  ctx.fillStyle = HUESO;
  ctx.font = `${disposicion.tamano}px ${familia}`;
  ctx.textAlign = disposicion.alineacion;
  ctx.textBaseline = "top";
  // Con anchoMaximo el canvas comprime los nombres muy largos en lugar de cortarlos
  ctx.fillText(nombre, disposicion.x, disposicion.y, disposicion.anchoMaximo);
}

// Falla si alguna foto no se puede cargar: no se genera una imagen incompleta
export async function generarImagenTablero({ celdas, nombre, formato }: {
  celdas: CeldaImagen[];
  nombre: string;
  formato: FormatoImagen;
}): Promise<Blob> {
  const disposicion = FORMATOS[formato];
  const fuentes = leerFuentes();
  await cargarFuentes(fuentes);
  const imagenes = await cargarFotos(celdas);

  const canvas = document.createElement("canvas");
  canvas.width = disposicion.ancho;
  canvas.height = disposicion.alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo crear el canvas");

  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, disposicion.ancho, disposicion.alto);
  dibujarLogo(ctx, disposicion.logo, fuentes);
  dibujarNombre(ctx, nombre, disposicion.nombre, fuentes.titulo);
  dibujarGrilla(ctx, disposicion.grilla, celdas, imagenes, fuentes.titulo);
  imagenes.forEach((imagen) => imagen.close());

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG),
  );
  // Safari retiene la memoria de los canvas grandes si no se vacían
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error("El navegador no pudo exportar la imagen");
  return blob;
}
