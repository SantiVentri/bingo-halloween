import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// La URL de UploadThing termina en /f/<key>
function claveDeUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const { pathname } = new URL(url);
    return pathname.match(/^\/f\/([^/]+)$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Borra fotos de UploadThing: una (`url`, RF-14) o varias de una vez (`urls`, borrar todo el tablero).
// Es una ruta y no una Server Action porque las Server Actions se rechazan detrás de un
// proxy (dev tunnels) cuyo host no coincide.
// Sin login, la única protección es que el nombre del archivo empiece con el UUID de quien la borra (NF-08)
export async function DELETE(request: Request) {
  const { uuid, url, urls } = await request.json().catch(() => ({}));
  const lista: unknown[] = Array.isArray(urls) ? urls : [url];
  const claves = lista.map(claveDeUrl);
  if (
    typeof uuid !== "string" ||
    !FORMATO_UUID.test(uuid) ||
    claves.length === 0 ||
    claves.some((clave) => clave === null)
  ) {
    return Response.json({ error: "Pedido inválido" }, { status: 400 });
  }

  // Para 6 jugadores entra todo en una página. El listado tarda en mostrar las fotos
  // recién subidas: si no aparece, se borra igual (la clave solo la conoce quien tiene la URL)
  const { files } = await utapi.listFiles({ limit: 500 });
  const ajena = files.some(
    (file) => claves.includes(file.key) && !file.name.startsWith(`${uuid}__`),
  );
  if (ajena) {
    return Response.json({ error: "Alguna foto es de otro jugador" }, { status: 403 });
  }

  const { success } = await utapi.deleteFiles(claves as string[]);
  return success
    ? Response.json({ borrada: true })
    : Response.json({ error: "UploadThing no la borró" }, { status: 502 });
}
