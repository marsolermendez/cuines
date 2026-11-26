-- Recetas con identidad y cocinar con alguien (Fase 5). Ejecutar: npm run db:test
-- Los contadores cuentan solo lo que quien mira puede leer; guardar una receta enlaza (no copia) y no se puede con una
-- que no ves; etiquetar da lectura a la persona etiquetada y aceptar mete la entrada en su diario.
-- Actores: Ana (autora), Bea, Cai y Dan (sin relación).
begin;

create extension if not exists pgtap with schema extensions;

select plan(54);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@pgtap.test'),
  ('22222222-2222-2222-2222-222222222222', 'bea@pgtap.test'),
  ('33333333-3333-3333-3333-333333333333', 'cai@pgtap.test'),
  ('44444444-4444-4444-4444-444444444444', 'dan@pgtap.test');
-- once personas más para el tope de etiquetados
insert into auth.users (id, email)
  select ('aaaaaaaa-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'p' || i || '@pgtap.test' from generate_series(1, 11) i;

-- ===================================================================== Ana publica
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$
  insert into public.recipes (id, owner_id, title) values
    ('cccccccc-5555-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tortilla'),
    ('cccccccc-5555-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Solo privada'),
    ('cccccccc-5555-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Para etiquetar');
  insert into public.entries (id, author_id, recipe_id, status, visibility, title, cooked_on) values
    ('eeeeeeee-5555-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cccccccc-5555-0000-0000-000000000001', 'published', 'public', 'Tortilla pública', '2026-11-01'),
    ('eeeeeeee-5555-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cccccccc-5555-0000-0000-000000000001', 'published', 'private', 'Tortilla privada', '2026-11-02'),
    ('eeeeeeee-5555-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cccccccc-5555-0000-0000-000000000002', 'published', 'private', 'Solo para mí', '2026-11-03'),
    ('eeeeeeee-5555-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'cccccccc-5555-0000-0000-000000000003', 'published', 'public', 'Para etiquetar', '2026-11-04');
  insert into public.entries (id, author_id, recipe_id, status, visibility)
    values ('eeeeeeee-5555-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'cccccccc-5555-0000-0000-000000000001', 'draft', 'private')
$$, 'Ana publica entradas con tres recetas y tiene un borrador');

-- ===================================================================== Bea: contadores y guardar
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select times from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 1::bigint,
  'Bea cuenta una vez la receta: solo ve la entrada pública (ni la privada ni el borrador)');
select is((select people from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 1::bigint, 'y una persona');
select is((select times from public.recipe_stats('cccccccc-5555-0000-0000-000000000002')), 0::bigint,
  'una receta que solo usa una entrada privada no cuenta para Bea');
select is((select count(*)::int from public.recipes where id = 'cccccccc-5555-0000-0000-000000000001'), 1, 'Bea ve la receta de la entrada pública');
select is((select count(*)::int from public.recipes where id = 'cccccccc-5555-0000-0000-000000000002'), 0, 'y no la que solo usa una privada');

select lives_ok($$insert into public.entries (id, author_id, recipe_id, status, visibility, title, cooked_on)
  values ('eeeeeeee-5555-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'cccccccc-5555-0000-0000-000000000001', 'published', 'public', 'Mi tortilla', '2026-11-05')$$,
  'Bea cocina la misma receta y enlaza la de Ana');
select is((select times from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 2::bigint, 'ahora son dos veces');
select is((select people from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 2::bigint, 'y dos personas');

select lives_ok($$select public.save_as_draft('cccccccc-5555-0000-0000-000000000001')$$, 'Bea guarda la receta para cocinar');
select is((select count(*)::int from public.entries where author_id = '22222222-2222-2222-2222-222222222222'
    and recipe_id = 'cccccccc-5555-0000-0000-000000000001' and status = 'draft' and visibility = 'private'), 1,
  'el borrador es privado y enlaza la receta (no la copia)');
select is((select public.save_as_draft('cccccccc-5555-0000-0000-000000000001')),
  (select id from public.entries where author_id = '22222222-2222-2222-2222-222222222222' and status = 'draft'),
  'guardar dos veces es idempotente: devuelve el mismo borrador');
select is((select count(*)::int from public.entries where author_id = '22222222-2222-2222-2222-222222222222' and status = 'draft'), 1,
  'y no crea otro');
select throws_ok($$select public.save_as_draft('cccccccc-5555-0000-0000-000000000002')$$, '42501', null,
  'no se puede guardar una receta que no veo');
select is((select times from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 2::bigint,
  'un borrador guardado no cuenta como vez cocinada');

-- ===================================================================== Dan y Ana: contadores desde otros puntos de vista
reset role;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
set local role authenticated;

select is((select times from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 2::bigint,
  'Dan ve las dos entradas públicas, igual que Bea');

reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select is((select times from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 3::bigint,
  'Ana cuenta además su entrada privada');
select is((select people from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 2::bigint, 'entre dos personas');
select is((select count(*)::int from public.entries where author_id = '22222222-2222-2222-2222-222222222222' and status = 'draft'), 0,
  'Ana no ve el borrador de Bea');

-- ===================================================================== Ana etiqueta a Bea en una entrada privada
select lives_ok($$insert into public.entry_participants (entry_id, user_id)
  values ('eeeeeeee-5555-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222')$$,
  'Ana etiqueta a Bea en su entrada privada');
select throws_ok($$insert into public.entry_participants (entry_id, user_id)
  values ('eeeeeeee-5555-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'no puedo etiquetarme a mí misma');
select throws_ok($$insert into public.entry_participants (entry_id, user_id)
  values ('eeeeeeee-5555-0000-0000-0000000000d1', '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'no se etiqueta en un borrador');
select throws_ok($$insert into public.entry_participants (entry_id, user_id, status)
  values ('eeeeeeee-5555-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'accepted')$$,
  '42501', null, 'no puedo etiquetar a alguien ya aceptado: el estado lo pone el servidor');

-- ===================================================================== Bea: etiquetada, pendiente
reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id = 'eeeeeeee-5555-0000-0000-000000000002'), 1,
  'Bea, etiquetada, lee la entrada privada de Ana');
select is((select times from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 3::bigint,
  'y ahora cuenta esa vez en la receta');
select is((select people from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')), 2::bigint,
  'pero estar etiquetada no suma personas');
select is((select count(*)::int from public.diary_items where diary_owner = '22222222-2222-2222-2222-222222222222'
    and id = 'eeeeeeee-5555-0000-0000-000000000002'), 0,
  'mientras esté pendiente, la entrada no aparece en su diario');
select is_empty($$update public.entries set title = 'cambiada' where id = 'eeeeeeee-5555-0000-0000-000000000002' returning id$$,
  'la persona etiquetada no puede editar la entrada');
select throws_ok($$insert into public.entry_participants (entry_id, user_id)
  values ('eeeeeeee-5555-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'tampoco puede etiquetar a otras personas');
select lives_ok($$update public.entry_participants set status = 'accepted'
  where entry_id = 'eeeeeeee-5555-0000-0000-000000000002' and user_id = '22222222-2222-2222-2222-222222222222'$$,
  'Bea acepta la etiqueta');
select throws_ok($$update public.entry_participants set status = 'pending'
  where entry_id = 'eeeeeeee-5555-0000-0000-000000000002' and user_id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'y no puede volver a dejarla pendiente');
select ok((select shared from public.diary_items where diary_owner = '22222222-2222-2222-2222-222222222222'
    and id = 'eeeeeeee-5555-0000-0000-000000000002'),
  'aceptada, la entrada aparece en el diario de Bea como compartida (con @Ana)');
select ok(not (select shared from public.diary_items where diary_owner = '22222222-2222-2222-2222-222222222222'
    and id = 'eeeeeeee-5555-0000-0000-000000000003'),
  'y su propia entrada no está marcada como compartida');

-- ===================================================================== Dan: no ve lo privado ni a quien lo comparte
reset role;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entry_participants where entry_id = 'eeeeeeee-5555-0000-0000-000000000002'), 0,
  'Dan no ve quién está etiquetado en una entrada que no puede leer');
select is((select count(*)::int from public.diary_items where diary_owner = '22222222-2222-2222-2222-222222222222'), 1,
  'en el diario de Bea, Dan solo ve su entrada pública, no la privada de Ana que comparte con ella');

-- ===================================================================== Ana: etiquetas en una entrada pública
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.entry_participants (entry_id, user_id)
  values ('eeeeeeee-5555-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444')$$,
  'Ana etiqueta a Dan en una entrada pública');

reset role;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$update public.entry_participants set status = 'accepted'
  where entry_id = 'eeeeeeee-5555-0000-0000-000000000001' and user_id = '44444444-4444-4444-4444-444444444444'$$,
  'Dan acepta');

reset role;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entry_participants where entry_id = 'eeeeeeee-5555-0000-0000-000000000001' and status = 'accepted'), 1,
  'cualquiera que lea la entrada pública ve a quien la aceptó («cocinado con…»)');
select is((select count(*)::int from public.diary_items where diary_owner = '44444444-4444-4444-4444-444444444444'
    and id = 'eeeeeeee-5555-0000-0000-000000000001'), 1,
  'y la entrada aparece en el diario de Dan');
select is_empty($$delete from public.entry_participants where entry_id = 'eeeeeeee-5555-0000-0000-000000000001' returning user_id$$,
  'Cai no puede quitar a nadie de la entrada de otra persona');

-- ===================================================================== salirse y quitar
reset role;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$delete from public.entry_participants where entry_id = 'eeeeeeee-5555-0000-0000-000000000001' and user_id = '44444444-4444-4444-4444-444444444444'$$,
  'Dan se sale de la entrada');
select is((select count(*)::int from public.diary_items where diary_owner = '44444444-4444-4444-4444-444444444444'), 0,
  'y desaparece de su diario');

reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$delete from public.entry_participants where entry_id = 'eeeeeeee-5555-0000-0000-000000000002' and user_id = '22222222-2222-2222-2222-222222222222'$$,
  'Ana quita a Bea de su entrada privada');

reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id = 'eeeeeeee-5555-0000-0000-000000000002'), 0, 'Bea ya no puede leerla');

-- ===================================================================== devolver una entrada a borrador corta la lectura
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.entry_participants (entry_id, user_id)
  values ('eeeeeeee-5555-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222')$$,
  'Ana etiqueta a Bea en otra entrada privada');

reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id = 'eeeeeeee-5555-0000-0000-000000000004'), 1,
  'Bea la lee mientras esté publicada');

reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$update public.entries set status = 'draft', cooked_on = null where id = 'eeeeeeee-5555-0000-0000-000000000004'$$,
  'Ana la devuelve a borrador');

reset role;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.entries where id = 'eeeeeeee-5555-0000-0000-000000000004'), 0,
  'una persona etiquetada no lee un borrador');

-- ===================================================================== tope de personas etiquetadas
reset role;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.entry_participants (entry_id, user_id)
  select 'eeeeeeee-5555-0000-0000-000000000005', ('aaaaaaaa-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 10) i$$,
  'una entrada admite hasta 10 personas etiquetadas');
select throws_ok($$insert into public.entry_participants (entry_id, user_id)
  values ('eeeeeeee-5555-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000011')$$,
  '23514', null, 'la número 11 se rechaza');

-- ===================================================================== anónimo
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select throws_ok($$select * from public.entry_participants$$, '42501', null, 'anon no puede leer participantes');
select throws_ok($$select * from public.diary_items$$, '42501', null, 'anon no puede leer diarios');
select throws_ok($$select * from public.recipe_stats('cccccccc-5555-0000-0000-000000000001')$$, '42501', null, 'anon no puede pedir contadores');
select throws_ok($$select public.save_as_draft('cccccccc-5555-0000-0000-000000000001')$$, '42501', null, 'anon no puede guardar recetas');

select * from finish();
rollback;
