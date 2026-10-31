-- Bingo de Halloween: esquema inicial
-- Sin login de email: cada navegador entra con un usuario anónimo de Supabase y
-- se vincula a un jugador. Con el código de recuperación se vincula otro navegador
-- al mismo jugador (puede haber varios a la vez).

-- ─── Tablas ────────────────────────────────────────────────────────────────

-- El id del jugador es público y es la semilla de su tablero
create table public.jugadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 30),
  creado_en timestamptz not null default now(),
  -- Con valor, el tablero está cerrado y entregado para la revisión
  entregado_en timestamptz
);

-- Código de recuperación, aparte para que nunca se lea desde la revisión
create table public.codigos (
  jugador_id uuid primary key references public.jugadores (id) on delete cascade,
  codigo uuid not null unique default gen_random_uuid()
);

-- Navegadores (usuarios anónimos) vinculados a cada jugador
create table public.jugador_dispositivos (
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  auth_id uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (jugador_id, auth_id)
);
create index jugador_dispositivos_auth_id on public.jugador_dispositivos (auth_id);

-- subida_en la pone siempre el servidor: es la hora oficial para desempatar
create table public.fotos (
  id uuid primary key,
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  categoria text not null,
  ruta text not null unique,
  capturada_en timestamptz not null,
  subida_en timestamptz not null default now()
);
create index fotos_jugador_id on public.fotos (jugador_id);

-- Hasta 2 cambios de categoría por jugador (los escribe solo el servidor)
create table public.cambios (
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  numero smallint not null check (numero between 1 and 2),
  posicion smallint not null check (posicion between 0 and 8),
  categoria text not null,
  creado_en timestamptz not null default now(),
  primary key (jugador_id, numero)
);

-- Foto final elegida en cada celda
create table public.elecciones (
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  categoria text not null,
  foto_id uuid not null references public.fotos (id) on delete cascade,
  primary key (jugador_id, categoria)
);

-- Una decisión del grupo por foto: vale o no vale
create table public.votos (
  foto_id uuid primary key references public.fotos (id) on delete cascade,
  vale boolean not null,
  votado_por uuid references auth.users (id) on delete set null,
  votado_en timestamptz not null default now()
);

-- ─── Horas y autores que no se pueden falsear ──────────────────────────────

create function public.fijar_subida_en() returns trigger
language plpgsql as $$
begin
  new.subida_en := now();
  return new;
end $$;

create trigger fotos_subida_en before insert on public.fotos
for each row execute function public.fijar_subida_en();

create function public.fijar_voto() returns trigger
language plpgsql as $$
begin
  new.votado_por := auth.uid();
  new.votado_en := now();
  return new;
end $$;

create trigger votos_autor before insert or update on public.votos
for each row execute function public.fijar_voto();

-- ─── Funciones de ayuda para las reglas (security definer: sin recursión de RLS) ──

create function public.es_mi_jugador(p_jugador uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jugador_dispositivos
    where jugador_id = p_jugador and auth_id = auth.uid()
  );
$$;

create function public.esta_entregado(p_jugador uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select entregado_en is not null from jugadores where id = p_jugador), false);
$$;

-- Fotos de Storage: la primera carpeta de la ruta es el id del jugador
create function public.puedo_escribir_carpeta(p_ruta text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_jugador uuid;
begin
  begin
    v_jugador := (storage.foldername(p_ruta))[1]::uuid;
  exception when others then
    return false;
  end;
  return es_mi_jugador(v_jugador) and not esta_entregado(v_jugador);
end $$;

-- ─── RPC ───────────────────────────────────────────────────────────────────

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
create function public.entregar(p_jugador uuid) returns void
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

create function public.reabrir(p_jugador uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_mi_jugador(p_jugador) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update jugadores set entregado_en = null where jugadores.id = p_jugador;
end $$;

-- Las funciones de ayuda no se llaman desde afuera
revoke execute on function public.es_mi_jugador(uuid), public.esta_entregado(uuid),
  public.puedo_escribir_carpeta(text) from public, anon;
revoke execute on function public.crear_jugador(text), public.recuperar_jugador(uuid),
  public.entregar(uuid), public.reabrir(uuid) from public, anon;
grant execute on function public.crear_jugador(text), public.recuperar_jugador(uuid),
  public.entregar(uuid), public.reabrir(uuid) to authenticated;
grant execute on function public.es_mi_jugador(uuid), public.esta_entregado(uuid),
  public.puedo_escribir_carpeta(text) to authenticated;

-- ─── Vista de la revisión ──────────────────────────────────────────────────

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

-- ─── Reglas (RLS) ──────────────────────────────────────────────────────────
-- Los usuarios anónimos de Supabase tienen el rol "authenticated"

alter table public.jugadores enable row level security;
alter table public.codigos enable row level security;
alter table public.jugador_dispositivos enable row level security;
alter table public.fotos enable row level security;
alter table public.cambios enable row level security;
alter table public.elecciones enable row level security;
alter table public.votos enable row level security;

revoke all on public.jugadores, public.codigos, public.jugador_dispositivos, public.fotos,
  public.cambios, public.elecciones, public.votos, public.revision from anon;

-- Jugadores: el propio o los entregados (para la revisión). Se crean y cierran por RPC
create policy "ver jugadores" on public.jugadores for select to authenticated
using (public.es_mi_jugador(id) or entregado_en is not null);

create policy "ver mi codigo" on public.codigos for select to authenticated
using (public.es_mi_jugador(jugador_id));

create policy "ver mis dispositivos" on public.jugador_dispositivos for select to authenticated
using (auth_id = auth.uid());

-- Fotos: las propias, más las elegidas de los tableros entregados
create policy "ver fotos" on public.fotos for select to authenticated
using (
  public.es_mi_jugador(jugador_id)
  or exists (
    select 1 from public.elecciones e
    where e.foto_id = fotos.id and public.esta_entregado(e.jugador_id)
  )
);

create policy "subir mis fotos" on public.fotos for insert to authenticated
with check (
  public.es_mi_jugador(jugador_id)
  and not public.esta_entregado(jugador_id)
  and ruta = jugador_id::text || '/' || id::text || '.jpg'
);

create policy "borrar mis fotos" on public.fotos for delete to authenticated
using (public.es_mi_jugador(jugador_id) and not public.esta_entregado(jugador_id));

-- Cambios: se leen los propios; los escribe el servidor con la clave secreta
create policy "ver mis cambios" on public.cambios for select to authenticated
using (public.es_mi_jugador(jugador_id));

-- Elecciones: la foto tiene que ser del jugador y de esa categoría
create policy "ver elecciones" on public.elecciones for select to authenticated
using (public.es_mi_jugador(jugador_id) or public.esta_entregado(jugador_id));

create policy "elegir" on public.elecciones for insert to authenticated
with check (
  public.es_mi_jugador(jugador_id)
  and not public.esta_entregado(jugador_id)
  and exists (
    select 1 from public.fotos f
    where f.id = foto_id and f.jugador_id = elecciones.jugador_id and f.categoria = elecciones.categoria
  )
);

create policy "cambiar eleccion" on public.elecciones for update to authenticated
using (public.es_mi_jugador(jugador_id) and not public.esta_entregado(jugador_id))
with check (
  public.es_mi_jugador(jugador_id)
  and not public.esta_entregado(jugador_id)
  and exists (
    select 1 from public.fotos f
    where f.id = foto_id and f.jugador_id = elecciones.jugador_id and f.categoria = elecciones.categoria
  )
);

create policy "borrar eleccion" on public.elecciones for delete to authenticated
using (public.es_mi_jugador(jugador_id) and not public.esta_entregado(jugador_id));

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

create policy "votar" on public.votos for insert to authenticated
with check (public.es_foto_en_revision(foto_id));

create policy "cambiar voto" on public.votos for update to authenticated
using (public.es_foto_en_revision(foto_id))
with check (public.es_foto_en_revision(foto_id));

create policy "borrar voto" on public.votos for delete to authenticated
using (public.es_foto_en_revision(foto_id));

-- ─── Storage ───────────────────────────────────────────────────────────────
-- Bucket público: las fotos se ven con su URL, que no se puede adivinar.
-- Solo el dueño sube o borra, y no con el tablero entregado

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "fotos: ver" on storage.objects for select to authenticated
using (bucket_id = 'fotos');

create policy "fotos: subir las propias" on storage.objects for insert to authenticated
with check (bucket_id = 'fotos' and public.puedo_escribir_carpeta(name));

create policy "fotos: borrar las propias" on storage.objects for delete to authenticated
using (bucket_id = 'fotos' and public.puedo_escribir_carpeta(name));

-- ─── Realtime ──────────────────────────────────────────────────────────────
-- Votos y entregas en vivo en la revisión; fotos, cambios y elecciones para
-- sincronizar los celulares de un mismo jugador

alter publication supabase_realtime add table
  public.votos, public.jugadores, public.fotos, public.cambios, public.elecciones;
