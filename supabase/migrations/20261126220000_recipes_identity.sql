-- Recetas con identidad y cocinar con alguien (Fase 5).
-- Una receta es una fila que muchas entradas (y personas) enlazan. Los contadores y las listas pasan por la RLS de
-- quien mira, así que nadie puede deducir que alguien cocinó algo en privado.

-- ---------------------------------------------------------------------------------------------- participantes

create table public.entry_participants (
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index entry_participants_user on public.entry_participants (user_id, status);

-- Tope de personas por entrada: etiquetar es compartir la entrada con quien se etiqueta, y sin tope sería una forma
-- barata de enviar una entrada a mucha gente sin que lo pida.
create function public.participants_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.entry_participants where entry_id = new.entry_id) >= 10 then
    raise exception 'Una entrada admite como máximo 10 personas etiquetadas' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.participants_limit() from public, anon, authenticated;

create trigger participants_limit before insert on public.entry_participants
  for each row execute function public.participants_limit();

-- is_participant deja de ser un stub: te han etiquetado (pendiente o aceptado) en esa entrada.
create or replace function public.is_participant(eid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.entry_participants where entry_id = eid and user_id = (select auth.uid())
  )
$$;

-- Quien está etiquetada lee la entrada aunque sea privada (la autora la compartió con ella), pero solo mientras esté
-- publicada: si la autora la devolviera a borrador, dejaría de verla.
create or replace function public.can_read_entry(eid uuid, eauthor uuid, estatus text, evisibility text) returns boolean
language sql stable set search_path = ''
as $$
  select eauthor = (select auth.uid())
    or (estatus = 'published' and (
         public.is_participant(eid)
      or (evisibility = 'public' and (not public.is_private(eauthor) or public.is_follower(eauthor)))
      or (evisibility = 'followers' and public.is_follower(eauthor))))
$$;

alter table public.entry_participants enable row level security;
revoke all on public.entry_participants from anon, authenticated;

grant select, delete on public.entry_participants to authenticated;
grant insert (entry_id, user_id) on public.entry_participants to authenticated;
grant update (status) on public.entry_participants to authenticated;

-- Ven la fila: la persona etiquetada, la autora de la entrada, y —si la aceptó— cualquiera que pueda leer la entrada
-- (para enseñar «cocinado con…»). Las pendientes solo las ven las dos partes.
create policy participants_select on public.entry_participants
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.entries e where e.id = entry_id and e.author_id = (select auth.uid()))
    or (status = 'accepted' and exists (select 1 from public.entries e where e.id = entry_id))
  );

-- Solo la autora etiqueta, solo en entradas publicadas y no a sí misma. El estado nace 'pending' (el cliente no
-- tiene permiso para escribirlo al insertar).
create policy participants_insert_author on public.entry_participants
  for insert to authenticated
  with check (
    user_id <> (select auth.uid())
    and exists (
      select 1 from public.entries e
      where e.id = entry_id and e.author_id = (select auth.uid()) and e.status = 'published'
    )
  );

-- Solo la persona etiquetada acepta (y solo a 'accepted').
create policy participants_accept on public.entry_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'accepted');

-- Rechazar o salirse (la persona etiquetada) y quitar a alguien (la autora) es borrar la fila.
create policy participants_delete on public.entry_participants
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.entries e where e.id = entry_id and e.author_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------------------------- diario

-- Las entradas de un diario: las que escribió esa persona y aquellas donde está etiquetada y lo aceptó.
-- SECURITY INVOKER: la RLS de entries decide qué filas ve quien mira. `shared` marca las ajenas («con @autora»).
create view public.diary_items with (security_invoker = true) as
select
  e.id, e.author_id, e.recipe_id, e.visibility, e.title, e.body, e.cooked_on, e.published_at, e.tags, e.created_at,
  d.owner as diary_owner,
  (e.author_id <> d.owner) as shared,
  a.username as author_username,
  a.display_name as author_display_name
from public.entries e
cross join lateral (
  select e.author_id as owner
  union all
  select p.user_id from public.entry_participants p where p.entry_id = e.id and p.status = 'accepted'
) d
join public.profiles a on a.id = e.author_id
where e.status = 'published';

revoke all on public.diary_items from anon, authenticated;
grant select on public.diary_items to authenticated;

-- ---------------------------------------------------------------------------------------------- recetas

-- Veces que se ha cocinado una receta y por cuántas personas, SOLO contando lo que quien llama puede leer
-- (SECURITY INVOKER: no cuenta borradores, ni entradas privadas, ni de quien no sigue). Las personas etiquetadas no
-- cuentan como personas: solo las autoras.
create function public.recipe_stats(rid uuid) returns table (times bigint, people bigint)
language sql stable security invoker set search_path = ''
as $$
  select count(*), count(distinct e.author_id)
  from public.entries e
  where e.recipe_id = rid and e.status = 'published'
$$;

-- «Guardar para cocinar»: un borrador privado que ENLAZA la receta (no la copia). Idempotente: si ya la tenías
-- guardada devuelve ese borrador. La RLS de entries impide guardar una receta que no ves.
create function public.save_as_draft(rid uuid) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  did uuid;
begin
  insert into public.entries (author_id, recipe_id, status, visibility, body, tags, position)
  values (me, rid, 'draft', 'private', '', '{}', (extract(epoch from clock_timestamp()) * 1000)::float8)
  on conflict (author_id, recipe_id) where status = 'draft' do nothing
  returning id into did;

  if did is null then
    select id into did from public.entries where author_id = me and recipe_id = rid and status = 'draft';
  end if;
  return did;
end;
$$;

revoke execute on function public.recipe_stats(uuid), public.save_as_draft(uuid) from public, anon;
grant execute on function public.recipe_stats(uuid), public.save_as_draft(uuid) to authenticated;
