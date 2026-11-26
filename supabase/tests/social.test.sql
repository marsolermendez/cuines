-- Privacidad social (Fase 4): seguir, feed, likes, comentarios y reportes. Ejecutar: npm run db:test
-- Actores: Ana (diario público), Bea (sin relación al principio), Cai (diario PRIVADO) y Dan.
begin;

create extension if not exists pgtap with schema extensions;

select plan(76);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@pgtap.test'),
  ('22222222-2222-2222-2222-222222222222', 'bea@pgtap.test'),
  ('33333333-3333-3333-3333-333333333333', 'cai@pgtap.test'),
  ('44444444-4444-4444-4444-444444444444', 'dan@pgtap.test');
update public.profiles set is_private = true where id = '33333333-3333-3333-3333-333333333333';

-- ===================================================================== Ana y Cai publican
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$
  insert into public.recipes (id, owner_id, title) values
    ('cccccccc-4444-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'R pública'),
    ('cccccccc-4444-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'R seguidores'),
    ('cccccccc-4444-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'R privada'),
    ('cccccccc-4444-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'R borrador');
  insert into public.entries (id, author_id, recipe_id, status, visibility, title, cooked_on) values
    ('eeeeeeee-4444-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cccccccc-4444-0000-0000-000000000001', 'published', 'public', 'Pública', '2026-11-01'),
    ('eeeeeeee-4444-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cccccccc-4444-0000-0000-000000000002', 'published', 'followers', 'Seguidores', '2026-11-02'),
    ('eeeeeeee-4444-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-4444-0000-0000-000000000003', 'published', 'private', 'Privada', '2026-11-03');
  insert into public.entries (id, author_id, recipe_id, status, visibility)
    values ('eeeeeeee-4444-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cccccccc-4444-0000-0000-000000000004', 'draft', 'private')
$$, 'Ana publica una entrada pública, una de seguidores, una privada y tiene un borrador');

reset role;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$
  insert into public.recipes (id, owner_id, title) values ('cccccccc-4444-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'R de Cai');
  insert into public.entries (id, author_id, recipe_id, status, visibility, title, cooked_on)
    values ('eeeeeeee-4444-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'cccccccc-4444-0000-0000-000000000005', 'published', 'public', 'Pública de Cai', '2026-11-04')
$$, 'Cai publica una entrada pública en su diario privado');

-- published_at lo pone el servidor con now(), igual para todo el test: se fija a mano para poder comprobar el orden.
reset role;
update public.entries set published_at = '2026-11-01 10:00+00' where id = 'eeeeeeee-4444-0000-0000-000000000001';
update public.entries set published_at = '2026-11-02 10:00+00' where id = 'eeeeeeee-4444-0000-0000-000000000002';
update public.entries set published_at = '2026-11-03 10:00+00' where id = 'eeeeeeee-4444-0000-0000-000000000003';
update public.entries set published_at = '2026-11-04 10:00+00' where id = 'eeeeeeee-4444-0000-0000-000000000005';

-- ===================================================================== Bea empieza a seguir
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id::text like 'eeeeeeee-4444%'), 1,
  'sin seguir a nadie, Bea solo ve la entrada pública de Ana');

select lives_ok($$insert into public.follows (follower_id, followee_id) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'Bea sigue a Ana');
select is((select status from public.follows where followee_id = '11111111-1111-1111-1111-111111111111'), 'pending',
  'seguir un diario público también queda pendiente de aprobación');
select lives_ok($$insert into public.follows (follower_id, followee_id) values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')$$,
  'Bea solicita seguir a Cai');
select is((select status from public.follows where followee_id = '33333333-3333-3333-3333-333333333333'), 'pending',
  'seguir un diario privado queda pendiente de aprobación');

select throws_ok($$insert into public.follows (follower_id, followee_id, status) values ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'accepted')$$,
  '42501', null, 'no puedo elegir el estado de mi seguimiento');
select throws_ok($$insert into public.follows (follower_id, followee_id) values ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222')$$,
  '23514', null, 'no puedo seguirme a mí misma');
select throws_ok($$insert into public.follows (follower_id, followee_id) values ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999')$$,
  '23503', null, 'no se puede seguir a alguien que no existe');

select is((select count(*)::int from public.entries where id::text like 'eeeeeeee-4444%'), 1,
  'con la solicitud pendiente, Bea sigue viendo solo la entrada pública de Ana');
select is_empty($$select 1 from public.feed()$$, 'y su feed está vacío hasta que Ana acepte');

-- ===================================================================== Ana acepta a Bea
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$update public.follows set status = 'accepted' where follower_id = '22222222-2222-2222-2222-222222222222' and followee_id = '11111111-1111-1111-1111-111111111111'$$,
  'Ana acepta la solicitud de Bea');

reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id = 'eeeeeeee-4444-0000-0000-000000000005'), 0,
  'una solicitud pendiente no da acceso al diario privado');
select is((select array_agg(id::text order by id) from public.entries where id::text like 'eeeeeeee-4444%'),
  array['eeeeeeee-4444-0000-0000-000000000001', 'eeeeeeee-4444-0000-0000-000000000002'],
  'siguiendo a Ana, Bea ve su entrada pública y la de seguidores, pero no la privada ni el borrador');
select is(array(select id::text from public.feed()),
  array['eeeeeeee-4444-0000-0000-000000000002', 'eeeeeeee-4444-0000-0000-000000000001'],
  'el feed trae las entradas de a quien sigo, de la más reciente a la más antigua');
select is((select count(*)::int from public.feed(p_limit => 1)), 1, 'el feed respeta el límite');
select is(array(select id::text from public.feed(p_before => '2026-11-02 10:00+00')),
  array['eeeeeeee-4444-0000-0000-000000000001'], 'el feed pagina con p_before');

select is_empty($$update public.follows set status = 'accepted'
  where follower_id = '22222222-2222-2222-2222-222222222222' and followee_id = '33333333-3333-3333-3333-333333333333' returning follower_id$$,
  'Bea no puede aceptarse a sí misma una solicitud');

-- ===================================================================== Dan también solicita seguir a Cai
reset role;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.follows (follower_id, followee_id) values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333')$$,
  'Dan solicita seguir a Cai');
select is((select status from public.follows where follower_id = '44444444-4444-4444-4444-444444444444'), 'pending',
  'la solicitud de Dan queda pendiente');

-- ===================================================================== Ana (tercera persona)
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.follows), 1, 'Ana solo ve los seguimientos en los que participa');
select is_empty($$delete from public.follows where follower_id = '22222222-2222-2222-2222-222222222222' and followee_id = '33333333-3333-3333-3333-333333333333' returning follower_id$$,
  'Ana no puede borrar el seguimiento de otras dos personas');
select is_empty($$update public.follows set status = 'accepted' where follower_id = '44444444-4444-4444-4444-444444444444' returning follower_id$$,
  'Ana no puede aceptar una solicitud dirigida a Cai');

-- ===================================================================== Cai acepta a Bea
reset role;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.follows where followee_id = '33333333-3333-3333-3333-333333333333' and status = 'pending'), 2,
  'Cai ve sus dos solicitudes pendientes');
select lives_ok($$update public.follows set status = 'accepted' where follower_id = '22222222-2222-2222-2222-222222222222' and followee_id = '33333333-3333-3333-3333-333333333333'$$,
  'Cai acepta la solicitud de Bea');
select throws_ok($$update public.follows set status = 'pending' where follower_id = '22222222-2222-2222-2222-222222222222' and followee_id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'la aceptación solo puede dejar el estado en accepted');

-- ===================================================================== Bea: ya sigue a Cai; likes y comentarios
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id = 'eeeeeeee-4444-0000-0000-000000000005'), 1,
  'con la solicitud aceptada, Bea ve la entrada del diario privado');
select is(array(select id::text from public.feed()),
  array['eeeeeeee-4444-0000-0000-000000000005', 'eeeeeeee-4444-0000-0000-000000000002', 'eeeeeeee-4444-0000-0000-000000000001'],
  'el feed mezcla a las dos personas por fecha');

select lives_ok($$insert into public.likes (entry_id, user_id) values ('eeeeeeee-4444-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')$$,
  'Bea da like a una entrada que ve');
select throws_ok($$insert into public.likes (entry_id, user_id) values ('eeeeeeee-4444-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')$$,
  '23505', null, 'no se puede dar like dos veces');
select throws_ok($$insert into public.likes (entry_id, user_id) values ('eeeeeeee-4444-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'no puedo dar like a una entrada que no veo');
select throws_ok($$insert into public.likes (entry_id, user_id) values ('eeeeeeee-4444-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'no puedo dar like en nombre de otra persona');
select lives_ok($$insert into public.likes (entry_id, user_id) values ('eeeeeeee-4444-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222')$$,
  'Bea da like a la entrada de seguidores de Ana');

select lives_ok($$insert into public.comments (id, entry_id, author_id, body) values
  ('bbbbbbbb-4444-0000-0000-000000000001', 'eeeeeeee-4444-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Qué buena pinta')$$,
  'Bea comenta una entrada que ve');
select throws_ok($$insert into public.comments (entry_id, author_id, body) values ('eeeeeeee-4444-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'hola')$$,
  '42501', null, 'no puedo comentar una entrada que no veo');
select throws_ok($$insert into public.comments (entry_id, author_id, body) values ('eeeeeeee-4444-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'suplanto')$$,
  '42501', null, 'no puedo comentar en nombre de otra persona');
select throws_ok($$insert into public.comments (entry_id, author_id, body) values ('eeeeeeee-4444-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '')$$,
  '23514', null, 'un comentario no puede estar vacío');
select throws_ok($$insert into public.comments (entry_id, author_id, body) values ('eeeeeeee-4444-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', repeat('x', 1001))$$,
  '23514', null, 'un comentario admite 1000 caracteres como máximo');
select throws_ok($$insert into public.comments (entry_id, author_id, body) values ('eeeeeeee-4444-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '   ')$$,
  '23514', null, 'un comentario no puede ser solo espacios');
select throws_ok($$update public.comments set body = 'editado' where id = 'bbbbbbbb-4444-0000-0000-000000000001'$$,
  '42501', null, 'los comentarios no se editan');

-- ===================================================================== Ana: lo suyo
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.likes where entry_id = 'eeeeeeee-4444-0000-0000-000000000001'), 1,
  'Ana ve el like de Bea en su entrada');
select lives_ok($$insert into public.comments (id, entry_id, author_id, body) values
  ('bbbbbbbb-4444-0000-0000-000000000002', 'eeeeeeee-4444-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Gracias')$$,
  'Ana comenta en su propia entrada');
select lives_ok($$insert into public.comments (id, entry_id, author_id, body) values
  ('bbbbbbbb-4444-0000-0000-000000000003', 'eeeeeeee-4444-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Nota para mí')$$,
  'Ana comenta en su entrada privada');
select lives_ok($$insert into public.likes (entry_id, user_id) values ('eeeeeeee-4444-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111')$$,
  'Ana da like a su propia entrada');
select throws_ok($$insert into public.likes (entry_id, user_id) values ('eeeeeeee-4444-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'un borrador no admite likes');
select throws_ok($$insert into public.comments (entry_id, author_id, body) values ('eeeeeeee-4444-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'nota')$$,
  '42501', null, 'un borrador no admite comentarios');
select is((select count(*)::int from public.comments where entry_id = 'eeeeeeee-4444-0000-0000-000000000001'), 2,
  'Ana ve los dos comentarios de su entrada');

-- ===================================================================== Cai: no sigue a Ana, pero ve su entrada pública
reset role;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.comments where entry_id = 'eeeeeeee-4444-0000-0000-000000000001'), 2,
  'Cai ve los comentarios de una entrada pública');
select is((select count(*)::int from public.likes where entry_id = 'eeeeeeee-4444-0000-0000-000000000002'), 0,
  'Cai no ve los likes de una entrada que no puede leer');

select lives_ok($$insert into public.reports (reporter_id, comment_id, reason) values ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-4444-0000-0000-000000000001', 'spam')$$,
  'Cai reporta un comentario');
select throws_ok($$insert into public.reports (reporter_id, comment_id, reason) values ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-4444-0000-0000-000000000001', 'otra vez')$$,
  '23505', null, 'no se reporta dos veces el mismo comentario');
select is((select count(*)::int from public.reports), 1, 'Cai ve su propio reporte');
select throws_ok($$insert into public.reports (reporter_id, comment_id, reason) values ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-4444-0000-0000-000000000003', 'x')$$,
  '42501', null, 'no puedo reportar un comentario que no veo');
select throws_ok($$insert into public.reports (reporter_id, comment_id, reason) values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-4444-0000-0000-000000000002', 'x')$$,
  '42501', null, 'no puedo reportar en nombre de otra persona');
select throws_ok($$update public.reports set status = 'resolved'$$, '42501', null, 'no puedo cambiar el estado de un reporte');
select is_empty($$delete from public.comments where id = 'bbbbbbbb-4444-0000-0000-000000000001' returning id$$,
  'Cai no puede borrar un comentario ajeno en una entrada ajena');

-- ===================================================================== Bea: lo que no es suyo
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.reports), 0, 'Bea no ve los reportes de Cai');
select is_empty($$delete from public.comments where id = 'bbbbbbbb-4444-0000-0000-000000000002' returning id$$,
  'Bea no puede borrar el comentario de Ana');
select is((select count(*)::int from public.comments where entry_id = 'eeeeeeee-4444-0000-0000-000000000003'), 0,
  'Bea no ve los comentarios de una entrada privada');
select lives_ok($$delete from public.likes where entry_id = 'eeeeeeee-4444-0000-0000-000000000002' and user_id = '22222222-2222-2222-2222-222222222222'$$,
  'Bea quita su like');
select is((select count(*)::int from public.likes where entry_id = 'eeeeeeee-4444-0000-0000-000000000002'), 0, 'el like quitado ya no está');
select is_empty($$delete from public.likes where entry_id = 'eeeeeeee-4444-0000-0000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111' returning user_id$$,
  'Bea no puede quitar el like de Ana');

-- ===================================================================== Ana modera su entrada
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$delete from public.comments where id = 'bbbbbbbb-4444-0000-0000-000000000001'$$,
  'Ana borra un comentario ajeno en su propia entrada');
select is((select count(*)::int from public.comments where id = 'bbbbbbbb-4444-0000-0000-000000000001'), 0, 'el comentario borrado ya no está');

-- ===================================================================== Bea deja de seguir a Ana
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$delete from public.follows where follower_id = '22222222-2222-2222-2222-222222222222' and followee_id = '11111111-1111-1111-1111-111111111111'$$,
  'Bea deja de seguir a Ana');
select is((select count(*)::int from public.entries where id = 'eeeeeeee-4444-0000-0000-000000000002'), 0,
  'al dejar de seguir, la entrada de seguidores vuelve a ser invisible');
select is(array(select id::text from public.feed()), array['eeeeeeee-4444-0000-0000-000000000005'],
  'y el feed solo trae a quien sigo todavía');

-- ===================================================================== Cai hace público su diario
reset role;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$update public.profiles set is_private = false where id = '33333333-3333-3333-3333-333333333333'$$,
  'Cai pasa su diario a público');

reset role;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
set local role authenticated;

select is((select status from public.follows where follower_id = '44444444-4444-4444-4444-444444444444'), 'pending',
  'al hacerse público, las solicitudes pendientes siguen esperando a Cai');
select is((select count(*)::int from public.entries where id = 'eeeeeeee-4444-0000-0000-000000000005'), 1,
  'Dan ve la entrada pública de Cai porque su diario ya es público, no porque la solicitud se aceptara');
select is_empty($$select 1 from public.feed()$$, 'pero no le llega a su feed hasta que Cai la acepte');

-- ===================================================================== anónimo
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select throws_ok($$select * from public.follows$$, '42501', null, 'anon no puede leer seguimientos');
select throws_ok($$select * from public.likes$$, '42501', null, 'anon no puede leer likes');
select throws_ok($$select * from public.comments$$, '42501', null, 'anon no puede leer comentarios');
select throws_ok($$select * from public.reports$$, '42501', null, 'anon no puede leer reportes');

select * from finish();
rollback;
