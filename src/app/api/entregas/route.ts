import { connection } from "next/server";
import { UTApi, UTFile } from "uploadthing/server";
import { esEntrega, PREFIJO_ENTREGA, type EntregaEnRevision } from "@/lib/entrega";

const utapi = new UTApi();

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Las URLs de UploadThing son https://<appId>.ufs.sh/f/<key>; el appId viene en el token
function urlDeArchivo(clave: string): string {
  const { appId } = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN ?? "", "base64").toString());
  return `https://${appId}.ufs.sh/f/${clave}`;
}

function claveDeUrl(url: string): string | null {
  try {
    return new URL(url).pathname.match(/^\/f\/([^/]+)$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function listarArchivos() {
  // Para 6 jugadores entra todo en una página
  const { files } = await utapi.listFiles({ limit: 500 });
  return files;
}

async function borrarEntregasDe(uuid: string): Promise<boolean> {
  const claves = (await listarArchivos())
    .filter((archivo) => archivo.name === `${PREFIJO_ENTREGA}${uuid}.json`)
    .map((archivo) => archivo.key);
  if (claves.length === 0) return true;
  const { success } = await utapi.deleteFiles(claves);
  return success;
}

// Sube la entrega del jugador al cerrar el tablero; reemplaza la anterior
export async function POST(request: Request) {
  const entrega: unknown = await request.json().catch(() => null);
  if (!esEntrega(entrega)) {
    return Response.json({ error: "Entrega inválida" }, { status: 400 });
  }

  if (!(await borrarEntregasDe(entrega.uuid))) {
    return Response.json({ error: "No se pudo reemplazar la entrega anterior" }, { status: 502 });
  }
  const archivo = new UTFile([JSON.stringify(entrega)], `${PREFIJO_ENTREGA}${entrega.uuid}.json`, {
    type: "application/json",
  });
  const { error } = await utapi.uploadFiles(archivo);
  return error
    ? Response.json({ error: "UploadThing no guardó la entrega" }, { status: 502 })
    : Response.json({ entregada: true });
}

// Saca la entrega de la revisión (al reabrir el tablero)
export async function DELETE(request: Request) {
  const { uuid } = await request.json().catch(() => ({}));
  if (typeof uuid !== "string" || !FORMATO_UUID.test(uuid)) {
    return Response.json({ error: "Pedido inválido" }, { status: 400 });
  }
  return (await borrarEntregasDe(uuid))
    ? Response.json({ retirada: true })
    : Response.json({ error: "UploadThing no la borró" }, { status: 502 });
}

// Entregas de todos para la revisión, con la hora de subida de cada foto según
// UploadThing (no se puede adelantar ni atrasar desde el celular)
export async function GET() {
  // Siempre al momento del pedido: no se prerenderiza en el build
  await connection();

  const archivos = await listarArchivos();
  const horaPorClave = new Map(archivos.map((archivo) => [archivo.key, archivo.uploadedAt]));
  const entregas = archivos.filter(
    (archivo) => archivo.name.startsWith(PREFIJO_ENTREGA) && archivo.status === "Uploaded",
  );

  const leidas = await Promise.all(entregas.map(async (archivo) => {
    try {
      const respuesta = await fetch(urlDeArchivo(archivo.key), { cache: "no-store" });
      const datos: unknown = await respuesta.json();
      if (!esEntrega(datos)) return null;
      const enRevision: EntregaEnRevision = {
        ...datos,
        fotos: datos.fotos.map((foto) => {
          const clave = claveDeUrl(foto.url);
          return { ...foto, subidaServidor: (clave && horaPorClave.get(clave)) || null };
        }),
      };
      return enRevision;
    } catch {
      return null;
    }
  }));

  // Si quedó más de una entrega del mismo jugador, vale la última confirmada
  const porJugador = new Map<string, EntregaEnRevision>();
  for (const entrega of leidas) {
    if (!entrega) continue;
    const anterior = porJugador.get(entrega.uuid);
    if (!anterior || anterior.confirmadaEn < entrega.confirmadaEn) porJugador.set(entrega.uuid, entrega);
  }

  return Response.json([...porJugador.values()]);
}
