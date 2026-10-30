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

export function urlPublica(ruta: string): string {
  return supabase().storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl;
}
