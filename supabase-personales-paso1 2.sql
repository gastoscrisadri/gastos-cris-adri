-- ============================================================
-- Gastos Cris y Adri — preparar los gastos personales (paso 1 de 2)
--
-- Pegar en el Editor SQL de Supabase y pulsar "Run".
--
-- QUÉ HACE
--   Solo añade sitio para guardar dos datos nuevos en cada apunte:
--     · quién lo creó
--     · si es un gasto común o personal
--
-- QUÉ **NO** HACE
--   No cambia todavía quién puede ver qué. Todo se sigue viendo igual
--   que hasta ahora. Las reglas de privacidad son el paso 2, y solo se
--   pueden activar cuando la app ya esté guardando quién crea cada
--   apunte — si no, los apuntes nuevos se volverían invisibles.
--
-- ES SEGURO
--   No borra nada ni cambia ningún apunte existente. Los que ya hay se
--   quedan como comunes, que es lo razonable. Se puede ejecutar varias
--   veces sin problema.
-- ============================================================

-- 1. Si el gasto es de los dos o personal de quien lo apunta.
--    Por defecto común, que es lo más frecuente viviendo juntos.
alter table public.transacciones
  add column if not exists comun boolean not null default true;

-- 2. Quién creó el apunte. La columna ya existía desde el principio,
--    pero estaba siempre vacía: la app no la rellenaba. A partir de
--    ahora sí. Los apuntes viejos se quedan sin dueño, y como son
--    comunes, eso no molesta.
create index if not exists transacciones_user_id_idx
  on public.transacciones (user_id);

create index if not exists transacciones_comun_idx
  on public.transacciones (comun);

-- 3. Comprobación: debe salir una fila con "comun" y otra con "user_id".
select column_name as columna, data_type as tipo, column_default as valor_por_defecto
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transacciones'
  and column_name in ('comun', 'user_id')
order by column_name;
