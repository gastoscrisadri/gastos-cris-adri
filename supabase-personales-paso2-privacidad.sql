-- ============================================================
-- Gastos Cris y Adri — hacer privados los gastos personales
--
-- ESTE ES EL CAMBIO MÁS DELICADO DE LA APP. Léelo antes de pegarlo.
--
-- QUÉ HACE
--   A partir de aquí, un apunte marcado "solo mío" únicamente lo ve quien
--   lo creó. Los marcados "de los dos" los siguen viendo ambos.
--
-- ANTES DE EJECUTARLO
--   1. Cada uno tiene que haber entrado en la app al menos una vez y
--      haber elegido su nombre en Ajustes → "Yo soy".
--   2. Ejecutar SOLO el paso 1 de abajo y comprobar que devuelve 0.
--
-- CÓMO DESHACERLO
--   El paso 4, al final, está comentado. Si algo va mal, se quitan los
--   dos guiones de esas líneas y se ejecuta: todo vuelve a como estaba
--   ahora mismo, al instante y sin perder nada.
-- ============================================================


-- ── PASO 1 ── Comprobación previa. TIENE que devolver 0.
--
-- Busca apuntes marcados como personales pero sin dueño: esos se
-- volverían invisibles para todo el mundo. Si sale un número mayor que
-- cero, PARA y avísame antes de seguir.
select count(*) as apuntes_que_desaparecerian
from public.transacciones
where comun = false and user_id is null;


-- ── PASO 2 ── La regla nueva.
--
-- Se puede ver un apunte si es de los dos, o si lo creaste tú.
-- Los apuntes antiguos no tienen dueño, pero son comunes, así que se
-- siguen viendo igual que hasta ahora.
drop policy if exists "acceso autenticado" on public.transacciones;

create policy "comunes y los mios" on public.transacciones
  for all
  using (comun = true or user_id = auth.uid())
  with check (comun = true or user_id = auth.uid());


-- ── PASO 3 ── Comprobar que la regla ha quedado puesta.
select policyname as regla, cmd as se_aplica_a
from pg_policies
where schemaname = 'public' and tablename = 'transacciones';


-- ============================================================
-- ── PASO 4 ── PARA DESHACERLO, si algo va mal.
--
-- Quitar los dos guiones de las cuatro líneas siguientes y ejecutarlas.
-- Todo vuelve a como estaba: los dos vuelven a ver todo, sin perder
-- ningún apunte.
--
-- drop policy if exists "comunes y los mios" on public.transacciones;
-- create policy "acceso autenticado" on public.transacciones
--   for all using (auth.role() = 'authenticated')
--   with check (auth.role() = 'authenticated');
-- ============================================================
