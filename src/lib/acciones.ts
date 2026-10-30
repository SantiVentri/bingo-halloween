'use server'

import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// La URL de UploadThing termina en /f/<key>
function claveDeUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    return pathname.match(/^\/f\/([^/]+)$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Borra una foto de UploadThing (RF-14). Sin login, la única protección es que
// el nombre del archivo empiece con el UUID de quien la borra (NF-08)
export async function borrarFotoSubida(uuid: string, url: string): Promise<boolean> {
  const clave = claveDeUrl(url);
  if (!FORMATO_UUID.test(uuid) || !clave) return false;

  // Para 6 jugadores entra todo en una página
  const { files } = await utapi.listFiles({ limit: 500 });
  const archivo = files.find((file) => file.key === clave);
  if (!archivo) return true;
  if (!archivo.name.startsWith(`${uuid}__`)) return false;

  const { success } = await utapi.deleteFiles(clave);
  return success;
}
