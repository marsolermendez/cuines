-- Tests de privacidad (pgTAP). Se amplía en cada fase. Ejecutar: npm run db:test
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

-- Dos usuarios de prueba; el trigger crea sus perfiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local',
   '{"full_name": "Ana", "picture": "https://example.com/ana.jpg"}'),
  ('22222222-2222-2222-2222-222222222222', 'bea@test.local', '{}');

-- Trigger de alta
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana', 'el perfil nace con el nombre de Google');
select is((select avatar_url from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'https://example.com/ana.jpg', 'el perfil nace con la foto de Google');
select ok((select username is null from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'el username queda vacío hasta el onboarding');

-- Anónimo: sin acceso
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon no puede leer perfiles');

-- Ana (usuaria autenticada)
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.profiles), 2, 'una persona autenticada ve todos los perfiles');

select lives_ok($$update public.profiles set bio = 'Hola', username = 'ana_cocina' where id = '11111111-1111-1111-1111-111111111111'$$,
  'puedo editar mi propio perfil');

update public.profiles set bio = 'hackeado' where id = '22222222-2222-2222-2222-222222222222';
select is((select bio from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '', 'no puedo editar el perfil de otra persona (0 filas afectadas)');

select throws_ok($$update public.profiles set id = '33333333-3333-3333-3333-333333333333' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'no puedo cambiar mi id');

select throws_ok($$update public.profiles set username = 'Nombre Malo!' where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514', null, 'el username respeta el formato');

select throws_ok($$update public.profiles set avatar_url = 'javascript:alert(1)' where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514', null, 'la foto solo admite http(s)');

select throws_ok($$insert into public.profiles (id) values ('44444444-4444-4444-4444-444444444444')$$,
  '42501', null, 'no puedo crear perfiles desde el cliente');

select throws_ok($$delete from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'no puedo borrar perfiles desde el cliente');

-- Bea no puede quedarse con el username de Ana
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select throws_ok($$update public.profiles set username = 'ana_cocina' where id = '22222222-2222-2222-2222-222222222222'$$,
  '23505', null, 'el username es único');

select * from finish();
rollback;
