-- Datos de prueba para `npm run db:reset`. Se irán añadiendo con cada fase.

-- Cuentas de prueba del Supabase local: pueden registrarse (email y contraseña) aunque exista la lista de acceso.
-- Son correos inventados; los reales se cargan a mano y no se versionan.
insert into public.allowed_emails (email, note) values
  ('diario@test.local', 'prueba local'),
  ('otra@test.local', 'prueba local'),
  ('cai@test.local', 'prueba local')
on conflict (email) do nothing;
