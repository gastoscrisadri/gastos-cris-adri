-- ============================================================
-- Gastos Cris y Adri — que no todo se reparta a medias
--
-- Pegar en el Editor SQL de Supabase y pulsar "Run".
--
-- QUÉ HACE
--   Permite decir que una categoría no va al 50%. Por ejemplo, que del
--   alquiler uno pague el 70% y el otro el 30%.
--
--   Todo lo que no se toque sigue yendo a medias, como hasta ahora.
--   No cambia ningún apunte existente.
-- ============================================================

-- Qué porcentaje del gasto le toca a la primera persona (Cris).
-- Vacío = a medias. 30 = Cris paga el 30% y Adri el 70%.
alter table public.categorias
  add column if not exists porcentaje_primero integer;

-- Comprobación: debe salir una fila con "porcentaje_primero".
select column_name as columna, data_type as tipo
from information_schema.columns
where table_schema = 'public'
  and table_name = 'categorias'
  and column_name = 'porcentaje_primero';
