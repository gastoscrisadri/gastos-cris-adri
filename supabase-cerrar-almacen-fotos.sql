-- ============================================================
-- Gastos Cris y Adri — hacer privadas las fotos de los tickets
--
-- Pegar en el Editor SQL de Supabase y pulsar "Run".
--
-- QUÉ HACE
--   Cierra el almacén "documentos". Hasta ahora era público: cualquiera
--   con la dirección de una foto podía verla sin haber entrado en la app,
--   y en una captura del banco puede salir un número de cuenta.
--   A partir de aquí, las fotos solo se ven desde dentro de la app.
--
-- ANTES DE EJECUTARLO
--   La app tiene que estar desplegada con las direcciones firmadas
--   (desplegado el 07/09/2026) y hay que haber comprobado en el móvil que
--   las fotos se ven. Si se cierra el almacén sin eso, las fotos dejarían
--   de verse.
--
-- SI ALGO SALIERA MAL
--   Se deshace al momento con la última línea de este archivo, que está
--   comentada. Volver a ponerlo público restaura el comportamiento
--   anterior sin perder ninguna foto.
-- ============================================================

-- 1. Cerrar el almacén
update storage.buckets
set public = false
where id = 'documentos';

-- 2. Asegurar que quien ha entrado en la app sí puede ver las fotos.
--    (Ya debería existir de la instalación, se repite por si acaso.)
drop policy if exists "documentos lectura autenticada" on storage.objects;
create policy "documentos lectura autenticada" on storage.objects
  for select using (bucket_id = 'documentos' and auth.role() = 'authenticated');

-- 3. Comprobación: "public" debe salir en false.
select id, name, public
from storage.buckets
where id = 'documentos';


-- ------------------------------------------------------------
-- PARA DESHACERLO, si las fotos dejaran de verse:
-- quitar los dos guiones del principio de la línea siguiente y ejecutarla.
--
-- update storage.buckets set public = true where id = 'documentos';
-- ------------------------------------------------------------
