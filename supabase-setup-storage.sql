-- ============================================================
-- Gastos Cris y Adri — almacenamiento de las fotos de tickets
-- Pegar en el Editor SQL de Supabase DESPUÉS de supabase-setup.sql.
--
-- Si diera un error de permisos ("must be owner of table objects"),
-- no pasa nada: se puede hacer lo mismo desde el panel, en
-- Storage → New bucket → nombre "documentos" → marcar "Public bucket".
-- ============================================================

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do nothing;

drop policy if exists "documentos lectura autenticada" on storage.objects;
create policy "documentos lectura autenticada" on storage.objects
  for select using (bucket_id = 'documentos' and auth.role() = 'authenticated');

drop policy if exists "documentos subida autenticada" on storage.objects;
create policy "documentos subida autenticada" on storage.objects
  for insert with check (bucket_id = 'documentos' and auth.role() = 'authenticated');

drop policy if exists "documentos borrado autenticado" on storage.objects;
create policy "documentos borrado autenticado" on storage.objects
  for delete using (bucket_id = 'documentos' and auth.role() = 'authenticated');
