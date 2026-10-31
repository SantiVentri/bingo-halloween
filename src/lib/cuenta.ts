import { supabase } from "@/lib/supabase/cliente";
import { borrarFotosSubidas } from "@/lib/fotos";
import { LARGO_MAXIMO_NOMBRE, nombreDelJugadorAnonimo, olvidarJugador, olvidarJugadorAnonimo } from "@/lib/jugador";

// Sesión del navegador: sin sesión, un usuario anónimo de la versión anterior
// (tiene que vincular Google) o una cuenta de Google
export type Sesion =
  | { tipo: "ninguna" }
  | { tipo: "anonima" }
  | { tipo: "cuenta"; email: string | null; nombre: string | null };

export async function leerSesion(): Promise<Sesion> {
  const { data } = await supabase().auth.getSession();
  const usuario = data.session?.user;
  if (!usuario) return { tipo: "ninguna" };
  if (usuario.is_anonymous) return { tipo: "anonima" };
  const datos = usuario.user_metadata as Record<string, unknown>;
  const nombre = [datos.full_name, datos.name].find((valor): valor is string => typeof valor === "string");
  return {
    tipo: "cuenta",
    email: usuario.email ?? null,
    nombre: nombre ? nombre.trim().slice(0, LARGO_MAXIMO_NOMBRE) : null,
  };
}

// Token del traspaso entre la sesión anónima y la cuenta (ver la migración
// 20261102120000_cuentas_google.sql)
const CLAVE_TRASPASO = "bingo-halloween:traspaso";

// Solo rutas de la app: evita que ?siguiente= mande a otro sitio
function rutaSegura(ruta: string | null): string {
  return ruta && ruta.startsWith("/") && !ruta.startsWith("//") ? ruta : "/";
}

function urlDeVuelta(siguiente: string): string {
  return `${window.location.origin}/auth/callback?siguiente=${encodeURIComponent(rutaSegura(siguiente))}`;
}

function entrarConOAuth(siguiente: string) {
  return supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: urlDeVuelta(siguiente) } });
}

// Va a Google y vuelve a /auth/callback, que después lleva a `siguiente`. Si este
// navegador tenía un tablero anónimo, el usuario anónimo pasa a ser la cuenta de
// Google (mismo id): conserva el tablero y las fotos
export async function entrarConGoogle(siguiente = "/"): Promise<void> {
  const sesion = await leerSesion();
  const { error } = sesion.tipo === "anonima" && nombreDelJugadorAnonimo() !== null
    ? await supabase().auth.linkIdentity({ provider: "google", options: { redirectTo: urlDeVuelta(siguiente) } })
    : await entrarConOAuth(siguiente);
  if (error) throw error;
}

export class ErrorDeIngreso extends Error { }

// Termina el ingreso al volver de Google. Devuelve a dónde seguir, o null si se fue
// de nuevo a Google (traspaso)
export async function completarIngreso(url: URL): Promise<string | null> {
  // Google y Supabase devuelven los errores en la query o en el hash
  const parametros = new URLSearchParams(url.search);
  new URLSearchParams(url.hash.slice(1)).forEach((valor, clave) => parametros.set(clave, valor));
  const siguiente = rutaSegura(parametros.get("siguiente"));

  // getSession espera a que el cliente canjee el ?code= de la URL
  const { data } = await supabase().auth.getSession();
  const usuario = data.session?.user;
  const codigoError = parametros.get("error_code");

  // La cuenta de Google ya estaba vinculada a otro usuario: se entra con esa cuenta
  // y se le pasan los jugadores del usuario anónimo
  if (codigoError === "identity_already_exists" && usuario?.is_anonymous) {
    const { data: token, error } = await supabase().rpc("preparar_traspaso");
    if (error || !token) throw error ?? new ErrorDeIngreso("No se pudo preparar el traspaso");
    localStorage.setItem(CLAVE_TRASPASO, token);
    const { error: errorOAuth } = await entrarConOAuth(siguiente);
    if (errorOAuth) throw errorOAuth;
    return null;
  }
  if (codigoError || parametros.has("error")) {
    throw new ErrorDeIngreso(parametros.get("error_description") ?? "Google no completó el ingreso");
  }
  if (!usuario || usuario.is_anonymous) {
    throw new ErrorDeIngreso("No se pudo iniciar la sesión");
  }

  const token = localStorage.getItem(CLAVE_TRASPASO);
  if (token) {
    const { error } = await supabase().rpc("completar_traspaso", { p_token: token });
    if (error) throw error;
    localStorage.removeItem(CLAVE_TRASPASO);
  }
  // Su jugador ya es de la cuenta: aparece en "Mis grupos"
  olvidarJugadorAnonimo();
  return siguiente;
}

// Solo en este navegador: la cuenta sigue abierta en los demás. Las fotos que ya
// están en la nube se borran del celular (por si es compartido); las pendientes
// quedan para subirse cuando se vuelva a entrar
export async function cerrarSesion(): Promise<void> {
  olvidarJugador();
  olvidarJugadorAnonimo();
  localStorage.removeItem(CLAVE_TRASPASO);
  try {
    await borrarFotosSubidas();
  } catch {
    // Sin IndexedDB no hay nada que borrar
  }
  await supabase().auth.signOut({ scope: "local" });
}
