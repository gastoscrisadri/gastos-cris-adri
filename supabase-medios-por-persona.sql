-- ============================================================
-- Gastos Cris y Adri — un Bizum y un Banco para cada uno
--
-- Pegar en el Editor SQL de Supabase y pulsar "Run".
-- Requiere haber ejecutado antes supabase-cuentas-editables.sql.
--
-- No borra nada: crea las cuentas que faltan y esconde las genéricas.
-- Se puede ejecutar varias veces sin problema.
--
-- Deja los medios de pago en este orden, para cada persona:
--   1. Tarjeta   2. Bizum   3. Efectivo   4. Banco
-- ============================================================

-- 1. Crear el Bizum y el Banco de cada uno
insert into public.cuentas (nombre, emoji, persona, saldo_inicial, orden) values
  ('Bizum Cris', '📱', 'Cris', 0, 2),
  ('Bizum Adri', '📱', 'Adri', 0, 2),
  ('Banco Cris', '🏦', 'Cris', 0, 4),
  ('Banco Adri', '🏦', 'Adri', 0, 4)
on conflict (nombre) do nothing;

-- 2. Fijar el orden de las que ya existían
update public.cuentas set orden = 1 where nombre in ('Tarjeta Cris', 'Tarjeta Adri');
update public.cuentas set orden = 3 where nombre in ('Efectivo Cris', 'Efectivo Adri');
update public.cuentas set orden = 5 where nombre = 'Transferencia';
update public.cuentas set orden = 6 where nombre = 'Tarjeta roja';

-- 3. Esconder el Bizum y el Banco genéricos, que ahora sobran.
--    No se borran: si algún apunte de prueba los usa, sigue teniendo sentido.
update public.cuentas set activa = false where nombre in ('Bizum', 'Banco');

-- 4. Comprobación: así quedarán los medios de pago.
select
  case when activa then '' else '(escondida) ' end || nombre as cuenta,
  emoji, persona, orden
from public.cuentas
order by activa desc, persona, orden, nombre;
