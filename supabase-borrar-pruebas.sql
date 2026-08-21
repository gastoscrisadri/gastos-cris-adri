-- ============================================================
-- Gastos Cris y Adri — borrar los datos de prueba
--
-- Pegar en el Editor SQL de Supabase cuando se acaben las pruebas,
-- ANTES de que Cris y Adri empiecen a usar la app de verdad.
--
-- ¡CUIDADO! Esto borra TODOS los apuntes, eventos y apuntes fijos.
-- No lo ejecutéis una vez haya datos reales que queráis conservar.
--
-- NO borra las categorías ni las cuentas: esas son la configuración
-- de partida y deben quedarse.
-- ============================================================

-- 1. Todos los apuntes (gastos e ingresos)
delete from public.transacciones;

-- 2. Todos los eventos de prueba
delete from public.eventos;

-- 3. Todos los apuntes fijos/recurrentes de prueba
delete from public.apuntes_recurrentes;

-- 4. Dejar los saldos de las cuentas otra vez a cero
update public.cuentas set saldo_inicial = 0;

-- 5. Comprobación: las tres primeras deben dar 0,
--    y las dos últimas deben seguir teniendo datos.
select 'transacciones'       as tabla, count(*) as filas from public.transacciones
union all select 'eventos',             count(*) from public.eventos
union all select 'apuntes_recurrentes', count(*) from public.apuntes_recurrentes
union all select 'categorias (se queda)', count(*) from public.categorias
union all select 'cuentas (se queda)',    count(*) from public.cuentas;
