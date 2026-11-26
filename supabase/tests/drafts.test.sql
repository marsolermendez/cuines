-- Privacidad de los borradores (Fase 3): un borrador no lo lee nadie más que su autora, ni con sus fotos y su receta,
-- y «Cocinar ahora» (convertirlo en entrada) lo conserva todo. Ejecutar: npm run db:test
begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@pgtap.test'),
  ('22222222-2222-2222-2222-222222222222', 'bea@pgtap.test');

insert into storage.objects (bucket_id, name) values
  ('photos', '11111111-1111-1111-1111-111111111111/dddddddd-0000-0000-0000-000000000001/a_full.jpg'),
  ('photos', '11111111-1111-1111-1111-111111111111/dddddddd-0000-0000-0000-000000000001/a_thumb.jpg');

-- ===================================================================== Ana crea dos borradores
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$
  insert into public.recipes (id, owner_id, title, ingredients) values
    ('cccccccc-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'Kebab del vecino', array['pan', 'carne']),
    ('cccccccc-0000-0000-0000-0000000000d2', '11111111-1111-1111-1111-111111111111', 'Tarta de queso', array['queso']);
  insert into public.entries (id, author_id, recipe_id, status, visibility, body, tags, planned_for, position) values
    ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000d1', 'draft', 'private', 'probar con menos sal', array['cena'], '2026-11-29', 1),
    ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000d2', 'draft', 'private', '', '{}', null, 2);
  insert into public.entry_photos (entry_id, position, path, thumb_path, width, height, placeholder) values
    ('dddddddd-0000-0000-0000-000000000001', 0,
     '11111111-1111-1111-1111-111111111111/dddddddd-0000-0000-0000-000000000001/a_full.jpg',
     '11111111-1111-1111-1111-111111111111/dddddddd-0000-0000-0000-000000000001/a_thumb.jpg', 1600, 1200, 'data:image/jpeg;base64,/9j/4AAQ')
$$, 'puedo crear borradores con receta, notas, etiquetas, fecha prevista y foto');

select is((select count(*)::int from public.entries where id::text like 'dddddddd%' and status = 'draft'), 2, 'veo mis borradores');

select throws_ok($$update public.entries set tags = array['1','2','3','4','5','6','7','8','9','10','11']
  where id = 'dddddddd-0000-0000-0000-000000000002'$$,
  '23514', null, 'máximo 10 etiquetas');
select lives_ok($$update public.entries set position = 0.5 where id = 'dddddddd-0000-0000-0000-000000000002'$$,
  'puedo reordenar mis borradores');

-- ===================================================================== Bea: no ve nada de los borradores
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id::text like 'dddddddd%'), 0, 'Bea no ve los borradores de Ana');
select is((select count(*)::int from public.recipes where id::text like 'cccccccc-0000-0000-0000-0000000000d%'), 0,
  'Bea no ve las recetas que solo usa un borrador');
select is((select count(*)::int from public.entry_photos where entry_id::text like 'dddddddd%'), 0,
  'Bea no ve las fotos de un borrador');
select is((select count(*)::int from storage.objects where bucket_id = 'photos' and name like '11111111%'), 0,
  'Bea no lee los archivos de la foto de un borrador');

select is_empty($$update public.entries set body = 'hackeado' where id = 'dddddddd-0000-0000-0000-000000000001' returning id$$,
  'Bea no puede editar el borrador de Ana');
select is_empty($$update public.entries set status = 'published', visibility = 'public', title = 'robada', cooked_on = '2026-11-26', planned_for = null
  where id = 'dddddddd-0000-0000-0000-000000000001' returning id$$,
  'Bea no puede publicar el borrador de Ana');
select is_empty($$delete from public.entries where id = 'dddddddd-0000-0000-0000-000000000001' returning id$$,
  'Bea no puede borrar el borrador de Ana');
select throws_ok($$insert into public.entries (author_id, recipe_id, status, visibility)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000d1', 'draft', 'private')$$,
  '42501', null, 'Bea no puede crear borradores a nombre de Ana');
select throws_ok($$insert into public.entries (author_id, recipe_id, status, visibility)
  values ('22222222-2222-2222-2222-222222222222', 'cccccccc-0000-0000-0000-0000000000d1', 'draft', 'private')$$,
  '42501', null, 'Bea no puede guardar un borrador con una receta que no ve');

-- ===================================================================== Ana: «Cocinar ahora»
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select throws_ok($$update public.entries set status = 'published', visibility = 'public', title = 'Kebab', cooked_on = '2026-11-26'
  where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  '23514', null, 'al publicar hay que quitar la fecha prevista');
select throws_ok($$update public.entries set status = 'published', visibility = 'public', cooked_on = '2026-11-26', planned_for = null
  where id = 'dddddddd-0000-0000-0000-000000000002'$$,
  '23514', null, 'al publicar hace falta un título');
select lives_ok($$update public.entries set status = 'published', visibility = 'public', title = 'Kebab', cooked_on = '2026-11-26', planned_for = null
  where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  'convierto un borrador en entrada con un UPDATE');
select ok((select published_at is not null from public.entries where id = 'dddddddd-0000-0000-0000-000000000001'),
  'el servidor pone published_at al convertirlo');
select ok(
  (select recipe_id from public.entries where id = 'dddddddd-0000-0000-0000-000000000001') = 'cccccccc-0000-0000-0000-0000000000d1'
  and (select count(*) from public.entry_photos where entry_id = 'dddddddd-0000-0000-0000-000000000001') = 1,
  'la conversión conserva la receta y las fotos');
select throws_ok($$update public.entries set status = 'draft' where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  '23514', null, 'una entrada publicada no vuelve a ser borrador sin quitarle fecha y visibilidad');

-- ===================================================================== Bea: ahora sí ve lo publicado, y solo eso
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select array_agg(id::text order by id) from public.entries where id::text like 'dddddddd%'),
  array['dddddddd-0000-0000-0000-000000000001'],
  'tras convertirlo Bea ve la entrada pública, pero no el otro borrador');

select * from finish();
rollback;
