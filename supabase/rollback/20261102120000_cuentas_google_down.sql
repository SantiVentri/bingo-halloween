-- Rollback de 20261102120000_cuentas_google.sql: vuelven las RPC de los grupos con
-- usuarios anónimos y código de recuperación. Está fuera de migrations/ para que el
-- CLI no lo aplique solo.
--
-- No borra datos. Los jugadores creados con cuenta de Google no tienen código de
-- recuperación (el menú lo mostraría vacío) y siguen vinculados a esa cuenta.
--
-- Uso: pegarlo en el SQL editor de Supabase o `psql "$DB_URL" -f <este archivo>`,
-- y después volver a desplegar la versión anterior de la app

begin;

drop function public.completar_traspaso(uuid);
drop function public.preparar_traspaso();
drop table public.traspasos;
drop function public.mis_grupos();
drop function public.buscar_grupo(text);
drop function public.crear_jugador(text, text);

-- ─── Lo de antes (copiado de 20261101120000_grupos.sql) ────────────────────

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
      end;
    end loop;
  else
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

create or replace function public.recuperar_jugador(p_codigo uuid)
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

drop function public.mi_jugador_en(uuid);
drop function public.es_cuenta();

revoke execute on function public.buscar_grupo(text), public.crear_jugador(text, text) from public, anon;
grant execute on function public.buscar_grupo(text), public.crear_jugador(text, text) to authenticated;

commit;
