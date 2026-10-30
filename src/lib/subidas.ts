import { genUploader } from "uploadthing/client";
import type { RouterSubidas } from "@/app/api/uploadthing/core";
import type { Foto } from "@/lib/fotos";

// Borra la foto de UploadThing a través de /api/fotos (RF-14)
export async function borrarFotoSubida(uuid: string, url: string): Promise<boolean> {
  const respuesta = await fetch("/api/fotos", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuid, url }),
  });
  return respuesta.ok;
}

let subirArchivos: ReturnType<typeof genUploader<RouterSubidas>>["uploadFiles"] | null = null;

// Pasa letras con tilde y espacios a algo seguro para el nombre del archivo
function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Sube la foto desde el navegador a UploadThing y devuelve su URL (RF-09, NF-06).
// El nombre lleva UUID y categoría para poder listar las fotos de todos más adelante (RF-25)
export async function subirFoto(foto: Foto & { blob: Blob }): Promise<string> {
  subirArchivos ??= genUploader<RouterSubidas>().uploadFiles;

  const nombre = `${foto.uuid}__${aSlug(foto.categoria)}__${foto.id}.jpg`;
  const archivo = new File([foto.blob], nombre, { type: foto.blob.type || "image/jpeg" });
  const [subida] = await subirArchivos("foto", { files: [archivo] });
  return subida.ufsUrl;
}
