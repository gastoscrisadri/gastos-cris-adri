-- =============================================================================
--  APUNTAR UN GASTO QUE ES DEL OTRO
-- =============================================================================
--
--  Para qué: "págalo tú, que no llevo la tarjeta" pasa constantemente, y hasta
--  ahora no había forma de apuntarlo. En el formulario aparecerá una tercera
--  opción, "Gasto de Adri" (o de Cris, según quién mire).
--
--  La regla de quién ve qué, tal como la fijó Antonio:
--
--      Ves todo, MENOS lo que es del otro Y lo paga el otro.
--
--  Para que eso funcione, un gasto privado tiene que guardarse a nombre de SU
--  DUEÑO, no de quien lo teclea. Si Cris apunta un gasto de Adri pagado por
--  Adri, ese apunte es de Adri y Cris deja de verlo.
--
--  LA REGLA QUE PROTEGE LA PRIVACIDAD NO SE TOCA. Lo único que cambia es el
--  permiso de ESCRITURA, que hoy impide guardar un apunte a nombre del otro.
--
--  Cómo se ejecuta: copiar todo y pegarlo en el Editor SQL de Supabase.
-- =============================================================================


-- ── 1. Una tabla que relacione cada nombre con su cuenta ────────────────────
--
-- Hacen falta dos filas: "Cris" y "Adri", cada una con el identificador de su
-- cuenta. NO hay que rellenarla a mano: la app apunta a cada uno la primera
-- vez que abre la aplicación.
--
-- unique(user_id) es a propósito: impide que alguien se ponga el nombre del
-- otro y acabe quedándose con sus apuntes privados.

create table if not exists public.personas (
  nombre      text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id)
);

alter table public.personas enable row level security;

-- Los dos pueden leer la tabla (hace falta para saber quién es el otro), pero
-- cada uno solo puede apuntarse A SÍ MISMO.
drop policy if exists "leer todos, apuntarse uno mismo" on public.personas;
create policy "leer todos, apuntarse uno mismo" on public.personas
  for all
  using (auth.role() = 'authenticated')
  with check (user_id = auth.uid());


-- ── 2. Permitir guardar un apunte a nombre del otro ─────────────────────────
--
-- La política actual es:
--     using      (comun = true or user_id = auth.uid())   <- quién VE qué
--     with check (comun = true or user_id = auth.uid())   <- quién puede ESCRIBIR
--
-- La primera línea es la que protege la privacidad y SE QUEDA EXACTAMENTE
-- IGUAL. La segunda impide hoy guardar un apunte privado a nombre del otro,
-- así que se afloja: cualquiera que haya entrado en la app puede escribir.
-- Lo que puede LEER cada uno no cambia en absoluto.

drop policy if exists "comunes y los mios" on public.transacciones;
create policy "comunes y los mios" on public.transacciones
  for all
  using (comun = true or user_id = auth.uid())
  with check (auth.role() = 'authenticated');


-- ── 3. Comprobaciones ───────────────────────────────────────────────────────

-- La tabla nueva, vacía de momento (se llena sola al abrir la app)
select count(*) as personas_apuntadas from public.personas;

-- La política, para ver que "using" sigue diciendo lo mismo de siempre
select polname as politica,
       pg_get_expr(polqual, polrelid)      as quien_ve_que,
       pg_get_expr(polwithcheck, polrelid) as quien_puede_escribir
from pg_policy
where polrelid = 'public.transacciones'::regclass;

-- Ningún apunte privado sin dueño: si alguno saliera aquí, sería invisible
-- para todos. Debe dar 0.
select count(*) as privados_sin_dueno
from public.transacciones
where comun = false and user_id is null;


-- =============================================================================
--  VUELTA ATRÁS — pegar esto si algo va mal
-- =============================================================================
--
-- Deja la política exactamente como estaba antes de este archivo. La tabla
-- personas puede quedarse: sin la app rellenándola no molesta a nadie.
--
-- drop policy if exists "comunes y los mios" on public.transacciones;
-- create policy "comunes y los mios" on public.transacciones
--   for all
--   using (comun = true or user_id = auth.uid())
--   with check (comun = true or user_id = auth.uid());
