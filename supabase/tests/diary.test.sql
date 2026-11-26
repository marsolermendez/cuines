-- Privacidad del diario (Fase 2): entradas, borradores, recetas, fotos y Storage. Ejecutar: npm run db:test
-- Actores: Ana (autora), Bea (otra persona sin relación), Cai (perfil privado) y anónimo.
-- Aún no hay seguidores (Fase 4): "solo seguidores" lo ve únicamente su autora. Esos tests se ampliarán entonces.
begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bea@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'cai@test.local');
update public.profiles set is_private = true where id = '33333333-3333-3333-3333-333333333333';

-- Archivos de Storage: los sube la API de Storage; aquí se insertan como superusuaria.
insert into storage.objects (bucket_id, name) values
  ('photos', '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/a_full.jpg'),
  ('photos', '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/a_thumb.jpg'),
  ('photos', '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000003/b_full.jpg'),
  ('photos', '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000003/b_thumb.jpg');

-- ===================================================================== Ana
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$
  insert into public.recipes (id, owner_id, title) values
    ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Pública'),
    ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Solo seguidores'),
    ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Privada'),
    ('cccccccc-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Solo borrador'),
    ('cccccccc-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Sin entradas')
$$, 'puedo crear mis recetas');

select lives_ok($$
  insert into public.entries (id, author_id, recipe_id, status, visibility, title, cooked_on) values
    ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'published', 'public', 'Pública', '2026-11-20'),
    ('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000002', 'published', 'followers', 'Seguidores', '2026-11-21'),
    ('eeeeeeee-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000003', 'published', 'private', 'Privada', '2026-11-22');
  insert into public.entries (id, author_id, recipe_id, status, visibility, title)
    values ('eeeeeeee-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000004', 'draft', 'private', 'Borrador')
$$, 'puedo crear entradas y un borrador');

select lives_ok($$
  insert into public.entry_photos (id, entry_id, position, path, thumb_path, width, height, placeholder) values
    ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 0,
     '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/a_full.jpg',
     '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/a_thumb.jpg', 1600, 1200, 'data:image/jpeg;base64,/9j/4AAQ'),
    ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000003', 0,
     '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000003/b_full.jpg',
     '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000003/b_thumb.jpg', 1600, 1200, 'data:image/jpeg;base64,/9j/4AAQ')
$$, 'puedo añadir fotos a mis entradas');

select is((select count(*)::int from public.entries where id::text like 'eeeeeeee%'), 4, 'veo todas mis entradas, también el borrador');
select ok(
  (select published_at is not null from public.entries where id = 'eeeeeeee-0000-0000-0000-000000000001')
  and (select published_at is null from public.entries where id = 'eeeeeeee-0000-0000-0000-000000000004'),
  'published_at lo pone el servidor al publicar y el borrador no lo tiene');
select is((select count(*)::int from storage.objects where bucket_id = 'photos' and name like '11111111%'), 4, 'leo los archivos de mis fotos');

-- Restricciones de la base de datos
select throws_ok($$insert into public.entries (author_id, recipe_id, status, visibility, title)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000005', 'draft', 'public', 'x')$$,
  '23514', null, 'un borrador no puede ser público');
select throws_ok($$insert into public.entries (author_id, recipe_id, status, visibility, title, cooked_on)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000005', 'draft', 'private', 'x', '2026-11-20')$$,
  '23514', null, 'un borrador no tiene fecha de cocinado');
select throws_ok($$insert into public.entries (author_id, recipe_id, status, visibility, title)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000005', 'published', 'public', 'x')$$,
  '23514', null, 'una entrada publicada necesita fecha de cocinado');
select throws_ok($$insert into public.entries (author_id, recipe_id, status, visibility)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000004', 'draft', 'private')$$,
  '23505', null, 'solo un borrador por receta');
select throws_ok($$insert into public.entry_photos (entry_id, position, path, thumb_path, width, height, placeholder)
  values ('eeeeeeee-0000-0000-0000-000000000001', 10,
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/x.jpg',
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/y.jpg', 1, 1, 'data:image/jpeg;base64,AAAA')$$,
  '23514', null, 'máximo 10 fotos por entrada (posición 0 a 9)');
select throws_ok($$insert into public.entry_photos (entry_id, position, path, thumb_path, width, height, placeholder)
  values ('eeeeeeee-0000-0000-0000-000000000001', 0,
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/x.jpg',
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/y.jpg', 1, 1, 'data:image/jpeg;base64,AAAA')$$,
  '23505', null, 'no dos fotos en la misma posición');
select throws_ok($$insert into public.entry_photos (entry_id, position, path, thumb_path, width, height, placeholder)
  values ('eeeeeeee-0000-0000-0000-000000000001', 1,
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/x.jpg',
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/y.jpg', 1, 1, 'javascript:alert(1)')$$,
  '23514', null, 'el placeholder solo admite un JPEG en base64');
select throws_ok($$insert into public.entry_photos (entry_id, position, path, thumb_path, width, height, placeholder)
  values ('eeeeeeee-0000-0000-0000-000000000001', 1,
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000003/b_full.jpg',
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/y.jpg', 1, 1, 'data:image/jpeg;base64,AAAA')$$,
  '42501', null, 'la ruta de la foto tiene que colgar de su propia entrada');
select throws_ok($$update public.entries set author_id = '22222222-2222-2222-2222-222222222222'
  where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '42501', null, 'no puedo cambiar la autoría de una entrada');
select throws_ok($$update public.entries set published_at = now() where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '42501', null, 'no puedo falsear published_at');
select throws_ok($$delete from public.recipes where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  '23503', null, 'no se borra una receta que tiene entradas');

-- ===================================================================== Cai (perfil privado)
reset role;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$
  insert into public.recipes (id, owner_id, title) values ('cccccccc-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'De Cai');
  insert into public.entries (id, author_id, recipe_id, status, visibility, title, cooked_on)
    values ('eeeeeeee-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'cccccccc-0000-0000-0000-000000000006', 'published', 'public', 'Pública de perfil privado', '2026-11-23')
$$, 'Cai publica una entrada pública en su diario privado');
-- Tiene perfil privado, pero eso solo limita lo que ven los demás: Cai ve la suya y la pública de Ana.
select is((select count(*)::int from public.entries where id::text like 'eeeeeeee%'), 2, 'Cai ve su entrada y la pública de Ana');

-- ===================================================================== Bea (otra persona)
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id::text like 'eeeeeeee%'), 1, 'Bea solo ve una entrada: la pública de Ana');
select is((select count(*)::int from public.entries where id::text like 'eeeeeeee%' and status = 'draft'), 0, 'Bea no ve borradores');
select is((select count(*)::int from public.entries where id::text like 'eeeeeeee%' and visibility in ('followers', 'private')), 0,
  'Bea no ve entradas privadas ni de seguidores');
select is((select count(*)::int from public.entries where author_id = '33333333-3333-3333-3333-333333333333'), 0,
  'perfil privado: su entrada pública no se ve sin seguirla');
select is((select count(*)::int from public.recipes where id::text like 'cccccccc%'), 1, 'Bea solo ve la receta que usa una entrada que puede leer');
select is((select count(*)::int from public.entry_photos where id::text like 'ffffffff%'), 1, 'Bea solo ve la foto de la entrada visible');
select is((select count(*)::int from storage.objects where bucket_id = 'photos' and name like '11111111%'), 2,
  'Bea solo lee los archivos de la foto visible (completa y miniatura)');

select throws_ok($$insert into public.entries (author_id, recipe_id, status, visibility, title, cooked_on)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'published', 'public', 'x', '2026-11-20')$$,
  '42501', null, 'no puedo crear entradas a nombre de otra persona');
select throws_ok($$insert into public.entries (author_id, recipe_id, status, visibility, title, cooked_on)
  values ('22222222-2222-2222-2222-222222222222', 'cccccccc-0000-0000-0000-000000000002', 'published', 'public', 'x', '2026-11-20')$$,
  '42501', null, 'no puedo enlazar una receta que no veo');
select throws_ok($$insert into public.entry_photos (entry_id, position, path, thumb_path, width, height, placeholder)
  values ('eeeeeeee-0000-0000-0000-000000000001', 1,
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/x.jpg',
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000001/y.jpg', 1, 1, 'data:image/jpeg;base64,AAAA')$$,
  '42501', null, 'no puedo añadir fotos a la entrada de otra persona');

select is_empty($$update public.entries set title = 'hackeada' where id = 'eeeeeeee-0000-0000-0000-000000000001' returning id$$,
  'no puedo editar la entrada de otra persona');
select is_empty($$delete from public.entries where id = 'eeeeeeee-0000-0000-0000-000000000001' returning id$$,
  'no puedo borrar la entrada de otra persona');
select is_empty($$update public.recipes set title = 'hackeada' where id = 'cccccccc-0000-0000-0000-000000000001' returning id$$,
  'no puedo editar la receta de otra persona');
select is_empty($$delete from public.recipes where id = 'cccccccc-0000-0000-0000-000000000001' returning id$$,
  'no puedo borrar la receta de otra persona');

select lives_ok($$insert into public.entries (id, author_id, recipe_id, status, visibility, title, cooked_on)
  values ('eeeeeeee-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'cccccccc-0000-0000-0000-000000000001', 'published', 'public', 'Mía', '2026-11-24')$$,
  'sí puedo enlazar una receta que veo en mi propia entrada');
-- La foto privada de Ana no se puede "heredar" apuntando a su ruta desde una entrada mía.
select throws_ok($$insert into public.entry_photos (entry_id, position, path, thumb_path, width, height, placeholder)
  values ('eeeeeeee-0000-0000-0000-0000000000b1', 0,
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000003/b_full.jpg',
    '11111111-1111-1111-1111-111111111111/eeeeeeee-0000-0000-0000-000000000003/b_thumb.jpg', 1, 1, 'data:image/jpeg;base64,AAAA')$$,
  '42501', null, 'no puedo apuntar una foto mía a la ruta privada de otra persona');

select lives_ok($$insert into storage.objects (bucket_id, name) values ('photos', '22222222-2222-2222-2222-222222222222/mi_foto.jpg')$$,
  'puedo subir archivos a mi carpeta');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('photos', '11111111-1111-1111-1111-111111111111/intrusa.jpg')$$,
  '42501', null, 'no puedo subir archivos a la carpeta de otra persona');

-- ===================================================================== anónimo
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select throws_ok($$select * from public.entries$$, '42501', null, 'anon no puede leer entradas');
select is((select count(*)::int from storage.objects where bucket_id = 'photos' and name like '11111111%'), 0, 'anon no lee ninguna foto');

-- ===================================================================== Ana, de nuevo: nada de lo anterior le afectó
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select is((select title from public.entries where id = 'eeeeeeee-0000-0000-0000-000000000001'), 'Pública',
  'la entrada de Ana sigue intacta tras los intentos de Bea');

select * from finish();
rollback;
