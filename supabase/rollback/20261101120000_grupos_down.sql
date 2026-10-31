-- Rollback de 20261101120000_grupos.sql: deja el esquema como después de
-- 20261031120000_no_votar_propias.sql (sin grupos, un voto compartido por foto,
-- bucket público). Está fuera de migrations/ para que el CLI no lo aplique solo.
--
-- Borra todos los jugadores: los de los grupos no tienen dónde ir en el esquema
-- viejo. Para recuperar los datos de antes, restaurar el backup previo a la
-- migración después de correr este script. Vaciar también el bucket "fotos" desde
-- el dashboard (Supabase no deja borrar storage.objects por SQL).
--
-- Uso: pegarlo en el SQL editor de Supabase o `psql "$DB_URL" -f <este archivo>`

begin;

-- ─── Datos ─────────────────────────────────────────────────────────────────
-- Arrastra grupos, códigos, dispositivos, fotos, cambios, elecciones, votos y conteos

truncate table public.jugadores cascade;

-- ─── Storage: bucket público otra vez ──────────────────────────────────────

drop policy "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
using (bucket_id = 'fotos');

update storage.buckets set public = true where id = 'fotos';

-- ─── Lo que agregó la migración ────────────────────────────────────────────
-- Primero las reglas y la vista que usan las funciones nuevas o grupo_id

drop view public.revision;

drop policy "ver jugadores" on public.jugadores;
drop policy "ver fotos" on public.fotos;
drop policy "ver elecciones" on public.elecciones;
drop policy "ver mi grupo" on public.grupos;

-- Al borrarse, las tablas salen solas de la publicación de Realtime
drop table public.votos;
drop table public.conteos;

drop function public.buscar_grupo(text);
drop function public.crear_jugador(text, text);
drop function public.recuperar_jugador(uuid);
drop function public.cerrar_entregas(uuid);
drop function public.resumen_grupo(uuid);
drop function public.votar(uuid, uuid, boolean);
drop function public.actualizar_conteo();
drop function public.puedo_ver_foto(text);
drop function public.mismo_grupo(uuid);
drop function public.es_mi_grupo(uuid);
drop function public.entregas_cerradas(uuid);
drop function public.grupo_de(uuid);
drop function public.generar_codigo_grupo();

alter table public.jugadores drop column grupo_id;
drop table public.grupos;

-- ─── Lo de antes (copiado de 20261030120000_inicial.sql) ───────────────────

-- Una decisión del grupo por foto: vale o no vale
create table public.votos (
  foto_id uuid primary key references public.fotos (id) on delete cascade,
  vale boolean not null,
  votado_por uuid references auth.users (id) on delete set null,
  votado_en timestamptz not null default now()
);

create function public.fijar_voto() returns trigger
language plpgsql as $$
begin
  new.votado_por := auth.uid();
  new.votado_en := now();
  return new;
end $$;

create trigger votos_autor before insert or update on public.votos
for each row execute function public.fijar_voto();

create function public.crear_jugador(p_nombre text)
returns table (id uuid, nombre text, codigo uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_codigo uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  insert into jugadores (nombre) values (btrim(p_nombre)) returning jugadores.id into v_id;
  insert into codigos (jugador_id) values (v_id) returning codigos.codigo into v_codigo;
  insert into jugador_dispositivos (jugador_id, auth_id) values (v_id, auth.uid());
  return query select v_id, btrim(p_nombre), v_codigo;
end $$;

-- Vincula este navegador al jugador del código (el anterior sigue funcionando)
create function public.recuperar_jugador(p_codigo uuid)
returns table (id uuid, nombre text, codigo uuid)
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
  return query select j.id, j.nombre, p_codigo from jugadores j where j.id = v_id;
end $$;

-- Cierra y entrega el tablero: exige las 9 elecciones
create or replace function public.entregar(p_jugador uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_mi_jugador(p_jugador) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if (select count(*) from elecciones where jugador_id = p_jugador) <> 9 then
    raise exception 'Faltan fotos elegidas' using errcode = 'P0001';
  end if;
  update jugadores set entregado_en = now() where jugadores.id = p_jugador;
end $$;

create or replace function public.reabrir(p_jugador uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_mi_jugador(p_jugador) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update jugadores set entregado_en = null where jugadores.id = p_jugador;
end $$;

revoke execute on function public.crear_jugador(text), public.recuperar_jugador(uuid) from public, anon;
grant execute on function public.crear_jugador(text), public.recuperar_jugador(uuid) to authenticated;

create view public.revision with (security_invoker = true) as
select
  j.id as jugador_id,
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

alter table public.votos enable row level security;
revoke all on public.votos, public.revision from anon;

-- Jugadores: el propio o los entregados (para la revisión). Se crean y cierran por RPC
create policy "ver jugadores" on public.jugadores for select to authenticated
using (public.es_mi_jugador(id) or entregado_en is not null);

-- Fotos: las propias, más las elegidas de los tableros entregados
create policy "ver fotos" on public.fotos for select to authenticated
using (
  public.es_mi_jugador(jugador_id)
  or exists (
    select 1 from public.elecciones e
    where e.foto_id = fotos.id and public.esta_entregado(e.jugador_id)
  )
);

create policy "ver elecciones" on public.elecciones for select to authenticated
using (public.es_mi_jugador(jugador_id) or public.esta_entregado(jugador_id));

-- Votos: cualquiera puede votar, pero solo fotos elegidas de tableros entregados
create function public.es_foto_en_revision(p_foto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from elecciones e
    where e.foto_id = p_foto and esta_entregado(e.jugador_id)
  );
$$;
revoke execute on function public.es_foto_en_revision(uuid) from public, anon;
grant execute on function public.es_foto_en_revision(uuid) to authenticated;

create policy "ver votos" on public.votos for select to authenticated using (true);

-- ─── Lo de antes (copiado de 20261031120000_no_votar_propias.sql) ──────────

create function public.puedo_votar(p_foto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from elecciones e
    where e.foto_id = p_foto
      and esta_entregado(e.jugador_id)
      and not es_mi_jugador(e.jugador_id)
  );
$$;

revoke execute on function public.puedo_votar(uuid) from public, anon;
grant execute on function public.puedo_votar(uuid) to authenticated;

create policy "votar" on public.votos for insert to authenticated
with check (public.puedo_votar(foto_id));

create policy "cambiar voto" on public.votos for update to authenticated
using (public.puedo_votar(foto_id))
with check (public.puedo_votar(foto_id));

create policy "borrar voto" on public.votos for delete to authenticated
using (public.puedo_votar(foto_id));

-- ─── Realtime ──────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.votos;

commit;
