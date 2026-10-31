import { supabaseServidor } from "@/lib/supabase/servidor";
import { CAMBIOS_MAXIMOS, generarTablero, sortearCategoria, type Categoria } from "@/lib/tablero";
import { BUCKET_FOTOS } from "@/lib/supabase/cliente";

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function error(mensaje: string, status: number) {
  return Response.json({ error: mensaje }, { status });
}

// Cambia una celda por una categoría al azar. El sorteo se hace acá (con la misma
// semilla de siempre) para que nadie pueda elegir la categoría a mano. Borra las
// fotos de esa celda (base y Storage) y registra el cambio
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { jugadorId, posicion } = await request.json().catch(() => ({}));
  if (!token || typeof jugadorId !== "string" || !FORMATO_UUID.test(jugadorId)
    || !Number.isInteger(posicion) || posicion < 0 || posicion > 8) {
    return error("Pedido inválido", 400);
  }

  const admin = supabaseServidor();
  const { data: usuario } = await admin.auth.getUser(token);
  if (!usuario.user) return error("Sin sesión", 401);

  const [dispositivo, jugador, previos] = await Promise.all([
    admin.from("jugador_dispositivos").select("auth_id")
      .eq("jugador_id", jugadorId).eq("auth_id", usuario.user.id).maybeSingle(),
    admin.from("jugadores").select("entregado_en").eq("id", jugadorId).maybeSingle(),
    admin.from("cambios").select("posicion, categoria").eq("jugador_id", jugadorId).order("numero"),
  ]);
  if (!dispositivo.data) return error("No es tu tablero", 403);
  if (!jugador.data) return error("No existe el jugador", 404);
  if (jugador.data.entregado_en) return error("El tablero ya está entregado", 409);
  if (previos.error) return error("No se pudieron leer los cambios", 502);

  const cambios = previos.data.map((cambio) => ({ posicion: cambio.posicion, categoria: cambio.categoria as Categoria }));
  if (cambios.length >= CAMBIOS_MAXIMOS) return error("Ya usaste los cambios", 409);

  const anterior = generarTablero(jugadorId, cambios)[posicion];
  const nueva = sortearCategoria(jugadorId, cambios);

  // Fotos de la celda que cambia
  const { data: fotos, error: errorFotos } = await admin.from("fotos").select("id, ruta")
    .eq("jugador_id", jugadorId).eq("categoria", anterior);
  if (errorFotos) return error("No se pudieron leer las fotos", 502);
  if (fotos.length > 0) {
    const { error: errorBorrado } = await admin.from("fotos").delete().in("id", fotos.map((foto) => foto.id));
    if (errorBorrado) return error("No se pudieron borrar las fotos", 502);
    await admin.storage.from(BUCKET_FOTOS).remove(fotos.map((foto) => foto.ruta));
  }

  // La clave primaria (jugador, número) impide un tercer cambio aunque lleguen dos pedidos juntos
  const { error: errorCambio } = await admin.from("cambios").insert({
    jugador_id: jugadorId,
    numero: cambios.length + 1,
    posicion,
    categoria: nueva,
  });
  if (errorCambio) return error("No se pudo registrar el cambio", 409);

  return Response.json({ anterior, categoria: nueva });
}
