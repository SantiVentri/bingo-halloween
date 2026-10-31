-- Grupos de amigos: cada jugador pertenece a un solo grupo (para siempre) y solo ve
-- y vota los tableros de su grupo. Cada jugador entregado vota cada foto de los demás
-- entregados; una foto vale si más de la mitad de sus votantes dice que vale.
-- El creador del grupo cierra las entregas y, con todos los votos, sale el ganador.
--
-- Antes de aplicarla: hacer un backup y vaciar el bucket "fotos" desde el dashboard
-- (Supabase no deja borrar storage.objects por SQL). Esta migración borra todos los
-- jugadores. Para volver atrás: supabase/rollback/20261101120000_grupos_down.sql

-- ─── Base nueva ────────────────────────────────────────────────────────────

truncate table public.jugadores cascade;

-- ─── Grupos ────────────────────────────────────────────────────────────────

-- Código corto para dictar o compartir: sin 0/O ni 1/I, que se confunden
create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- Se completa en la misma transacción que crea al primer jugador
  creado_por uuid references public.jugadores (id) on delete set null,
  creado_en timestamptz not null default now(),
  -- Con valor, nadie más entra, entrega ni reabre: solo queda votar
  entregas_cerradas_en timestamptz
);

alter table public.jugadores
  add column grupo_id uuid not null references public.grupos (id) on delete cascade;
create index jugadores_grupo_id on public.jugadores (grupo_id);

create function public.generar_codigo_grupo() returns text
language plpgsql volatile set search_path = public as $$
declare
  v_letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text := '';
begin
  for i in 1..6 loop
    v_codigo := v_codigo || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
  end loop;
  return v_codigo;
end $$;

-- ─── Votos: uno por jugador y foto ─────────────────────────────────────────
-- El votante es el jugador (no el navegador): puede votar desde cualquiera de sus celulares

drop view public.revision;
drop table public.votos cascade;
drop function public.fijar_voto();
drop function public.puedo_votar(uuid);
drop function public.es_foto_en_revision(uuid);

create table public.votos (
  foto_id uuid not null references public.fotos (id) on delete cascade,
  votante_id uuid not null references public.jugadores (id) on delete cascade,
  vale boolean not null,
  votado_en timestamptz not null default now(),
  primary key (foto_id, votante_id)
);
create index votos_votante_id on public.votos (votante_id);

-- Conteo anónimo por foto: el grupo ve cuántos dijeron que vale y cuántos que no,
-- pero no quién. Lo mantiene un trigger sobre los votos
create table public.conteos (
  foto_id uuid primary key references public.fotos (id) on delete cascade,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  a_favor integer not null default 0,
  en_contra integer not null default 0
);
create index conteos_grupo_id on public.conteos (grupo_id);

create function public.actualizar_conteo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_foto uuid;
begin
  if tg_op = 'DELETE' then
    v_foto := old.foto_id;
  else
    v_foto := new.foto_id;
  end if;
  -- Si la foto se está borrando (cascada), no se encuentra y no se inserta nada
  insert into conteos (foto_id, grupo_id, a_favor, en_contra)
  select
    f.id,
    j.grupo_id,
    (select count(*) from votos v where v.foto_id = f.id and v.vale),
    (select count(*) from votos v where v.foto_id = f.id and not v.vale)
  from fotos f
  join jugadores j on j.id = f.jugador_id
  where f.id = v_foto
  on conflict (foto_id) do update
    set a_favor = excluded.a_favor, en_contra = excluded.en_contra;
  return null;
end $$;

create trigger votos_conteo after insert or update or delete on public.votos
for each row execute function public.actualizar_conteo();

-- ─── Funciones de ayuda ────────────────────────────────────────────────────

create function public.grupo_de(p_jugador uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select grupo_id from jugadores where id = p_jugador;
$$;

-- Un navegador puede estar vinculado a más de un jugador (con códigos de recuperación):
-- ve los grupos de todos ellos
create function public.es_mi_grupo(p_grupo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from jugador_dispositivos d
    join jugadores j on j.id = d.jugador_id
    where d.auth_id = auth.uid() and j.grupo_id = p_grupo
  );
$$;

create function public.mismo_grupo(p_jugador uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(es_mi_grupo(grupo_de(p_jugador)), false);
$$;

create function public.entregas_cerradas(p_grupo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select entregas_cerradas_en is not null from grupos where id = p_grupo), false);
$$;

-- Archivos de Storage: los propios, más las fotos elegidas de los tableros entregados
-- del mismo grupo
create function public.puedo_ver_foto(p_ruta text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_jugador uuid;
begin
  begin
    v_jugador := (storage.foldername(p_ruta))[1]::uuid;
  exception when others then
    return false;
  end;
  if es_mi_jugador(v_jugador) then
    return true;
  end if;
  return esta_entregado(v_jugador)
    and mismo_grupo(v_jugador)
    and exists (
      select 1
      from fotos f
      join elecciones e on e.foto_id = f.id
      where f.ruta = p_ruta
    );
end $$;

-- ─── RPC ───────────────────────────────────────────────────────────────────
-- Errores propios: P0002 no existe · BH001 el grupo cerró las entregas ·
-- BH002 faltan entregas para cerrar · BH003 hay que entregar para votar

drop function public.crear_jugador(text);
drop function public.recuperar_jugador(uuid);

-- Para validar el código antes de pedir el nombre
create function public.buscar_grupo(p_codigo text)
returns table (id uuid, cerrado boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  return query
    select g.id, g.entregas_cerradas_en is not null
    from grupos g
    where g.codigo = upper(btrim(p_codigo));
  if not found then
    raise exception 'Grupo inexistente' using errcode = 'P0002';
  end if;
end $$;

-- Sin código crea un grupo nuevo y el jugador queda como su creador.
-- El grupo se crea recién acá, con el nombre, así no quedan grupos vacíos
create function public.crear_jugador(p_nombre text, p_codigo_grupo text default null)
returns table (id uuid, nombre text, codigo uuid, grupo_id uuid, grupo_codigo text, es_creador boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_codigo uuid;
  v_grupo uuid;
  v_grupo_codigo text;
  v_cerrado boolean;
  v_creador boolean := p_codigo_grupo is null;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;

  if v_creador then
    loop
      begin
        insert into grupos (codigo) values (generar_codigo_grupo())
        returning grupos.id, grupos.codigo into v_grupo, v_grupo_codigo;
        exit;
      exception when unique_violation then
        -- El código ya existía: se sortea otro
      end;
    end loop;
  else
    -- for share: si justo se cierran las entregas, espera y lo ve cerrado
    select g.id, g.codigo, g.entregas_cerradas_en is not null
    into v_grupo, v_grupo_codigo, v_cerrado
    from grupos g
    where g.codigo = upper(btrim(p_codigo_grupo))
    for share;
    if v_grupo is null then
      raise exception 'Grupo inexistente' using errcode = 'P0002';
    end if;
    if v_cerrado then
      raise exception 'El grupo cerró las entregas' using errcode = 'BH001';
    end if;
  end if;

  insert into jugadores (nombre, grupo_id) values (btrim(p_nombre), v_grupo)
  returning jugadores.id into v_id;
  insert into codigos (jugador_id) values (v_id) returning codigos.codigo into v_codigo;
  insert into jugador_dispositivos (jugador_id, auth_id) values (v_id, auth.uid());
  if v_creador then
    update grupos set creado_por = v_id where grupos.id = v_grupo;
  end if;
  return query select v_id, btrim(p_nombre), v_codigo, v_grupo, v_grupo_codigo, v_creador;
end $$;

-- Vincula este navegador al jugador del código (el anterior sigue funcionando)
create function public.recuperar_jugador(p_codigo uuid)
returns table (id uuid, nombre text, codigo uuid, grupo_id uuid, grupo_codigo text, es_creador boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  select c.jugador_id into v_id from codigos c where c.codigo = p_codigo;
  if v_id is null then
    raise exception 'Código inválido' using errcode = 'P0002';
  end if;
  insert into jugador_dispositivos (jugador_id, auth_id)
  values (v_id, auth.uid())
  on conflict do nothing;
  return query
    select j.id, j.nombre, p_codigo, g.id, g.codigo, g.creado_por is not distinct from j.id
    from jugadores j
    join grupos g on g.id = j.grupo_id
    where j.id = v_id;
end $$;

-- Cierra y entrega el tablero: exige las 9 elecciones y que el grupo siga abierto
create or replace function public.entregar(p_jugador uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_mi_jugador(p_jugador) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform 1 from grupos where id = grupo_de(p_jugador) for share;
  if entregas_cerradas(grupo_de(p_jugador)) then
    raise exception 'El grupo cerró las entregas' using errcode = 'BH001';
  end if;
  if (select count(*) from elecciones where jugador_id = p_jugador) <> 9 then
    raise exception 'Faltan fotos elegidas' using errcode = 'P0001';
  end if;
  update jugadores set entregado_en = now() where jugadores.id = p_jugador;
end $$;

-- Al reabrir deja de ser votante: se borran los votos que hizo
create or replace function public.reabrir(p_jugador uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_mi_jugador(p_jugador) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform 1 from grupos where id = grupo_de(p_jugador) for share;
  if entregas_cerradas(grupo_de(p_jugador)) then
    raise exception 'El grupo cerró las entregas' using errcode = 'BH001';
  end if;
  update jugadores set entregado_en = null where jugadores.id = p_jugador;
  delete from votos where votante_id = p_jugador;
end $$;

-- Solo el creador. Hacen falta 2 entregas: con una sola no hay quién vote
create function public.cerrar_entregas(p_jugador uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_grupo uuid;
  v_cerrado boolean;
begin
  if not es_mi_jugador(p_jugador) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select g.id, g.entregas_cerradas_en is not null into v_grupo, v_cerrado
  from grupos g
  where g.creado_por = p_jugador
  for update;
  if v_grupo is null then
    raise exception 'Solo el creador del grupo cierra las entregas' using errcode = '42501';
  end if;
  if v_cerrado then
    return;
  end if;
  if (select count(*) from jugadores j where j.grupo_id = v_grupo and j.entregado_en is not null) < 2 then
    raise exception 'Faltan entregas' using errcode = 'BH002';
  end if;
  update grupos set entregas_cerradas_en = now() where grupos.id = v_grupo;
end $$;

-- Datos del grupo para el menú: los no entregados no se ven en la revisión,
-- pero cuentan como miembros
create function public.resumen_grupo(p_jugador uuid)
returns table (codigo text, es_creador boolean, entregas_cerradas_en timestamptz, miembros integer, entregados integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_mi_jugador(p_jugador) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select
      g.codigo,
      g.creado_por is not distinct from p_jugador,
      g.entregas_cerradas_en,
      (select count(*)::integer from jugadores j where j.grupo_id = g.id),
      (select count(*)::integer from jugadores j where j.grupo_id = g.id and j.entregado_en is not null)
    from grupos g
    where g.id = grupo_de(p_jugador);
end $$;

-- p_vale null borra el voto. Vota un jugador entregado, sobre una foto elegida de
-- otro tablero entregado de su grupo (nunca las propias)
create function public.votar(p_votante uuid, p_foto uuid, p_vale boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_duenio uuid;
begin
  if not es_mi_jugador(p_votante) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not esta_entregado(p_votante) then
    raise exception 'Hay que entregar el tablero para votar' using errcode = 'BH003';
  end if;
  select e.jugador_id into v_duenio from elecciones e where e.foto_id = p_foto;
  if v_duenio is null
    or not esta_entregado(v_duenio)
    or grupo_de(v_duenio) <> grupo_de(p_votante) then
    raise exception 'La foto no está en la revisión' using errcode = 'P0002';
  end if;
  if es_mi_jugador(v_duenio) then
    raise exception 'Las fotos propias no se votan' using errcode = '42501';
  end if;

  if p_vale is null then
    delete from votos where foto_id = p_foto and votante_id = p_votante;
  else
    insert into votos (foto_id, votante_id, vale) values (p_foto, p_votante, p_vale)
    on conflict (foto_id, votante_id) do update
      set vale = excluded.vale, votado_en = now();
  end if;
end $$;

revoke execute on function public.generar_codigo_grupo(), public.actualizar_conteo(),
  public.grupo_de(uuid), public.es_mi_grupo(uuid), public.mismo_grupo(uuid),
  public.entregas_cerradas(uuid), public.puedo_ver_foto(text),
  public.buscar_grupo(text), public.crear_jugador(text, text), public.recuperar_jugador(uuid),
  public.cerrar_entregas(uuid), public.resumen_grupo(uuid), public.votar(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.grupo_de(uuid), public.es_mi_grupo(uuid), public.mismo_grupo(uuid),
  public.entregas_cerradas(uuid), public.puedo_ver_foto(text),
  public.buscar_grupo(text), public.crear_jugador(text, text), public.recuperar_jugador(uuid),
  public.cerrar_entregas(uuid), public.resumen_grupo(uuid), public.votar(uuid, uuid, boolean)
  to authenticated;

-- ─── Vista de la revisión ──────────────────────────────────────────────────
-- Las reglas de abajo la limitan a los grupos de este navegador

create view public.revision with (security_invoker = true) as
select
  j.id as jugador_id,
  j.grupo_id,
  j.nombre,
  j.entregado_en,
  e.categoria,
  f.id as foto_id,
  f.ruta,
  f.capturada_en,
  f.subida_en
from public.jugadores j
join public.elecciones e on e.jugador_id = j.id
join public.fotos f on f.id = e.foto_id
where j.entregado_en is not null;

-- ─── Reglas (RLS) ──────────────────────────────────────────────────────────

alter table public.grupos enable row level security;
alter table public.votos enable row level security;
alter table public.conteos enable row level security;

revoke all on public.grupos, public.votos, public.conteos, public.revision from anon;

create policy "ver mi grupo" on public.grupos for select to authenticated
using (public.es_mi_grupo(id));

drop policy "ver jugadores" on public.jugadores;
create policy "ver jugadores" on public.jugadores for select to authenticated
using (public.es_mi_jugador(id) or (entregado_en is not null and public.mismo_grupo(id)));

drop policy "ver fotos" on public.fotos;
create policy "ver fotos" on public.fotos for select to authenticated
using (
  public.es_mi_jugador(jugador_id)
  or (
    public.mismo_grupo(jugador_id)
    and exists (
      select 1 from public.elecciones e
      where e.foto_id = fotos.id and public.esta_entregado(e.jugador_id)
    )
  )
);

drop policy "ver elecciones" on public.elecciones;
create policy "ver elecciones" on public.elecciones for select to authenticated
using (public.es_mi_jugador(jugador_id) or (public.esta_entregado(jugador_id) and public.mismo_grupo(jugador_id)));

-- Votos: cada uno ve solo los suyos. Se escriben con la RPC votar
create policy "ver mis votos" on public.votos for select to authenticated
using (public.es_mi_jugador(votante_id));

create policy "ver conteos de mi grupo" on public.conteos for select to authenticated
using (public.es_mi_grupo(grupo_id));

-- ─── Storage: bucket privado ───────────────────────────────────────────────
-- Las fotos se ven con URLs firmadas, que solo se generan si la regla lo permite

update storage.buckets set public = false where id = 'fotos';

drop policy "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
using (bucket_id = 'fotos' and public.puedo_ver_foto(name));

-- ─── Realtime ──────────────────────────────────────────────────────────────
-- Conteos en vivo en la revisión y el cierre de entregas del grupo.
-- La tabla votos vieja salió de la publicación al borrarse; los votos propios
-- se reflejan en los conteos

alter publication supabase_realtime add table public.conteos, public.grupos;
