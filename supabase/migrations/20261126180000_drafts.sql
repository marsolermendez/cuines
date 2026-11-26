-- Borradores «Quiero cocinar» (Fase 3).
-- El modelo ya los soporta desde la Fase 2 (entries.status = 'draft', el CHECK que los obliga a ser privados y sin
-- fecha de cocinado, y un solo borrador por receta y persona). Solo falta el índice para listarlos en orden manual.
create index entries_drafts on public.entries (author_id, position) where status = 'draft';
