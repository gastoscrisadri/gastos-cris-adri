-- =============================================================================
--  APRETAR LOS PERMISOS DE LA TABLA DE NOMBRES
-- =============================================================================
--
--  Qué falla. La tabla "personas" quedó ayer con una sola política:
--
--      for all
--      using      (auth.role() = 'authenticated')   <- ver, cambiar Y BORRAR
--      with check (user_id = auth.uid())            <- solo insertar y cambiar
--
--  La intención era "leer todos, apuntarse uno mismo". Pero en Postgres la
--  cláusula "using" no manda solo sobre lo que se VE: manda también sobre lo
--  que se puede BORRAR. Así que cualquiera de los dos podía borrar la fila
--  del otro.
--
--  Qué se podía hacer con eso: nada que deje leer los gastos privados de
--  nadie — eso lo protege la política de la tabla "transacciones", que no se
--  toca aquí. Lo peor sería que un gasto privado NUEVO se archivara bajo la
--  cuenta equivocada. Es ensuciar, no espiar, y se arregla solo en cuanto el
--  otro abre la app. Pero no hay razón para dejarlo abierto.
--
--  La solución: una política por operación, en vez de una para todo.
--  Leer lo pueden hacer los dos (hace falta, es como se sabe cuál es la
--  cuenta del otro para guardarle un gasto suyo a su nombre). Insertar,
--  cambiar y borrar, solo tu propia fila.
--
--  Cómo se ejecuta: copiar todo y pegarlo en el Editor SQL de Supabase.
-- =============================================================================


drop policy if exists "leer todos, apuntarse uno mismo" on public.personas;

-- Ver: los dos. Es lo único que se comparte.
create policy "leer todos" on public.personas
  for select
  using (auth.role() = 'authenticated');

-- Apuntarse: solo a uno mismo, nunca al otro.
create policy "apuntarme yo" on public.personas
  for insert
  with check (user_id = auth.uid());

-- Cambiar: solo tu fila, y solo para que siga siendo tuya. Las dos cláusulas
-- hacen falta: "using" dice cuál puedes tocar, "with check" cómo puede quedar.
create policy "cambiar lo mio" on public.personas
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Borrar: solo tu fila. Esto es lo que faltaba.
create policy "borrar lo mio" on public.personas
  for delete
  using (user_id = auth.uid());


-- ── Comprobación ────────────────────────────────────────────────────────────
--
-- Tienen que salir cuatro filas: select, insert, update y delete. Y en las
-- tres últimas, la condición tiene que nombrar auth.uid() — si alguna dijera
-- solo "authenticated", es que se ha quedado abierta.

select p.polname as politica,
       case p.polcmd when 'r' then 'ver' when 'a' then 'insertar'
                     when 'w' then 'cambiar' when 'd' then 'borrar'
                     else 'TODO (mal)' end as manda_sobre,
       pg_get_expr(p.polqual, p.polrelid)      as para_tocar,
       pg_get_expr(p.polwithcheck, p.polrelid) as como_puede_quedar
from pg_policy p
where p.polrelid = 'public.personas'::regclass
order by p.polcmd;

-- Y que los dos nombres siguen apuntando a su cuenta de siempre.
select nombre, user_id from public.personas order by nombre;


-- =============================================================================
--  VUELTA ATRÁS — pegar esto si algo va mal
-- =============================================================================
--
-- drop policy if exists "leer todos" on public.personas;
-- drop policy if exists "apuntarme yo" on public.personas;
-- drop policy if exists "cambiar lo mio" on public.personas;
-- drop policy if exists "borrar lo mio" on public.personas;
-- create policy "leer todos, apuntarse uno mismo" on public.personas
--   for all
--   using (auth.role() = 'authenticated')
--   with check (user_id = auth.uid());
