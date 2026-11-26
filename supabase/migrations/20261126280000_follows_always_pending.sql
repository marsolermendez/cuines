-- Seguir a alguien siempre necesita su aprobación, también en un diario público.
-- Antes un diario público aceptaba al instante; ahora toda solicitud nace `pending` y solo la persona seguida la
-- pasa a `accepted` (la política follows_accept no cambia). `profiles.is_private` sigue decidiendo si las entradas
-- «públicas» las lee cualquiera o solo quien te sigue.
-- Los seguimientos ya aceptados se quedan como están.

create or replace function public.follows_set_status() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.status := 'pending';
  return new;
end;
$$;

-- Hacer público el diario ya no aprueba solicitudes pendientes: cada una la decide la persona seguida.
drop trigger profiles_accept_pending on public.profiles;
drop function public.profiles_accept_pending();
