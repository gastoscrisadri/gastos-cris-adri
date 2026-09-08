-- ============================================================
-- Gastos Cris y Adri — poder saldar la cuenta entre vosotros
--
-- Pegar en el Editor SQL de Supabase y pulsar "Run".
--
-- QUÉ HACE
--   Añade sitio para anotar un pago de uno al otro ("te he pagado los
--   325 € que te debía"). No borra ni cambia nada de lo que ya hay.
--
-- POR QUÉ NO ES UN GASTO
--   Ese dinero no se gasta: cambia de bolsillo. Si contara como gasto,
--   el mes parecería más caro de lo que fue. Por eso va marcado aparte:
--   ajusta quién ha puesto cuánto, pero no infla lo gastado.
-- ============================================================

-- A quién se le paga. Vacío en todos los apuntes normales; solo se
-- rellena en las liquidaciones.
alter table public.transacciones
  add column if not exists liquidacion_a text;

-- Comprobación: debe salir una fila con "liquidacion_a".
select column_name as columna, data_type as tipo
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transacciones'
  and column_name = 'liquidacion_a';
