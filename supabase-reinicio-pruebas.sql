-- ============================================================
-- Gastos Cris y Adri — EMPEZAR DE CERO PARA LAS PRUEBAS DE SEPTIEMBRE
--
-- Pegar entero en el Editor SQL de Supabase y pulsar "Run".
--
-- QUÉ HACE
--   1. Borra TODOS los apuntes, eventos y gastos fijos de las pruebas.
--   2. Borra las categorías viejas y pone las pensadas para vosotros.
--   3. Deja el alquiler repartido a dos tercios / un tercio.
--   4. Crea el gasto fijo del alquiler: 1.400 € el día 3 de cada mes.
--   5. Pone los saldos de las cuentas a cero.
--
--   NO toca los usuarios ni las cuentas (Tarjeta Cris, Bizum Adri...).
--
-- ¡OJO! Esto borra todo lo apuntado hasta ahora. Es lo que queremos
-- para empezar las pruebas limpios, pero no lo ejecutéis en octubre
-- cuando ya haya gastos de verdad.
-- ============================================================


-- ── 1. Fuera los datos de prueba ────────────────────────────
delete from public.transacciones;
delete from public.eventos;
delete from public.apuntes_recurrentes;
update public.cuentas set saldo_inicial = 0;


-- ── 2. Permitir porcentajes con decimales ───────────────────
-- Estaba como número entero y 66,6666 no cabía.
alter table public.categorias
  alter column porcentaje_primero type numeric(7,4)
  using porcentaje_primero::numeric;


-- ── 3. Fuera las categorías viejas ──────────────────────────
delete from public.categorias;


-- ── 4. Las categorías nuevas ────────────────────────────────
do $$
declare v_padre bigint;
begin

  -- ---------- GASTOS ----------
  insert into public.categorias (nombre, tipo, orden) values ('Vivienda', 'gasto', 1) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Alquiler', 'gasto', v_padre, 1), ('Comunidad', 'gasto', v_padre, 2),
    ('Seguro de hogar', 'gasto', v_padre, 3), ('Reparaciones', 'gasto', v_padre, 4),
    ('Muebles y menaje', 'gasto', v_padre, 5);

  insert into public.categorias (nombre, tipo, orden) values ('Suministros', 'gasto', 2) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Luz', 'gasto', v_padre, 1), ('Agua', 'gasto', v_padre, 2), ('Gas', 'gasto', v_padre, 3),
    ('Internet', 'gasto', v_padre, 4), ('Móvil Cris', 'gasto', v_padre, 5),
    ('Móvil Adri', 'gasto', v_padre, 6), ('Basuras', 'gasto', v_padre, 7);

  insert into public.categorias (nombre, tipo, orden) values ('Alimentación', 'gasto', 3) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Supermercado', 'gasto', v_padre, 1), ('Frutería', 'gasto', v_padre, 2),
    ('Panadería', 'gasto', v_padre, 3), ('Carnicería y pescadería', 'gasto', v_padre, 4),
    ('Bazar', 'gasto', v_padre, 5);

  insert into public.categorias (nombre, tipo, orden) values ('Casa y limpieza', 'gasto', 4) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Productos de limpieza', 'gasto', v_padre, 1), ('Droguería', 'gasto', v_padre, 2),
    ('Menaje', 'gasto', v_padre, 3);

  insert into public.categorias (nombre, tipo, orden) values ('Suscripciones', 'gasto', 5) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Netflix', 'gasto', v_padre, 1), ('Spotify', 'gasto', v_padre, 2),
    ('Amazon Prime', 'gasto', v_padre, 3), ('Disney o HBO', 'gasto', v_padre, 4),
    ('iCloud o Google', 'gasto', v_padre, 5), ('Prensa', 'gasto', v_padre, 6);

  insert into public.categorias (nombre, tipo, orden) values ('Ocio', 'gasto', 6) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Restaurantes', 'gasto', v_padre, 1), ('Bares y cañas', 'gasto', v_padre, 2),
    ('Cine y teatro', 'gasto', v_padre, 3), ('Conciertos', 'gasto', v_padre, 4),
    ('Planes de finde', 'gasto', v_padre, 5);

  insert into public.categorias (nombre, tipo, orden) values ('Viajes', 'gasto', 7) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Transporte', 'gasto', v_padre, 1), ('Alojamiento', 'gasto', v_padre, 2),
    ('Comidas de viaje', 'gasto', v_padre, 3), ('Actividades', 'gasto', v_padre, 4);

  insert into public.categorias (nombre, tipo, orden) values ('Transporte', 'gasto', 8) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Abono transporte', 'gasto', v_padre, 1), ('Taxi y VTC', 'gasto', v_padre, 2),
    ('Tren y autobús', 'gasto', v_padre, 3), ('Gasolina', 'gasto', v_padre, 4),
    ('Parking', 'gasto', v_padre, 5), ('Bici o patinete', 'gasto', v_padre, 6);

  insert into public.categorias (nombre, tipo, orden) values ('Salud', 'gasto', 9) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Farmacia', 'gasto', v_padre, 1), ('Médico y dentista', 'gasto', v_padre, 2),
    ('Seguro médico', 'gasto', v_padre, 3), ('Fisioterapia', 'gasto', v_padre, 4),
    ('Óptica', 'gasto', v_padre, 5);

  insert into public.categorias (nombre, tipo, orden) values ('Deporte', 'gasto', 10) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Gimnasio', 'gasto', v_padre, 1), ('Clases', 'gasto', v_padre, 2),
    ('Material deportivo', 'gasto', v_padre, 3);

  insert into public.categorias (nombre, tipo, orden) values ('Ropa y calzado', 'gasto', 11) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Ropa', 'gasto', v_padre, 1), ('Calzado', 'gasto', v_padre, 2),
    ('Complementos', 'gasto', v_padre, 3), ('Tintorería', 'gasto', v_padre, 4);

  insert into public.categorias (nombre, tipo, orden) values ('Cuidado personal', 'gasto', 12) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Peluquería', 'gasto', v_padre, 1), ('Cosmética y perfumería', 'gasto', v_padre, 2),
    ('Estética', 'gasto', v_padre, 3);

  insert into public.categorias (nombre, tipo, orden) values ('Regalos y celebraciones', 'gasto', 13) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Cumpleaños', 'gasto', v_padre, 1), ('Bodas y bautizos', 'gasto', v_padre, 2),
    ('Navidad', 'gasto', v_padre, 3), ('Detalles', 'gasto', v_padre, 4);

  insert into public.categorias (nombre, tipo, orden) values ('Mascotas', 'gasto', 14) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Comida', 'gasto', v_padre, 1), ('Veterinario', 'gasto', v_padre, 2),
    ('Accesorios', 'gasto', v_padre, 3), ('Peluquería canina', 'gasto', v_padre, 4);

  insert into public.categorias (nombre, tipo, orden) values ('Formación', 'gasto', 15) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Cursos', 'gasto', v_padre, 1), ('Idiomas', 'gasto', v_padre, 2),
    ('Libros', 'gasto', v_padre, 3);

  insert into public.categorias (nombre, tipo, orden) values ('Impuestos y comisiones', 'gasto', 16) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Comisiones del banco', 'gasto', v_padre, 1), ('Impuestos', 'gasto', v_padre, 2),
    ('Multas', 'gasto', v_padre, 3);

  insert into public.categorias (nombre, tipo, orden) values ('Ahorro e inversión', 'gasto', 17) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Fondo de emergencia', 'gasto', v_padre, 1), ('Inversión', 'gasto', v_padre, 2),
    ('Plan de pensiones', 'gasto', v_padre, 3);

  insert into public.categorias (nombre, tipo, orden) values
    ('Gastos de Cris', 'gasto', 18),
    ('Gastos de Adri', 'gasto', 19),
    ('Varios e imprevistos', 'gasto', 20);

  -- ---------- INGRESOS ----------
  insert into public.categorias (nombre, tipo, orden) values
    ('Nómina Cris', 'ingreso', 1),
    ('Nómina Adri', 'ingreso', 2),
    ('Pagas extra', 'ingreso', 3),
    ('Bizum recibido', 'ingreso', 5);

  insert into public.categorias (nombre, tipo, orden) values ('Devoluciones', 'ingreso', 4) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Hacienda', 'ingreso', v_padre, 1), ('Compras devueltas', 'ingreso', v_padre, 2);

  insert into public.categorias (nombre, tipo, orden) values ('Venta de segunda mano', 'ingreso', 6) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Wallapop', 'ingreso', v_padre, 1), ('Vinted', 'ingreso', v_padre, 2),
    ('Otros', 'ingreso', v_padre, 3);

  insert into public.categorias (nombre, tipo, orden) values ('Ayudas y becas', 'ingreso', 7) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Ayuda al alquiler joven', 'ingreso', v_padre, 1), ('Otras ayudas', 'ingreso', v_padre, 2);

  insert into public.categorias (nombre, tipo, orden) values ('Otros ingresos', 'ingreso', 8) returning id into v_padre;
  insert into public.categorias (nombre, tipo, padre_id, orden) values
    ('Regalos en dinero', 'ingreso', v_padre, 1), ('Intereses', 'ingreso', v_padre, 2);

end $$;


-- ── 5. El alquiler, a dos tercios y un tercio ───────────────
-- El número es lo que paga CRIS. 33,3333 = Cris un tercio, Adri dos tercios.
-- Si es al revés, se cambia en Ajustes → Categorías con dos toques.
update public.categorias
set porcentaje_primero = 33.3333
where nombre = 'Alquiler' and padre_id is not null;


-- ── 6. El alquiler como gasto fijo, día 3 ───────────────────
-- Ojo al medio de pago: es lo que decide quién lo paga y, por tanto,
-- la cuenta de los dos. Cámbialo en Ajustes → Fijos si no es este.
insert into public.apuntes_recurrentes
  (nombre, importe, tipo, categoria, subcategoria, establecimiento, medio_pago, dia_mes, activo)
values
  ('Alquiler', 1400, 'gasto', 'Vivienda', 'Alquiler', 'Alquiler del piso', 'Banco Adri', 3, true);


-- ── 7. Comprobación ─────────────────────────────────────────
select 'apuntes'      as cosa, count(*)::text as cuantos from public.transacciones
union all select 'categorías de gasto',    count(*)::text from public.categorias where tipo = 'gasto' and padre_id is null
union all select 'subcategorías de gasto', count(*)::text from public.categorias where tipo = 'gasto' and padre_id is not null
union all select 'categorías de ingreso',  count(*)::text from public.categorias where tipo = 'ingreso' and padre_id is null
union all select 'gastos fijos',           count(*)::text from public.apuntes_recurrentes
union all select 'reparto del alquiler (% de Cris)',
       coalesce((select porcentaje_primero::text from public.categorias where nombre = 'Alquiler'), 'sin poner');
