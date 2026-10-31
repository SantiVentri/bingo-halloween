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

// Lo que se guarda en IndexedDB: los bytes de la foto como ArrayBuffer y no como
// Blob. Safari corrompe los blobs leídos de IndexedDB que se vuelven a guardar con
// la misma clave después de recargar (WebKit 240216): la foto se ve como "?"
type Registro = Omit<Foto, "blob"> & {
  datos: ArrayBuffer | null;
  tipo: string;
  // Formato anterior: el Blob tal cual. Se pasa a `datos` la próxima vez que se guarda
  blob?: Blob | null;
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

// Los bytes se leen antes de abrir la transacción: si se espera algo en el medio,
// IndexedDB la cierra sola
async function aRegistro(foto: Foto): Promise<Registro> {
  const { blob, ...resto } = foto;
  return { ...resto, datos: blob ? await blob.arrayBuffer() : null, tipo: blob?.type ?? "" };
}

// Cada lectura arma un Blob nuevo en memoria, que ya no depende de IndexedDB
function aFoto(registro: Registro): Foto {
  const { datos, tipo, blob, ...resto } = registro;
  return { ...resto, blob: datos ? new Blob([datos], { type: tipo }) : (blob ?? null) };
}

// Pasa un registro del formato anterior al nuevo. Si Safari ya había roto el blob,
// queda sin datos: las fotos subidas se vuelven a descargar de Storage
async function normalizar(registro: Registro): Promise<Registro> {
  if (!("blob" in registro)) return registro;
  const { blob, ...resto } = registro;
  const datos = blob ? await blob.arrayBuffer().catch(() => null) : null;
  return { ...resto, datos, tipo: blob?.type ?? "" };
}

function porCaptura(a: { capturadaEn: string }, b: { capturadaEn: string }): number {
  return a.capturadaEn.localeCompare(b.capturadaEn);
}

async function listarRegistros(uuid: string): Promise<Registro[]> {
  const almacen = await abrirAlmacen("readonly");
  return esperar(almacen.index("uuid").getAll(uuid));
}

// Ordenadas de la más vieja a la más nueva
export async function listarFotos(uuid: string): Promise<Foto[]> {
  return (await listarRegistros(uuid)).map(aFoto).sort(porCaptura);
}

export async function guardarFoto(foto: Foto): Promise<void> {
  const registro = await aRegistro(foto);
  const almacen = await abrirAlmacen("readwrite");
  await esperar(almacen.put(registro));
}

export async function obtenerFoto(id: string): Promise<Foto | undefined> {
  const almacen = await abrirAlmacen("readonly");
  const registro: Registro | undefined = await esperar(almacen.get(id));
  return registro && aFoto(registro);
}

export async function borrarFoto(id: string): Promise<void> {
  const almacen = await abrirAlmacen("readwrite");
  await esperar(almacen.delete(id));
}

// Al cerrar sesión: borra la copia local de las fotos que ya están en la nube (de
// todos los jugadores). Las pendientes quedan, para subirlas cuando se vuelva a entrar
export async function borrarFotosSubidas(): Promise<void> {
  const almacen = await abrirAlmacen("readwrite");
  await new Promise<void>((resolve, reject) => {
    const pedido = almacen.openCursor();
    pedido.onsuccess = () => {
      const cursor = pedido.result;
      if (!cursor) {
        resolve();
        return;
      }
      if ((cursor.value as Registro).estado === "subida") cursor.delete();
      cursor.continue();
    };
    pedido.onerror = () => reject(pedido.error);
  });
}

// Junta las fotos de la base con las locales y deja IndexedDB igual:
// - las de la base se guardan (sin datos si se subieron desde otro celular);
// - las locales ya subidas que no están en la base se borraron en otro celular;
// - las pendientes se conservan hasta que suban
export async function sincronizarFotos(uuid: string, remotas: Foto[]): Promise<Foto[]> {
  const leidos = await listarRegistros(uuid);
  const locales = await Promise.all(leidos.map(normalizar));
  const porId = new Map(locales.map((registro) => [registro.id, registro]));
  const idsRemotos = new Set(remotas.map((foto) => foto.id));

  const borrar = locales.filter((local) => local.estado === "subida" && !idsRemotos.has(local.id));
  // Las pendientes solo se reescriben si estaban en el formato anterior: si no,
  // podrían pisar una subida que terminó mientras tanto
  const pendientes = locales.filter((local) => local.estado === "pendiente" && !idsRemotos.has(local.id));
  const migradas = pendientes.filter((local) => !leidos.includes(local));
  const combinadas = await Promise.all(remotas.map(async (remota) => {
    const local = porId.get(remota.id);
    return {
      ...(await aRegistro(remota)),
      datos: local?.datos ?? null,
      tipo: local?.tipo ?? "",
      url: remota.url ?? local?.url ?? null,
    };
  }));

  const almacen = await abrirAlmacen("readwrite");
  await Promise.all([
    ...borrar.map((local) => esperar(almacen.delete(local.id))),
    ...[...migradas, ...combinadas].map((registro) => esperar(almacen.put(registro))),
  ]);
  return [...pendientes, ...combinadas].map(aFoto).sort(porCaptura);
}
