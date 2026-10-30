// Fotos del jugador en IndexedDB (T-03, NF-04). La base de Supabase es la fuente
// de verdad; acá queda la copia local y la cola de las que todavía no subieron:
// una foto queda "pendiente" con su blob hasta que se registra en la base
export type EstadoFoto = "pendiente" | "subida";

export type Foto = {
  id: string;
  // Id del jugador
  uuid: string;
  categoria: string;
  // null en las fotos subidas desde otro celular: solo tienen la URL
  blob: Blob | null;
  estado: EstadoFoto;
  url: string | null;
  // Momento en que se eligió la foto, con el reloj del celular (RF-13)
  capturadaEn: string;
  // Hora de subida según el servidor
  subidaEn: string | null;
};

const NOMBRE_BASE = "bingo-halloween";
const VERSION_BASE = 1;
const ALMACEN = "fotos";

let base: Promise<IDBDatabase> | null = null;

function abrirBase(): Promise<IDBDatabase> {
  base ??= new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOMBRE_BASE, VERSION_BASE);
    pedido.onupgradeneeded = () => {
      const almacen = pedido.result.createObjectStore(ALMACEN, { keyPath: "id" });
      almacen.createIndex("uuid", "uuid");
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => {
      base = null;
      reject(pedido.error);
    };
  });
  return base;
}

function esperar<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function abrirAlmacen(modo: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await abrirBase();
  return db.transaction(ALMACEN, modo).objectStore(ALMACEN);
}

// Ordenadas de la más vieja a la más nueva
export async function listarFotos(uuid: string): Promise<Foto[]> {
  const almacen = await abrirAlmacen("readonly");
  const fotos: Foto[] = await esperar(almacen.index("uuid").getAll(uuid));
  return fotos.sort((a, b) => a.capturadaEn.localeCompare(b.capturadaEn));
}

export async function guardarFoto(foto: Foto): Promise<void> {
  const almacen = await abrirAlmacen("readwrite");
  await esperar(almacen.put(foto));
}

export async function obtenerFoto(id: string): Promise<Foto | undefined> {
  const almacen = await abrirAlmacen("readonly");
  return esperar(almacen.get(id));
}

export async function borrarFoto(id: string): Promise<void> {
  const almacen = await abrirAlmacen("readwrite");
  await esperar(almacen.delete(id));
}

// Junta las fotos de la base con las locales y deja IndexedDB igual:
// - las de la base se guardan (sin blob si se subieron desde otro celular);
// - las locales ya subidas que no están en la base se borraron en otro celular;
// - las pendientes se conservan hasta que suban
export async function sincronizarFotos(uuid: string, remotas: Foto[]): Promise<Foto[]> {
  const locales = await listarFotos(uuid);
  const porId = new Map(locales.map((foto) => [foto.id, foto]));
  const idsRemotos = new Set(remotas.map((foto) => foto.id));
  const almacen = await abrirAlmacen("readwrite");
  const pedidos: Promise<unknown>[] = [];

  for (const local of locales) {
    if (local.estado === "subida" && !idsRemotos.has(local.id)) pedidos.push(esperar(almacen.delete(local.id)));
  }
  const resultado: Foto[] = locales.filter((local) => local.estado === "pendiente" && !idsRemotos.has(local.id));
  for (const remota of remotas) {
    const combinada = { ...remota, blob: porId.get(remota.id)?.blob ?? null };
    pedidos.push(esperar(almacen.put(combinada)));
    resultado.push(combinada);
  }
  await Promise.all(pedidos);
  return resultado.sort((a, b) => a.capturadaEn.localeCompare(b.capturadaEn));
}
