-- =============================================================================
--  VACIAR LAS PRUEBAS Y EMPEZAR DE VERDAD
-- =============================================================================
--
--  Pegar entero en el Editor SQL de Supabase y pulsar "Run".
--
--  QUÉ BORRA
--    · Todos los apuntes: gastos, ingresos y ajustes de cuentas
--    · Los eventos
--    · Los cierres de la cuenta de los dos
--
--  QUÉ SE QUEDA INTACTO
--    · Las categorías y subcategorías, con sus porcentajes de reparto
--    · Las cuentas y medios de pago
--    · El gasto fijo del alquiler
--    · Los usuarios y sus contraseñas
--
--  Además deja el gasto fijo marcado como "no generado este mes", para que el
--  alquiler se cree solo la próxima vez que abráis la app.
--
--  ¡OJO! Esto borra TODO lo apuntado. Es lo que queremos para empezar limpios,
--  pero no lo ejecutéis una vez haya gastos de verdad que queráis conservar.
-- =============================================================================

-- 1. Fuera los apuntes, los eventos y los cierres
delete from public.transacciones;
delete from public.eventos;
delete from public.cierres;

-- 2. Saldos de las cuentas otra vez a cero
update public.cuentas set saldo_inicial = 0;

-- 3. Que el alquiler se vuelva a generar al abrir la app
update public.apuntes_recurrentes set ultimo_generado = null;

-- 4. Comprobación. Las tres primeras deben dar 0; las demás, sus datos.
select 'apuntes (debe dar 0)'            as cosa, count(*)::text as cuantos from public.transacciones
union all select 'eventos (debe dar 0)',            count(*)::text from public.eventos
union all select 'cierres (debe dar 0)',            count(*)::text from public.cierres
union all select 'categorías (se quedan)',          count(*)::text from public.categorias
union all select 'cuentas (se quedan)',             count(*)::text from public.cuentas
union all select 'gastos fijos (se quedan)',        count(*)::text from public.apuntes_recurrentes
union all select 'reparto del alquiler (% de Cris)',
       coalesce((select porcentaje_primero::text from public.categorias
                 where nombre = 'Alquiler' and padre_id is not null), 'sin poner');
