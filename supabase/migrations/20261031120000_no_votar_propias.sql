-- Nadie puede votar sus propias fotos: solo los demás.
-- "Propias" = de un jugador vinculado a este navegador (sirve aunque tenga varios celulares)

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

drop policy "votar" on public.votos;
drop policy "cambiar voto" on public.votos;
drop policy "borrar voto" on public.votos;

create policy "votar" on public.votos for insert to authenticated
with check (public.puedo_votar(foto_id));

create policy "cambiar voto" on public.votos for update to authenticated
using (public.puedo_votar(foto_id))
with check (public.puedo_votar(foto_id));

create policy "borrar voto" on public.votos for delete to authenticated
using (public.puedo_votar(foto_id));
