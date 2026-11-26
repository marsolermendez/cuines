-- Social (Fase 4): seguir, feed, likes, comentarios y moderación.
-- Sustituye el stub de is_follower de la Fase 2 por la tabla real de seguidores: a partir de aquí «solo seguidores»
-- y las entradas públicas de diarios privados las ven quienes siguen a la autora (con la solicitud aceptada).

-- ---------------------------------------------------------------------------------------------- tablas

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee on public.follows (followee_id, status);

create table public.likes (
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000 and btrim(body) <> ''),
  created_at timestamptz not null default now()
);
create index comments_entry on public.comments (entry_id, created_at);

-- Un comentario reportado que luego se borra se lleva su reporte (cascade): la revisión se hace desde el panel
-- de Supabase y, si el comentario ya no existe, no hay nada que moderar.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (reporter_id, comment_id)
);

-- ---------------------------------------------------------------------------------------------- triggers

-- El estado de un seguimiento lo decide el servidor: pendiente si el diario es privado, aceptado si no.
-- El cliente no tiene permiso de escritura sobre status al insertar, así que no puede autoaceptarse.
create function public.follows_set_status() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.status := case when public.is_private(new.followee_id) then 'pending' else 'accepted' end;
  return new;
end;
$$;

create trigger follows_set_status before insert on public.follows
  for each row execute function public.follows_set_status();

-- Si un diario pasa a público, las solicitudes pendientes dejan de tener sentido: se aceptan.
create function public.profiles_accept_pending() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted' where followee_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;

revoke execute on function public.profiles_accept_pending() from public, anon, authenticated;

create trigger profiles_accept_pending after update of is_private on public.profiles
  for each row execute function public.profiles_accept_pending();

-- ---------------------------------------------------------------------------------------------- is_follower real

create or replace function public.is_follower(uid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.follows
    where follower_id = (select auth.uid()) and followee_id = uid and status = 'accepted'
  )
$$;

-- ---------------------------------------------------------------------------------------------- privilegios y RLS

alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;

revoke all on public.follows, public.likes, public.comments, public.reports from anon, authenticated;

grant select, delete on public.follows to authenticated;
grant insert (follower_id, followee_id) on public.follows to authenticated;
grant update (status) on public.follows to authenticated;

grant select, delete on public.likes to authenticated;
grant insert (entry_id, user_id) on public.likes to authenticated;

-- Los comentarios no se editan: se borran y se vuelven a escribir.
grant select, delete on public.comments to authenticated;
grant insert (id, entry_id, author_id, body) on public.comments to authenticated;

grant select on public.reports to authenticated;
grant insert (reporter_id, comment_id, reason) on public.reports to authenticated;

-- follows: solo lo ven las dos partes. Quien sigue crea y borra (dejar de seguir, cancelar la solicitud);
-- quien es seguida acepta (y solo puede dejarlo en 'accepted') o rechaza borrando.
create policy follows_select on public.follows
  for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

create policy follows_insert_own on public.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));

create policy follows_accept on public.follows
  for update to authenticated
  using (followee_id = (select auth.uid()))
  with check (followee_id = (select auth.uid()) and status = 'accepted');

create policy follows_delete on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

-- likes y comments heredan la privacidad de la entrada: la subconsulta pasa por la RLS de entries, así que solo
-- se lee, se da like o se comenta lo que ya puedes leer. Los borradores no admiten ni una cosa ni otra.
create policy likes_select on public.likes
  for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));

create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.status = 'published')
  );

create policy likes_delete_own on public.likes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy comments_select on public.comments
  for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));

create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.status = 'published')
  );

-- Borra quien lo escribió o la autora de la entrada (moderación de su propio diario).
create policy comments_delete on public.comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.entries e where e.id = entry_id and e.author_id = (select auth.uid()))
  );

-- reports: cada persona solo ve los suyos y solo puede reportar comentarios que ve. El estado lo cambia quien
-- modera desde el panel de Supabase, no la interfaz.
create policy reports_select_own on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_id)
  );

-- ---------------------------------------------------------------------------------------------- feed

-- Entradas publicadas de las personas a las que sigo (con solicitud aceptada), de la más reciente a la más antigua.
-- SECURITY INVOKER: la RLS de entries sigue decidiendo qué puedo leer de cada una.
create function public.feed(p_before timestamptz default null, p_limit int default 20) returns setof public.entries
language sql stable security invoker set search_path = ''
as $$
  select e.*
  from public.entries e
  where e.status = 'published'
    and e.author_id in (
      select f.followee_id from public.follows f
      where f.follower_id = (select auth.uid()) and f.status = 'accepted'
    )
    and (p_before is null or e.published_at < p_before)
  order by e.published_at desc
  limit least(greatest(p_limit, 1), 50)
$$;

revoke execute on function public.feed(timestamptz, int) from public, anon;
grant execute on function public.feed(timestamptz, int) to authenticated;
