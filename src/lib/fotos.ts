// Fotos del jugador guardadas en IndexedDB (T-03, NF-04)
// Una foto queda "pendiente" con su blob hasta que UploadThing confirma la subida
export type EstadoFoto = "pendiente" | "subida";

export type Foto = {
  id: string;
  uuid: string;
  categoria: string;
  // null en las fotos restauradas desde un respaldo: solo tienen la URL
  blob: Blob | null;
  estado: EstadoFoto;
  url: string | null;
  // Momento en que se eligió la foto, con el reloj del celular (RF-13)
  capturadaEn: string;
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

// Agrega las fotos de un respaldo, salteando las que ya están (misma URL)
export async function importarFotos(uuid: string, fotos: Foto[]): Promise<void> {
  const existentes = new Set((await listarFotos(uuid)).map((foto) => foto.url));
  const almacen = await abrirAlmacen("readwrite");
  await Promise.all(
    fotos
      .filter((foto) => !existentes.has(foto.url))
      .map((foto) => esperar(almacen.put(foto))),
  );
}
