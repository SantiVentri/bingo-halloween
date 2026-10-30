// Tipos de la base (supabase/migrations). Escritos a mano: si cambia el esquema,
// actualizar acá o regenerarlos con `npx supabase gen types typescript`
type Tabla<Fila, Insertar> = {
  Row: Fila;
  Insert: Insertar;
  Update: Partial<Insertar>;
  Relationships: [];
};

export type FilaJugador = {
  id: string;
  nombre: string;
  creado_en: string;
  entregado_en: string | null;
};

export type FilaFoto = {
  id: string;
  jugador_id: string;
  categoria: string;
  ruta: string;
  capturada_en: string;
  subida_en: string;
};

export type FilaCambio = {
  jugador_id: string;
  numero: number;
  posicion: number;
  categoria: string;
  creado_en: string;
};

export type FilaEleccion = {
  jugador_id: string;
  categoria: string;
  foto_id: string;
};

export type FilaVoto = {
  foto_id: string;
  vale: boolean;
  votado_por: string | null;
  votado_en: string;
};

export type FilaRevision = {
  jugador_id: string;
  nombre: string;
  entregado_en: string;
  categoria: string;
  foto_id: string;
  ruta: string;
  capturada_en: string;
  subida_en: string;
};

type JugadorConCodigo = { id: string; nombre: string; codigo: string };

export type Database = {
  public: {
    Tables: {
      jugadores: Tabla<FilaJugador, Partial<FilaJugador>>;
      codigos: Tabla<{ jugador_id: string; codigo: string }, { jugador_id: string; codigo?: string }>;
      jugador_dispositivos: Tabla<{ jugador_id: string; auth_id: string; creado_en: string }, { jugador_id: string; auth_id: string }>;
      fotos: Tabla<FilaFoto, Omit<FilaFoto, "subida_en"> & { subida_en?: string }>;
      cambios: Tabla<FilaCambio, Omit<FilaCambio, "creado_en"> & { creado_en?: string }>;
      elecciones: Tabla<FilaEleccion, FilaEleccion>;
      votos: Tabla<FilaVoto, { foto_id: string; vale: boolean }>;
    };
    Views: {
      revision: { Row: FilaRevision; Relationships: [] };
    };
    Functions: {
      crear_jugador: { Args: { p_nombre: string }; Returns: JugadorConCodigo[] };
      recuperar_jugador: { Args: { p_codigo: string }; Returns: JugadorConCodigo[] };
      entregar: { Args: { p_jugador: string }; Returns: undefined };
      reabrir: { Args: { p_jugador: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
