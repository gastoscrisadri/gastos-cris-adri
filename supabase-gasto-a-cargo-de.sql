-- =============================================================================
--  GASTO DE UNO, PAGADO POR EL OTRO
-- =============================================================================
--
--  Para qué: Adri se compra unas zapatillas de 100 € y las paga con la tarjeta
--  de Cris. Ese gasto es de Adri (no se reparte), pero Cris ha puesto el dinero
--  y tiene derecho a ver el apunte y a que se lo devuelvan.
--
--  Hasta ahora la app solo sabía decir dos cosas: "de los dos" (lo ven los dos
--  y se reparte) o "solo mío" (lo ve uno y no se reparte). Faltaba la tercera.
--
--  Este archivo añade UNA columna. No toca ningún dato que ya exista, no
--  cambia las reglas de privacidad y no borra nada.
--
--  Cómo se ejecuta: copiar todo y pegarlo en el Editor SQL de Supabase.
-- =============================================================================

-- 1. La columna nueva. Vacía en todos los apuntes que ya hay, o sea que nada
--    cambia de comportamiento hasta que la app empiece a rellenarla.
--    Cuando lleva un nombre, ese gasto es entero de esa persona, aunque el
--    apunte esté marcado como común para que lo vean los dos.
alter table public.transacciones
  add column if not exists a_cargo_de text;

comment on column public.transacciones.a_cargo_de is
  'Si tiene nombre, el gasto es entero de esa persona aunque sea visible para los dos. Se usa cuando uno paga con la tarjeta del otro.';

-- 2. Comprobación: tiene que salir la columna, de tipo text y aceptando vacíos.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transacciones'
  and column_name = 'a_cargo_de';

-- 3. Comprobación: tiene que dar 0. Ningún apunte de los que hay cambia.
select count(*) as apuntes_con_a_cargo_de
from public.transacciones
where a_cargo_de is not null;
