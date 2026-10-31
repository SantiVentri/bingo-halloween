-- Cuentas de Google: se entra solo con Google y el usuario es el mismo en todos los
-- grupos y dispositivos. El modelo no cambia: un jugador es la participación de un
-- usuario en un grupo (con su nombre para ese grupo) y jugador_dispositivos dice
-- qué usuarios de auth lo controlan. Con Google ese usuario es la cuenta, así que
-- es_mi_jugador, las reglas, Storage y /api/cambios siguen igual.
--
-- Los usuarios anónimos de antes se convierten en cuentas con linkIdentity (mismo
-- auth.uid(), conservan tablero y fotos). Si la cuenta de Google ya estaba vinculada
-- a otro usuario, el navegador anónimo pasa sus jugadores con un traspaso.
--
-- Requiere en el dashboard: proveedor Google y "Manual linking" habilitados.
-- Para volver atrás: supabase/rollback/20261102120000_cuentas_google_down.sql

-- ─── Ayuda ─────────────────────────────────────────────────────────────────

-- Sesión de una cuenta (Google), no de un usuario anónimo
create function public.es_cuenta() returns boolean
language sql stable set search_path = public as $$
  select auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- El jugador del usuario en el grupo (uno por grupo). Si un traspaso juntó dos,
-- el más reciente
create function public.mi_jugador_en(p_grupo uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select j.id
  from jugadores j
  join jugador_dispositivos d on d.jugador_id = j.id
  where d.auth_id = auth.uid() and j.grupo_id = p_grupo
  order by j.creado_en desc
  limit 1;
$$;

-- ─── RPC ───────────────────────────────────────────────────────────────────

drop function public.buscar_grupo(text);
drop function public.crear_jugador(text, text);

-- Para validar el código antes de pedir el nombre. Si el usuario ya juega en el
-- grupo, devuelve su jugador: se entra directo, aunque el grupo esté cerrado
create function public.buscar_grupo(p_codigo text)
returns table (id uuid, codigo text, cerrado boolean, mi_jugador uuid, mi_nombre text, es_creador boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_cuenta() then
    raise exception 'Hay que entrar con Google' using errcode = '28000';
  end if;
  return query
    select g.id, g.codigo, g.entregas_cerradas_en is not null, j.id, j.nombre,
      j.id is not null and g.creado_por is not distinct from j.id
    from grupos g
    left join jugadores j on j.id = mi_jugador_en(g.id)
    where g.codigo = upper(btrim(p_codigo));
  if not found then
    raise exception 'Grupo inexistente' using errcode = 'P0002';
  end if;
end $$;

-- Sin código crea un grupo nuevo y el jugador queda como su creador.
-- Si el usuario ya juega en el grupo, devuelve ese jugador (no se crea otro)
create function public.crear_jugador(p_nombre text, p_codigo_grupo text default null)
returns table (id uuid, nombre text, grupo_id uuid, grupo_codigo text, es_creador boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_nombre text;
  v_grupo uuid;
  v_grupo_codigo text;
  v_cerrado boolean;
  v_creador boolean := p_codigo_grupo is null;
begin
  if not es_cuenta() then
    raise exception 'Hay que entrar con Google' using errcode = '28000';
  end if;
  -- Dos pedidos a la vez del mismo usuario no crean dos jugadores en el grupo
  perform pg_advisory_xact_lock(hashtext('crear_jugador:' || auth.uid()::text));

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

    v_id := mi_jugador_en(v_grupo);
    if v_id is not null then
      return query
        select j.id, j.nombre, g.id, g.codigo, g.creado_por is not distinct from j.id
        from jugadores j
        join grupos g on g.id = j.grupo_id
        where j.id = v_id;
      return;
    end if;

    if v_cerrado then
      raise exception 'El grupo cerró las entregas' using errcode = 'BH001';
    end if;
  end if;

  v_nombre := btrim(p_nombre);
  insert into jugadores (nombre, grupo_id) values (v_nombre, v_grupo)
  returning jugadores.id into v_id;
  insert into jugador_dispositivos (jugador_id, auth_id) values (v_id, auth.uid());
  if v_creador then
    update grupos set creado_por = v_id where grupos.id = v_grupo;
  end if;
  return query select v_id, v_nombre, v_grupo, v_grupo_codigo, v_creador;
end $$;

-- Los grupos del usuario, del más reciente al más viejo
create function public.mis_grupos()
returns table (
  jugador_id uuid, nombre text, grupo_id uuid, grupo_codigo text, es_creador boolean,
  entregado boolean, cerrado boolean, creado_en timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_cuenta() then
    raise exception 'Hay que entrar con Google' using errcode = '28000';
  end if;
  return query
    select j.id, j.nombre, g.id, g.codigo, g.creado_por is not distinct from j.id,
      j.entregado_en is not null, g.entregas_cerradas_en is not null, j.creado_en
    from jugador_dispositivos d
    join jugadores j on j.id = d.jugador_id
    join grupos g on g.id = j.grupo_id
    where d.auth_id = auth.uid()
    order by j.creado_en desc;
end $$;

-- Transición: el código de recuperación vincula su jugador a la cuenta de Google.
-- Igual que antes, pero solo con una cuenta
create or replace function public.recuperar_jugador(p_codigo uuid)
returns table (id uuid, nombre text, codigo uuid, grupo_id uuid, grupo_codigo text, es_creador boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not es_cuenta() then
    raise exception 'Hay que entrar con Google' using errcode = '28000';
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

-- ─── Traspaso de un usuario anónimo a una cuenta ───────────────────────────
-- linkIdentity falla si la cuenta de Google ya está vinculada a otro usuario. Antes
-- de entrar con esa cuenta, la sesión anónima pide un token (secreto, queda solo en
-- ese navegador) y, ya con la cuenta, el token pasa sus jugadores a la cuenta

create table public.traspasos (
  token uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

-- Sin reglas: solo se usa desde las RPC
alter table public.traspasos enable row level security;
revoke all on public.traspasos from anon, authenticated;

create function public.preparar_traspaso() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_token uuid;
begin
  if auth.uid() is null or es_cuenta() then
    raise exception 'Solo para usuarios anónimos' using errcode = '42501';
  end if;
  delete from traspasos where creado_en < now() - interval '15 minutes';
  insert into traspasos (auth_id) values (auth.uid()) returning token into v_token;
  return v_token;
end $$;

-- Devuelve cuántos jugadores pasaron a la cuenta (0 si el token no existe o venció)
create function public.completar_traspaso(p_token uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_anonimo uuid;
  v_cantidad integer;
begin
  if not es_cuenta() then
    raise exception 'Hay que entrar con Google' using errcode = '28000';
  end if;
  delete from traspasos
  where token = p_token and creado_en >= now() - interval '15 minutes'
  returning auth_id into v_anonimo;
  if v_anonimo is null then
    return 0;
  end if;
  insert into jugador_dispositivos (jugador_id, auth_id)
  select d.jugador_id, auth.uid()
  from jugador_dispositivos d
  where d.auth_id = v_anonimo
  on conflict do nothing;
  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end $$;

revoke execute on function public.es_cuenta(), public.mi_jugador_en(uuid),
  public.buscar_grupo(text), public.crear_jugador(text, text), public.mis_grupos(),
  public.preparar_traspaso(), public.completar_traspaso(uuid)
  from public, anon;
grant execute on function public.es_cuenta(), public.mi_jugador_en(uuid),
  public.buscar_grupo(text), public.crear_jugador(text, text), public.mis_grupos(),
  public.preparar_traspaso(), public.completar_traspaso(uuid)
  to authenticated;
