// Tipos de la base (supabase/migrations). Escritos a mano: si cambia el esquema,
// actualizar acá o regenerarlos con `npx supabase gen types typescript`
type Tabla<Fila, Insertar> = {
  Row: Fila;
  Insert: Insertar;
  Update: Partial<Insertar>;
  Relationships: [];
};

export type FilaGrupo = {
  id: string;
  codigo: string;
  creado_por: string | null;
  creado_en: string;
  entregas_cerradas_en: string | null;
};

export type FilaJugador = {
  id: string;
  grupo_id: string;
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
  votante_id: string;
  vale: boolean;
  votado_en: string;
};

export type FilaConteo = {
  foto_id: string;
  grupo_id: string;
  a_favor: number;
  en_contra: number;
};

export type FilaRevision = {
  jugador_id: string;
  grupo_id: string;
  nombre: string;
  entregado_en: string;
  categoria: string;
  foto_id: string;
  ruta: string;
  capturada_en: string;
  subida_en: string;
};

type JugadorConCodigo = {
  id: string;
  nombre: string;
  codigo: string;
  grupo_id: string;
  grupo_codigo: string;
  es_creador: boolean;
};

export type ResumenGrupo = {
  codigo: string;
  es_creador: boolean;
  entregas_cerradas_en: string | null;
  miembros: number;
  entregados: number;
};

export type Database = {
  public: {
    Tables: {
      grupos: Tabla<FilaGrupo, Partial<FilaGrupo>>;
      jugadores: Tabla<FilaJugador, Partial<FilaJugador>>;
      codigos: Tabla<{ jugador_id: string; codigo: string }, { jugador_id: string; codigo?: string }>;
      jugador_dispositivos: Tabla<{ jugador_id: string; auth_id: string; creado_en: string }, { jugador_id: string; auth_id: string }>;
      fotos: Tabla<FilaFoto, Omit<FilaFoto, "subida_en"> & { subida_en?: string }>;
      cambios: Tabla<FilaCambio, Omit<FilaCambio, "creado_en"> & { creado_en?: string }>;
      elecciones: Tabla<FilaEleccion, FilaEleccion>;
      // Se escriben con la RPC votar
      votos: Tabla<FilaVoto, never>;
      conteos: Tabla<FilaConteo, never>;
    };
    Views: {
      revision: { Row: FilaRevision; Relationships: [] };
    };
    Functions: {
      buscar_grupo: { Args: { p_codigo: string }; Returns: { id: string; cerrado: boolean }[] };
      crear_jugador: { Args: { p_nombre: string; p_codigo_grupo?: string | null }; Returns: JugadorConCodigo[] };
      recuperar_jugador: { Args: { p_codigo: string }; Returns: JugadorConCodigo[] };
      entregar: { Args: { p_jugador: string }; Returns: undefined };
      reabrir: { Args: { p_jugador: string }; Returns: undefined };
      cerrar_entregas: { Args: { p_jugador: string }; Returns: undefined };
      resumen_grupo: { Args: { p_jugador: string }; Returns: ResumenGrupo[] };
      votar: { Args: { p_votante: string; p_foto: string; p_vale: boolean | null }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
