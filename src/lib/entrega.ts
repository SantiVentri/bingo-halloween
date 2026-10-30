// Entrega: al cerrar el tablero se sube a UploadThing un JSON con el nombre y las
// 9 fotos elegidas. La revisión del grupo lee las entregas de todos (sin base de datos)
export type FotoEntregada = {
  categoria: string;
  url: string;
  capturadaEn: string;
  // Según el reloj del celular; la revisión usa la hora del servidor si la encuentra
  subidaEn: string | null;
};

export type Entrega = {
  uuid: string;
  nombre: string;
  confirmadaEn: string;
  fotos: FotoEntregada[];
};

// Lo que devuelve /api/entregas: cada foto con la hora de subida según UploadThing
export type FotoEnRevision = FotoEntregada & {
  // Milisegundos; null si UploadThing todavía no la lista
  subidaServidor: number | null;
};

export type EntregaEnRevision = Omit<Entrega, "fotos"> & {
  fotos: FotoEnRevision[];
};

export const PREFIJO_ENTREGA = "entrega__";

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function esTexto(valor: unknown, largoMaximo = 200): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor.length <= largoMaximo;
}

export function esEntrega(valor: unknown): valor is Entrega {
  if (typeof valor !== "object" || valor === null) return false;
  const { uuid, nombre, confirmadaEn, fotos } = valor as Record<string, unknown>;
  return (
    typeof uuid === "string" &&
    FORMATO_UUID.test(uuid) &&
    esTexto(nombre, 60) &&
    esTexto(confirmadaEn, 40) &&
    Array.isArray(fotos) &&
    fotos.length === 9 &&
    fotos.every((foto) => {
      if (typeof foto !== "object" || foto === null) return false;
      const { categoria, url, capturadaEn, subidaEn } = foto as Record<string, unknown>;
      return (
        esTexto(categoria, 60) &&
        esTexto(url, 300) &&
        url.startsWith("https://") &&
        esTexto(capturadaEn, 40) &&
        (subidaEn === null || esTexto(subidaEn, 40))
      );
    })
  );
}

// La hora de la última foto entregada, para desempatar: la del servidor si
// está; si no, la del celular
export function horaUltimaFoto(entrega: EntregaEnRevision): number {
  return Math.max(...entrega.fotos.map((foto) =>
    foto.subidaServidor ?? Date.parse(foto.subidaEn ?? foto.capturadaEn)));
}

async function pedir(metodo: "POST" | "DELETE", cuerpo: unknown): Promise<boolean> {
  try {
    const respuesta = await fetch("/api/entregas", {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}

// Sube (o reemplaza) la entrega del jugador
export function enviarEntrega(entrega: Entrega): Promise<boolean> {
  return pedir("POST", entrega);
}

// Saca la entrega de la revisión (al reabrir el tablero)
export function retirarEntrega(uuid: string): Promise<boolean> {
  return pedir("DELETE", { uuid });
}
