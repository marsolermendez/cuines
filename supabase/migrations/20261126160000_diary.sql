-- Diario (Fase 2): recetas, entradas, fotos y su privacidad.
-- La privacidad vive aquí, no en la interfaz: un borrador o una entrada privada no los lee nadie más que su autor.

-- ---------------------------------------------------------------------------------------------- tablas

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  -- quien la creó y la única persona que la edita
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  source_url text check (source_url ~ '^https?://' and char_length(source_url) <= 500),
  ingredients text[] not null default '{}'
    check (cardinality(ingredients) <= 100 and char_length(array_to_string(ingredients, E'\n')) <= 10000),
  steps text[] not null default '{}'
    check (cardinality(steps) <= 100 and char_length(array_to_string(steps, E'\n')) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- NO ACTION (no RESTRICT): no se borra una receta con entradas, pero un borrado de cuenta en cascada sí puede
  -- llevarse a la vez las entradas y sus recetas.
  recipe_id uuid not null references public.recipes (id),
  status text not null check (status in ('draft', 'published')),
  visibility text not null default 'private' check (visibility in ('public', 'followers', 'private')),
  title text check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 20000),
  cooked_on date,
  planned_for date,
  published_at timestamptz,
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  position float8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un borrador es siempre privado y sin fecha de cocinado; una entrada publicada tiene fecha y título.
  constraint entries_status_shape check (
    (status = 'draft' and cooked_on is null and visibility = 'private')
    or (status = 'published' and cooked_on is not null and title is not null and planned_for is null)
  )
);

-- Un solo borrador por receta y persona (guardar dos veces es idempotente).
create unique index entries_one_draft_per_recipe on public.entries (author_id, recipe_id) where status = 'draft';
create index entries_diary on public.entries (author_id, cooked_on desc) where status = 'published';
create index entries_recipe on public.entries (recipe_id);

create table public.entry_photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  -- 0..9 y único por entrada: máximo 10 fotos, garantizado por la base de datos
  position smallint not null check (position between 0 and 9),
  path text not null check (char_length(path) <= 200),
  thumb_path text not null check (char_length(thumb_path) <= 200),
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  -- miniatura de 16 px para el desenfoque mientras carga la foto
  placeholder text not null check (placeholder ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' and char_length(placeholder) <= 3000),
  unique (entry_id, position)
);

-- ---------------------------------------------------------------------------------------------- triggers

create function public.recipes_touch() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recipes_touch before update on public.recipes
  for each row execute function public.recipes_touch();

-- published_at lo fija el servidor: el cliente no puede falsear cuándo se publicó (no tiene permiso de escritura).
create function public.entries_touch() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'draft' then
    new.published_at := null;
  elsif tg_op = 'INSERT' or old.status = 'draft' then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger entries_touch before insert or update on public.entries
  for each row execute function public.entries_touch();

-- ---------------------------------------------------------------------------------------------- ayudantes de privacidad
-- is_* son SECURITY DEFINER: leen otras tablas sin pasar por su RLS (evita recursión entre políticas).

create function public.is_private(uid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select is_private from public.profiles where id = uid), true) $$;

-- Fase 4 sustituye is_follower (tabla follows) y la Fase 5 is_participant (tabla entry_participants).
-- Mientras tanto devuelven false: lo "solo seguidores" solo lo ve su autor (falla cerrado).
create function public.is_follower(uid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select false $$;

create function public.is_participant(eid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select false $$;

-- La única definición de "quién puede leer una entrada". La usan la política de entries y la de recipes.
create function public.can_read_entry(eid uuid, eauthor uuid, estatus text, evisibility text) returns boolean
language sql stable set search_path = ''
as $$
  select eauthor = (select auth.uid())
    or public.is_participant(eid)
    or (estatus = 'published' and (
         (evisibility = 'public' and (not public.is_private(eauthor) or public.is_follower(eauthor)))
      or (evisibility = 'followers' and public.is_follower(eauthor))))
$$;

-- "Esta receta tiene alguna entrada que puedo leer". SECURITY DEFINER para que la política de recipes no
-- consulte entries a través de su RLS (entries ya consulta recipes al insertar: sería recursión infinita).
create function public.recipe_has_readable_entry(rid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.entries e
    where e.recipe_id = rid and public.can_read_entry(e.id, e.author_id, e.status, e.visibility)
  )
$$;

revoke execute on function
  public.is_private(uuid), public.is_follower(uuid), public.is_participant(uuid),
  public.can_read_entry(uuid, uuid, text, text), public.recipe_has_readable_entry(uuid)
  from public, anon;
grant execute on function
  public.is_private(uuid), public.is_follower(uuid), public.is_participant(uuid),
  public.can_read_entry(uuid, uuid, text, text), public.recipe_has_readable_entry(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------------------------- privilegios y RLS

alter table public.recipes enable row level security;
alter table public.entries enable row level security;
alter table public.entry_photos enable row level security;

revoke all on public.recipes, public.entries, public.entry_photos from anon, authenticated;

-- Sin permiso sobre author_id/owner_id (inmutables), published_at, created_at ni recipe_id (una entrada no cambia de receta).
grant select, delete on public.recipes to authenticated;
grant insert (id, owner_id, title, source_url, ingredients, steps) on public.recipes to authenticated;
grant update (title, source_url, ingredients, steps) on public.recipes to authenticated;

grant select, delete on public.entries to authenticated;
grant insert (id, author_id, recipe_id, status, visibility, title, body, cooked_on, planned_for, tags, position)
  on public.entries to authenticated;
grant update (status, visibility, title, body, cooked_on, planned_for, tags, position) on public.entries to authenticated;

-- Las fotos no se editan: se añaden o se borran.
grant select, insert, delete on public.entry_photos to authenticated;

-- recipes: la ves si es tuya o si alguna entrada que puedes leer la usa. Solo su creadora la escribe.
create policy recipes_select on public.recipes
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.recipe_has_readable_entry(id));

create policy recipes_insert_own on public.recipes
  for insert to authenticated with check (owner_id = (select auth.uid()));

create policy recipes_update_own on public.recipes
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy recipes_delete_own on public.recipes
  for delete to authenticated using (owner_id = (select auth.uid()));

-- entries
create policy entries_select on public.entries
  for select to authenticated using (public.can_read_entry(id, author_id, status, visibility));

-- Solo se enlaza una receta que ya puedes ver (la RLS de recipes decide).
create policy entries_insert_own on public.entries
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id)
  );

create policy entries_update_own on public.entries
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

create policy entries_delete_own on public.entries
  for delete to authenticated using (author_id = (select auth.uid()));

-- entry_photos: se leen si puedes leer la entrada (la RLS de entries decide); solo su autora las escribe.
create policy entry_photos_select on public.entry_photos
  for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));

-- Las rutas tienen que colgar de {autora}/{entrada}/: si no, una entrada propia podría apuntar a la foto privada
-- de otra persona y heredar su lectura en Storage.
create policy entry_photos_insert_own on public.entry_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id
        and e.author_id = (select auth.uid())
        and path like e.author_id::text || '/' || e.id::text || '/%'
        and thumb_path like e.author_id::text || '/' || e.id::text || '/%'
    )
  );

create policy entry_photos_delete_own on public.entry_photos
  for delete to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id and e.author_id = (select auth.uid())));

-- ---------------------------------------------------------------------------------------------- Storage

-- Bucket PRIVADO: una foto de un borrador o de una entrada privada no se puede servir por URL pública.
-- Se lee con URLs firmadas, y solo si la fila de entry_photos es visible para ti.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.entry_photos p where p.path = objects.name or p.thumb_path = objects.name)
    )
  );

-- Cada persona escribe y borra solo en su carpeta {uid}/. Los archivos no se sobrescriben (nombres únicos).
create policy photos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
