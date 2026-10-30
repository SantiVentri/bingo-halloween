import { BUCKET_FOTOS, supabase, urlPublica } from "@/lib/supabase/cliente";
import type { FilaFoto } from "@/lib/supabase/tipos";
import type { Foto } from "@/lib/fotos";

// Fotos en Supabase: el archivo en Storage (bucket público) y el registro en la
// tabla `fotos`, donde el servidor pone la hora de subida (RF-09, NF-06)
export function rutaDeFoto(jugadorId: string, fotoId: string): string {
  return `${jugadorId}/${fotoId}.jpg`;
}

function aFoto(fila: FilaFoto): Foto {
  return {
    id: fila.id,
    uuid: fila.jugador_id,
    categoria: fila.categoria,
    blob: null,
    estado: "subida",
    url: urlPublica(fila.ruta),
    capturadaEn: fila.capturada_en,
    subidaEn: fila.subida_en,
  };
}

export async function listarFotosRemotas(jugadorId: string): Promise<Foto[]> {
  const { data, error } = await supabase()
    .from("fotos")
    .select("*")
    .eq("jugador_id", jugadorId)
    .order("capturada_en");
  if (error) throw error;
  return data.map(aFoto);
}

// Sube el archivo y registra la foto. Se puede repetir sin duplicar: si el archivo
// o la fila ya estaban (un intento anterior que se cortó), sigue con lo que falta
export async function subirFoto(foto: Foto & { blob: Blob }): Promise<{ url: string; subidaEn: string }> {
  const ruta = rutaDeFoto(foto.uuid, foto.id);
  const { error: errorArchivo } = await supabase().storage.from(BUCKET_FOTOS).upload(ruta, foto.blob, {
    contentType: foto.blob.type || "image/jpeg",
    upsert: false,
  });
  // 409: el archivo ya estaba subido
  if (errorArchivo && !("statusCode" in errorArchivo && String(errorArchivo.statusCode) === "409")) {
    throw errorArchivo;
  }

  const { data, error } = await supabase()
    .from("fotos")
    .insert({
      id: foto.id,
      jugador_id: foto.uuid,
      categoria: foto.categoria,
      ruta,
      capturada_en: foto.capturadaEn,
    })
    .select("subida_en")
    .single();
  if (error?.code === "23505") {
    // La fila ya existía: se lee su hora
    const { data: existente, error: errorLectura } = await supabase()
      .from("fotos").select("subida_en").eq("id", foto.id).single();
    if (errorLectura) throw errorLectura;
    return { url: urlPublica(ruta), subidaEn: existente.subida_en };
  }
  if (error) throw error;
  return { url: urlPublica(ruta), subidaEn: data.subida_en };
}

// Borra las filas (las reglas de la base verifican que sean propias y que el
// tablero no esté entregado) y después los archivos
export async function borrarFotosRemotas(jugadorId: string, fotoIds: string[]): Promise<void> {
  if (fotoIds.length === 0) return;
  const { error } = await supabase().from("fotos").delete().in("id", fotoIds);
  if (error) throw error;
  const { error: errorArchivos } = await supabase().storage
    .from(BUCKET_FOTOS)
    .remove(fotoIds.map((fotoId) => rutaDeFoto(jugadorId, fotoId)));
  if (errorArchivos) throw errorArchivos;
}
