-- Lista de acceso: solo los correos de esta tabla pueden CREAR una cuenta en Cuines.
-- Es independiente de Google: aunque la pantalla de consentimiento esté publicada, quien no figure aquí no se registra.
--
-- Qué NO hace: no echa a quien ya tiene cuenta (el trigger es solo de alta). Para cerrar el acceso a alguien que ya
-- entró, además de quitarlo de aquí hay que borrarlo o bloquearlo en Supabase (Authentication → Users).
--
-- Los correos reales NO van en ninguna migración (el repositorio es público): se cargan aparte desde el panel de
-- Supabase o con SQL. Ver el README.

create table public.allowed_emails (
  -- siempre en minúsculas y sin espacios; así la comparación es exacta
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

-- Sin políticas y sin privilegios para la API: nadie la lee ni la escribe desde la web (ni siquiera con sesión).
-- Se gestiona solo desde el panel de Supabase o con SQL de administración.
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

-- ¿Este correo tiene acceso? Es SECURITY DEFINER porque allowed_emails no la puede leer ningún otro rol. Nadie la
-- ejecuta desde la API: solo la llama el trigger de abajo (y los tests).
create function public.email_has_access(addr text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.allowed_emails where email = lower(btrim(coalesce(addr, '')))) $$;

revoke execute on function public.email_has_access(text) from public, anon, authenticated;

-- Se filtran las altas que hace el servicio de Auth (el login con Google): su conexión es la del rol
-- supabase_auth_admin. Lo que inserta quien administra la base de datos (migraciones, tests, SQL del panel) no pasa
-- por este filtro.
create function public.auth_signup_allowlist() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if session_user = 'supabase_auth_admin' and not public.email_has_access(new.email) then
    raise exception 'Este correo no tiene acceso a Cuines' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.auth_signup_allowlist() from public, anon, authenticated;

-- BEFORE INSERT: se rechaza antes de que exista el usuario (y antes de que handle_new_user le cree el perfil).
create trigger auth_signup_allowlist before insert on auth.users
  for each row execute function public.auth_signup_allowlist();
