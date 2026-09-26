// Pruebas de las cuentas. Ver pruebas/LEEME.md
//
// Se ejecuta:  node pruebas/cuentas.mjs
//
// Importa las funciones DE VERDAD de lib/, no copias: si alguien cambia el
// cálculo, estas pruebas se enteran. Por eso el enredo de los imports: los
// archivos de lib usan rutas "@/lib/..." que solo entiende Next, así que aquí
// se leen y se reescriben al vuelo en una carpeta temporal.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { fileURLToPath } from 'url'

// fileURLToPath y no .pathname: la carpeta del proyecto lleva espacios y sin
// esto llegan como %20 y no encuentra nada.
const raiz = fileURLToPath(new URL('..', import.meta.url))
const tmp = join(tmpdir(), 'pruebas-gastos-' + Date.now())
mkdirSync(join(tmp, 'supabase'), { recursive: true })

// Un cliente de mentira: estas pruebas no tocan la base de datos.
writeFileSync(join(tmp, 'supabase', 'client.mjs'),
  'export const createClient = () => ({ auth: { updateUser: async () => ({ error: null }) } })\n')

for (const nombre of ['identidad', 'cuentas', 'apuntes', 'reparto', 'deuda', 'dequien']) {
  const texto = readFileSync(join(raiz, 'lib', nombre + '.js'), 'utf8')
    .replace(/@\/lib\/supabase\/client/g, './supabase/client.mjs')
    .replace(/@\/lib\/([a-z]+)/g, './$1.mjs')
  writeFileSync(join(tmp, nombre + '.mjs'), texto)
}

const { construirReparto } = await import(join(tmp, 'reparto.mjs'))
const { calcularDeuda } = await import(join(tmp, 'deuda.mjs'))
const { esDeLaCasa, esLiquidacion, sinAjustes, soloComunes, soloMios, gastoDeLaCasaDelMes } =
  await import(join(tmp, 'apuntes.mjs'))
const { comunYCargo } = await import(join(tmp, 'dequien.mjs'))

// ---------------------------------------------------------------- utilidades

let fallos = 0
let pasadas = 0

function comprobar(titulo, obtenido, esperado) {
  const ok = String(obtenido) === String(esperado)
  if (ok) { pasadas++; console.log('  ok   ' + titulo) }
  else {
    fallos++
    console.log('  FALLA ' + titulo)
    console.log('        esperaba: ' + esperado)
    console.log('        ha salido: ' + obtenido)
  }
}

function seccion(t) { console.log('\n' + t) }

const cuentas = [
  { nombre: 'Banco Adri', persona: 'Adri' },
  { nombre: 'Tarjeta Adri', persona: 'Adri' },
  { nombre: 'Tarjeta Cris', persona: 'Cris' },
  { nombre: 'Banco', persona: 'Común' },
]
const miParte = construirReparto([{ nombre: 'Alquiler', padre_id: 'x', porcentaje_primero: 33.3333 }])
const deuda = (ts, desde = null) => {
  const r = calcularDeuda(ts, cuentas, miParte, desde)
  return r.importe < 0.005 ? 'en paz' : `${r.deudor} debe ${r.importe.toFixed(2)} a ${r.acreedor}`
}

const alquiler = { created_at: '2026-09-03T08:00:00Z', fecha: '2026-09-03', tipo: 'gasto', importe: 1400, categoria: 'Vivienda', subcategoria: 'Alquiler', medio_pago: 'Banco Adri', comun: true }
const compra   = { created_at: '2026-09-14T10:00:00Z', fecha: '2026-09-14', tipo: 'gasto', importe: 60, categoria: 'Alimentación', medio_pago: 'Tarjeta Cris', comun: true }
const cena     = { created_at: '2026-09-14T11:00:00Z', fecha: '2026-09-14', tipo: 'gasto', importe: 40, categoria: 'Ocio', medio_pago: 'Tarjeta Adri', comun: true }
const ropaCris = { created_at: '2026-09-14T12:00:00Z', fecha: '2026-09-14', tipo: 'gasto', importe: 35, categoria: 'Ropa', medio_pago: 'Tarjeta Cris', comun: false, quien: 'Cris' }
const zapas    = { created_at: '2026-09-14T13:00:00Z', fecha: '2026-09-14', tipo: 'gasto', importe: 100, categoria: 'Ropa', medio_pago: 'Tarjeta Cris', comun: true, a_cargo_de: 'Adri', quien: 'Adri' }
const nomina   = { created_at: '2026-09-16T09:00:00Z', fecha: '2026-09-16', tipo: 'ingreso', importe: 2000, categoria: 'Nómina', medio_pago: 'Tarjeta Cris', comun: false, quien: 'Cris' }
const pago     = { created_at: '2026-09-14T22:00:00Z', fecha: '2026-09-14', tipo: 'gasto', importe: 356.67, categoria: 'Ajuste de cuentas', medio_pago: 'Tarjeta Cris', comun: true, liquidacion_a: 'Adri', quien: 'Cris' }

// ------------------------------------------------- las cifras que él verificó

seccion('LAS CIFRAS QUE ANTONIO VERIFICÓ EN EL MÓVIL')
comprobar('alquiler solo, 33,3333/66,6667 (09/09)', deuda([alquiler]), 'Cris debe 466.67 a Adri')
comprobar('la ronda completa del 14/09', deuda([alquiler, compra, cena, ropaCris, zapas, nomina]), 'Cris debe 356.67 a Adri')
comprobar('la misma, ya saldada', deuda([alquiler, compra, cena, zapas, nomina, pago]), 'en paz')

seccion('EL REPARTO')
comprobar('un gasto a medias, pagado por uno', deuda([compra]), 'Adri debe 30.00 a Cris')
comprobar('pagado con cuenta común: no lo pone nadie', deuda([alquiler, { ...compra, medio_pago: 'Banco' }]), 'Cris debe 466.67 a Adri')
comprobar('las partes del alquiler suman el importe',
  (miParte(alquiler, 'Cris') + miParte(alquiler, 'Adri')).toFixed(2), '1400.00')
comprobar('sin porcentaje configurado, a medias',
  (miParte(compra, 'Cris')).toFixed(2), '30.00')

seccion('LO PERSONAL')
comprobar('un gasto personal no mueve la cuenta', deuda([alquiler, ropaCris]), 'Cris debe 466.67 a Adri')
comprobar('lo personal cuenta entero para su dueño', miParte(ropaCris, 'Cris').toFixed(2), '35.00')
comprobar('un ingreso personal no mueve la cuenta', deuda([alquiler, nomina]), 'Cris debe 466.67 a Adri')

seccion('GASTO DE UNO PAGADO POR EL OTRO')
comprobar('le toca entero a su dueño', miParte(zapas, 'Adri').toFixed(2), '100.00')
comprobar('y cero al que puso el dinero', miParte(zapas, 'Cris').toFixed(2), '0.00')
comprobar('genera la deuda entera', deuda([zapas]), 'Adri debe 100.00 a Cris')
comprobar('NO cuenta como gasto de la casa', esDeLaCasa(zapas), false)
comprobar('un gasto común sí cuenta como de la casa', esDeLaCasa(compra), true)
comprobar('un gasto personal no cuenta como de la casa', esDeLaCasa(ropaCris), false)

seccion('LOS AJUSTES DE CUENTAS NO SON GASTO')
comprobar('el ajuste no es de la casa', esDeLaCasa(pago) && !esLiquidacion(pago), false)
comprobar('sinAjustes lo quita', sinAjustes([compra, pago]).length, 1)
comprobar('el gasto de la casa del mes no lo cuenta',
  gastoDeLaCasaDelMes([alquiler, compra, cena, ropaCris, zapas, pago], '2026-09').toFixed(2), '1500.00')
comprobar('y da igual en los dos móviles',
  gastoDeLaCasaDelMes([alquiler, compra, cena, zapas, pago], '2026-09').toFixed(2), '1500.00')

seccion('EL CIERRE DE LA CUENTA')
const CIERRE = '2026-09-17T23:00:00Z'
const trasCierre1 = { created_at: '2026-09-18T20:00:00Z', fecha: '2026-09-18', tipo: 'gasto', importe: 80, categoria: 'Ocio', medio_pago: 'Tarjeta Cris', comun: true }
const trasCierre2 = { created_at: '2026-09-19T12:00:00Z', fecha: '2026-09-19', tipo: 'gasto', importe: 40, categoria: 'Alimentación', medio_pago: 'Banco Adri', comun: true }
comprobar('sin cierre, cuenta desde el principio', deuda([alquiler, compra, cena, zapas, pago]), 'en paz')
comprobar('nada más cerrar, empieza de cero', deuda([alquiler, compra, cena, zapas, pago], CIERRE), 'en paz')
comprobar('solo cuentan los gastos posteriores', deuda([alquiler, pago, trasCierre1, trasCierre2], CIERRE), 'Adri debe 20.00 a Cris')
comprobar('un pago anterior al cierre no sigue contando', deuda([pago], CIERRE), 'en paz')
const tardio = { created_at: '2026-09-19T23:00:00Z', fecha: '2026-09-10', tipo: 'gasto', importe: 100, categoria: 'Ocio', medio_pago: 'Banco Adri', comun: true }
comprobar('un gasto viejo apuntado DESPUÉS del cierre sí cuenta', deuda([alquiler, pago, tardio], CIERRE), 'Cris debe 50.00 a Adri')

seccion('DE QUIÉN ES EL GASTO, Y QUIÉN LO VE')
//
// La regla: ves todo MENOS lo que es del otro Y lo paga el otro.
//
// Las nueve combinaciones de (de quién es) × (de quién es el medio de pago),
// mirándolo siempre desde Cris, que es quien lo está apuntando. Se resume cada
// resultado en un texto para que la prueba se lea de un tirón.
const resumen = (deQuien, medio) => {
  const { comun, a_cargo_de, duenoDelGasto } = comunYCargo(deQuien, 'Cris', medio)
  return [comun ? 'lo ven los dos' : 'privado',
          a_cargo_de ? 'a cargo de ' + a_cargo_de : 'se reparte',
          duenoDelGasto ? 'guardado a nombre de ' + duenoDelGasto : 'a mi nombre'].join(' · ')
}

// De los dos: nunca es privado y nunca se carga a nadie, pague quien pague.
comprobar('de los dos, con tarjeta de Cris', resumen('dos', 'Cris'), 'lo ven los dos · se reparte · a mi nombre')
comprobar('de los dos, con tarjeta de Adri', resumen('dos', 'Adri'), 'lo ven los dos · se reparte · a mi nombre')
comprobar('de los dos, con cuenta común', resumen('dos', 'Común'), 'lo ven los dos · se reparte · a mi nombre')

// Solo mío (soy Cris). Privado solo si además lo pago yo.
comprobar('mío y lo pago yo: solo lo veo yo', resumen('mio', 'Cris'), 'privado · se reparte · guardado a nombre de Cris')
comprobar('mío pero lo paga Adri: lo vemos los dos y me lo cargan', resumen('mio', 'Adri'), 'lo ven los dos · a cargo de Cris · a mi nombre')
comprobar('mío pero sale de la común: lo vemos los dos', resumen('mio', 'Común'), 'lo ven los dos · a cargo de Cris · a mi nombre')

// Gasto de Adri, apuntado por Cris. Aquí está lo nuevo: si lo paga Adri, deja
// de verlo Cris aunque sea Cris quien lo teclea.
comprobar('de Adri y lo paga Adri: lo apunto y deja de ser mío', resumen('otro', 'Adri'), 'privado · se reparte · guardado a nombre de Adri')
comprobar('de Adri pero lo pago yo: lo vemos los dos y se lo cargan', resumen('otro', 'Cris'), 'lo ven los dos · a cargo de Adri · a mi nombre')
comprobar('de Adri pero sale de la común: lo vemos los dos', resumen('otro', 'Común'), 'lo ven los dos · a cargo de Adri · a mi nombre')

// Un medio de pago sin dueño no puede volver privado nada.
comprobar('mío con medio sin asignar: no es privado', resumen('mio', 'Sin asignar'), 'lo ven los dos · a cargo de Cris · a mi nombre')

// Un ingreso no pregunta de quién es: es de quien lo cobra, y nunca común.
comprobar('un ingreso es siempre de quien lo cobra',
  JSON.stringify(comunYCargo('dos', 'Cris', 'Común', 'ingreso')),
  JSON.stringify({ comun: false, a_cargo_de: null, duenoDelGasto: 'Cris' }))

seccion('LAS COPIAS DE SEGURIDAD')
const todos = [alquiler, compra, cena, ropaCris, zapas, nomina, pago]
comprobar('la copia de los dos no lleva nada personal',
  soloComunes(todos).filter(t => t.comun === false).length, 0)
comprobar('la copia de los dos sí lleva lo pagado por el otro',
  soloComunes(todos).some(t => t.a_cargo_de === 'Adri'), true)
comprobar('la copia personal solo lleva lo personal',
  soloMios(todos).every(t => t.comun === false), true)

// ------------------------------------------------------------------- resumen

rmSync(tmp, { recursive: true, force: true })
console.log('\n' + '─'.repeat(50))
console.log(`${pasadas} pruebas pasadas, ${fallos} fallos`)
if (fallos > 0) process.exit(1)
