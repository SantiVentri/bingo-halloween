import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";

// Cliente de Supabase del navegador. La sesión (un usuario anónimo, sin email)
// queda guardada en localStorage
let cliente: SupabaseClient<Database> | null = null;

export function supabase(): SupabaseClient<Database> {
  cliente ??= createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true } },
  );
  return cliente;
}

let sesionEnCurso: Promise<string> | null = null;

// Devuelve el id del usuario anónimo de este navegador; lo crea la primera vez
export function asegurarSesion(): Promise<string> {
  sesionEnCurso ??= (async () => {
    const { data } = await supabase().auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: nueva, error } = await supabase().auth.signInAnonymously();
    if (error || !nueva.user) {
      sesionEnCurso = null;
      throw error ?? new Error("No se pudo iniciar la sesión");
    }
    return nueva.user.id;
  })();
  return sesionEnCurso;
}

export const BUCKET_FOTOS = "fotos";

// Un día: alcanza para una noche de juego; cada lectura renueva las que estén por vencer
const DURACION_FIRMA = 60 * 60 * 24;
const MARGEN_FIRMA = 60 * 60 * 1000;
const firmas = new Map<string, { url: string; venceEn: number }>();

// El bucket es privado: las fotos se ven con URLs firmadas, que la base solo da a
// quien puede verlas (el dueño o su grupo). Se reutilizan mientras no estén por
// vencer: una URL nueva haría que las <img> descarguen la foto otra vez.
// Las rutas que no se pudieron firmar no aparecen en el resultado
export async function urlsFirmadas(rutas: string[]): Promise<Map<string, string>> {
  const ahora = Date.now();
  const faltan = [...new Set(rutas)].filter((ruta) => (firmas.get(ruta)?.venceEn ?? 0) - ahora < MARGEN_FIRMA);
  if (faltan.length > 0) {
    const { data, error } = await supabase().storage.from(BUCKET_FOTOS).createSignedUrls(faltan, DURACION_FIRMA);
    if (error) throw error;
    for (const firmada of data) {
      if (firmada.path && firmada.signedUrl && !firmada.error) {
        firmas.set(firmada.path, { url: firmada.signedUrl, venceEn: ahora + DURACION_FIRMA * 1000 });
      }
    }
  }
  return new Map(rutas.flatMap((ruta) => {
    const firma = firmas.get(ruta);
    return firma ? [[ruta, firma.url] as const] : [];
  }));
}
