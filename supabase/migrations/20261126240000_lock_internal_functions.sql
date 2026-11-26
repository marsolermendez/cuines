-- Endurecimiento (Fase 6): las funciones que solo ejecuta el servidor no tienen por qué ser invocables por nadie.
-- Las de disparador (triggers) siguen funcionando: Postgres no comprueba EXECUTE a quien dispara el trigger.

revoke execute on function public.recipes_touch(), public.entries_touch(), public.follows_set_status()
  from public, anon, authenticated;

-- `rls_auto_enable` la crea Supabase al marcar «Enable RLS on new tables automatically» (solo existe en la nube).
-- Es un disparador de eventos y, aun así, se podía llamar como RPC desde la API pública.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
