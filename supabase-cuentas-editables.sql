-- ============================================================
-- Gastos Cris y Adri — cuentas editables
--
-- Pegar en el Editor SQL de Supabase y pulsar "Run".
-- Es seguro: no borra nada, solo añade dos columnas y las rellena.
-- Se puede ejecutar varias veces sin problema.
--
-- Hace falta para que la pantalla de Ajustes → Cuentas permita
-- crear, renombrar y quitar medios de pago.
-- ============================================================

-- 1. De quién es cada cuenta. Es lo que usa el informe
--    "Quién puso el dinero" para repartir el gasto del mes.
alter table public.cuentas
  add column if not exists persona text not null default 'Común';

-- 2. Para poder ocultar una cuenta que ya se ha usado, sin borrar
--    los apuntes que la tienen.
alter table public.cuentas
  add column if not exists activa boolean not null default true;

-- 3. Orden en que aparecen los medios de pago en el formulario.
alter table public.cuentas
  add column if not exists orden integer not null default 0;

-- 4. Rellenar "persona" a partir de los nombres actuales.
--    Solo toca las que siguen con el valor por defecto.
update public.cuentas set persona = 'Cris'
  where persona = 'Común' and nombre in ('Efectivo Cris', 'Tarjeta Cris');

update public.cuentas set persona = 'Adri'
  where persona = 'Común' and nombre in ('Efectivo Adri', 'Tarjeta Adri');

-- 5. Comprobación: debe salir cada cuenta con su dueño.
select nombre, emoji, persona, activa, saldo_inicial
from public.cuentas
order by persona, nombre;
