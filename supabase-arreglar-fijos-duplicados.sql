-- ============================================================
-- Gastos Cris y Adri — ARREGLO: los gastos fijos se repetían
--
-- QUÉ PASABA
--   La app apunta en cada gasto fijo el mes en que lo generó, para no
--   repetirlo. Esa marca no existía en la base de datos (fallo al crear
--   las tablas), así que la app no encontraba respuesta y lo volvía a
--   generar CADA VEZ que alguien entraba.
--
-- Pegar entero en el Editor SQL y pulsar "Run".
-- ============================================================

-- ── 1. La marca que faltaba ─────────────────────────────────
alter table public.apuntes_recurrentes
  add column if not exists ultimo_generado text;


-- ── 2. Ver cuántos duplicados hay ───────────────────────────
-- Apuntes idénticos (misma fecha, importe y establecimiento) creados
-- automáticamente. Mira el resultado antes de borrar nada.
select fecha, establecimiento, importe, count(*) as veces_repetido
from public.transacciones
where quien = 'Auto'
group by fecha, establecimiento, importe
having count(*) > 1
order by fecha desc;


-- ── 3. Borrar los duplicados, dejando uno de cada ───────────
-- Solo toca apuntes generados automáticamente (quien = 'Auto').
-- Los que hayáis metido a mano no se tocan.
delete from public.transacciones
where id in (
  select id from (
    select id,
           row_number() over (
             partition by fecha, establecimiento, importe, categoria
             order by id
           ) as copia
    from public.transacciones
    where quien = 'Auto'
  ) t
  where t.copia > 1
);


-- ── 4. Marcar los fijos como ya generados este mes ──────────
-- Para que no se vuelvan a crear al entrar.
update public.apuntes_recurrentes
set ultimo_generado = to_char(current_date, 'YYYY-MM')
where activo = true;


-- ── 5. Comprobación: no debe quedar ningún repetido ─────────
select count(*) as duplicados_que_quedan
from (
  select fecha, establecimiento, importe
  from public.transacciones
  where quien = 'Auto'
  group by fecha, establecimiento, importe
  having count(*) > 1
) x;
