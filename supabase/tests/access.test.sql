-- Lista de acceso (allowed_emails): solo los correos de la tabla pueden crear una cuenta por el servicio de Auth.
-- Ejecutar: npm run db:test
--
-- Aquí se prueba la decisión (`email_has_access`), el formato de la tabla, sus permisos y la forma del trigger.
-- El rechazo real lo dispara la conexión del servicio de Auth (rol supabase_auth_admin), que estos tests no pueden
-- suplantar: ese cableado se comprueba contra el Auth real (ver el README).
begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- La tabla no se toca desde la API: ni sin sesión ni con ella.
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok($$select * from public.allowed_emails$$, '42501', null, 'anon no puede leer la lista');

reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.allowed_emails$$, '42501', null, 'una persona con sesión tampoco puede leer la lista');
select throws_ok($$insert into public.allowed_emails (email) values ('yo@pgtap.test')$$, '42501', null, 'ni añadirse a sí misma');
select throws_ok($$delete from public.allowed_emails$$, '42501', null, 'ni borrar entradas');

-- Formato de la lista (como administración).
reset role;
select throws_ok($$insert into public.allowed_emails (email) values ('Mayus@pgtap.test')$$, '23514', null,
  'los correos se guardan en minúsculas');
select throws_ok($$insert into public.allowed_emails (email) values ('sin-arroba')$$, '23514', null, 'tiene que parecer un correo');
select throws_ok($$insert into public.allowed_emails (email) values (' espacios@pgtap.test')$$, '23514', null, 'sin espacios');

insert into public.allowed_emails (email, note) values ('permitido@pgtap.test', 'test');

-- La decisión.
select ok(public.email_has_access('permitido@pgtap.test'), 'un correo de la lista tiene acceso');
select ok(public.email_has_access('  Permitido@PGTAP.test '), 'sin distinguir mayúsculas ni espacios alrededor');
select ok(not public.email_has_access('intruso@pgtap.test'), 'un correo que no está en la lista no tiene acceso');
select ok(not public.email_has_access(null), 'sin correo tampoco');
select ok(not public.email_has_access('permitido@pgtap.test.otro.com'), 'el correo tiene que coincidir entero, no por prefijo');
select ok(not public.email_has_access(''), 'ni vacío');

-- El trigger: antes del alta, por fila, solo en inserciones (quien ya tiene cuenta no se ve afectada).
select has_trigger('auth', 'users', 'auth_signup_allowlist', 'auth.users tiene el trigger de la lista de acceso');
select is((select tgtype & 31 from pg_trigger where tgname = 'auth_signup_allowlist'), 7,
  'es BEFORE INSERT FOR EACH ROW y nada más');

-- La función de decisión no se llama desde la API.
select ok(not has_function_privilege('anon', 'public.email_has_access(text)', 'execute'), 'anon no puede ejecutarla');
select ok(not has_function_privilege('authenticated', 'public.email_has_access(text)', 'execute'),
  'una persona con sesión tampoco: así no se puede sondear quién tiene acceso');

-- Quien administra la base de datos (migraciones, tests, SQL del panel) no pasa por el filtro.
select lives_ok($$insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-00000000a005', 'admin@pgtap.test')$$,
  'SQL de administración puede crear usuarios sin estar en la lista');

select * from finish();
rollback;
