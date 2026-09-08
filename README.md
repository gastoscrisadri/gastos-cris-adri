# Gastos Cris y Adri

App de control de gastos para el móvil. Se apunta un gasto haciendo una foto
del ticket: la lee sola y rellena importe, fecha, establecimiento y categoría.

Next.js + Supabase (base de datos, usuarios y fotos) + Vercel (alojamiento).

- **App:** https://gastos-cris-adri.vercel.app
- Cada uno entra con su correo y contraseña. Sin eso no se ve nada.

## Reparto de accesos

Cris y Adri son los dueños de sus datos. **Quien mantiene el código no tiene
acceso a la base de datos**: ni a las claves, ni al panel de Supabase.

Por eso, **cualquier cambio en la base de datos se entrega como un archivo `.sql`
para que lo peguen ellos** en el Editor SQL de su Supabase. No se ejecuta desde
fuera. Los archivos de abajo son eso.

Consecuencia práctica: la copia de seguridad también la ejecutan ellos, porque
necesita la clave secreta.

## Los archivos .sql, en orden

Ya ejecutados, se guardan como historial de cómo se montó todo:

| Archivo | Qué hizo |
|---|---|
| `supabase-setup.sql` | Creó las cinco tablas, la seguridad y las categorías de partida |
| `supabase-setup-storage.sql` | Creó el almacén de las fotos de tickets |
| `supabase-cuentas-editables.sql` | Añadió a las cuentas de quién es el dinero, para el informe «Quién puso el dinero» |
| `supabase-medios-por-persona.sql` | Un Bizum y un Banco para cada uno, y el orden en que salen al apuntar |

Pendientes de ejecutar:

| Archivo | Cuándo |
|---|---|
| `supabase-cerrar-almacen-fotos.sql` | Hace privadas las fotos. Solo **después** de comprobar en el móvil que se siguen viendo |
| `supabase-borrar-pruebas.sql` | Vacía los datos de prueba antes del uso real. **Conserva categorías y cuentas** |

## Copia de seguridad

En `scripts/`. Supabase, en plan gratuito, no hace copias: la única que existe es
esta. Instrucciones para Cris y Adri en [`scripts/LEEME.md`](scripts/LEEME.md).

## Cómo está hecho por dentro

```
app/
  page.js            pantalla principal: lista, informes y ajustes
  login/page.js
  api/ocr/route.js   lee el ticket con Gemini
components/          uno por pantalla (FormTransaccion, Informes, Ajustes...)
lib/
  categorias.js      carga las categorías y subcategorías
  cuentas.js         medios de pago: orden y de quién es cada uno
  fotos.js           direcciones firmadas para ver las fotos
  supabase/          conexión con la base de datos
middleware.js        protege todas las pantallas menos la de entrada
scripts/             copia de seguridad
```

Detalles que no se deducen leyendo el código:

- **Cada móvil recuerda de quién es.** Se elige en Ajustes y se guarda en el
  propio móvil. Es una preferencia, no una medida de seguridad.
- **El informe «Quién puso el dinero»** reparte según el medio de pago, no según
  quién apuntó el gasto. Cada cuenta lleva escrito de quién es.
- **Los medios de pago salen de la base de datos**, no del código: se editan en
  Ajustes → Cuentas.
- **El OCR usa `gemini-3.1-flash-lite`**, fijo. Nunca un alias `*-latest`: en la
  app de la que viene esta, uno de esos alias acabó apuntando a un modelo sin
  cuota y falló en silencio.
- **El OCR no registra el contenido de los tickets.** Solo códigos de error, para
  que los gastos no acaben en los registros de Vercel.

## Al tocar el código

La app la usan a diario desde el móvil, así que lo primero es no romper nada:

1. Rama nueva, nunca commit directo en `main`.
2. `npx next build` limpio.
3. Probar de verdad lo que se pueda, no solo compilar.
4. Que degrade con seguridad: si algo falla, que se comporte como antes en vez
   de bloquear el guardado.
5. Fusionar con `--no-ff` explicando qué se ha verificado y qué no.
6. `main` se despliega solo en Vercel.

**Ojo:** el repositorio es **público** (hizo falta para que Vercel aceptara los
commits en el plan gratuito). No hay ninguna clave dentro, y no debe haberla.
Los datos económicos están en Supabase, protegidos por usuario y contraseña.

**Si la app deja de funcionar de golpe**, lo primero que hay que mirar es si
Supabase se ha pausado: se pausa solo tras una semana sin uso y se reactiva con
un botón en su panel.
