-- Perfiles de Cuines: una fila por usuario de auth.users. Perfil = diario (un diario por usuario).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- null hasta que la persona lo elige en el onboarding
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 280),
  avatar_url text check (avatar_url ~ '^https?://' and char_length(avatar_url) <= 500),
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Privilegios mínimos, además de la RLS: sin acceso anónimo, sin insert ni delete desde el cliente
-- (el alta la hace el trigger y el borrado llega en cascada desde auth.users) y sin tocar id/created_at.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url, is_private) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Al crearse un usuario (login con Google) se crea su perfil con el nombre y la foto de Google.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pic text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 60),
    case when pic ~ '^https?://' and char_length(pic) <= 500 then pic end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Avatares: bucket público (la foto de perfil es pública). Cada persona solo escribe en su carpeta {uid}/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy avatars_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
