'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { ocultar, euros, euros0 } from '@/lib/cifras'
import { cargarCuentas, personaDeMedioPago, soloActivas, CUENTAS_RESPALDO } from '@/lib/cuentas'
import { NOMBRES, nombreDe } from '@/lib/identidad'
import { cargarCategorias } from '@/lib/categorias'
import { hoy } from '@/lib/fechas'
import { construirReparto } from '@/lib/reparto'
import { calcularDeuda, gastosComunesDesde } from '@/lib/deuda'
// Las reglas de qué es cada apunte viven en lib/apuntes.js, no aquí: las usan
// también la portada y lo que venga, y copiarlas es lo que ha causado que un
// arreglo entrara en una pantalla y no en su gemela.
import { esLiquidacion, sinAjustes, esDeLaCasa, soloComunes, soloMios, soloConjunto } from '@/lib/apuntes'

const COLORES = [
  '#ef4444','#f97316','#eab308','#84cc16','#22c55e',
  '#14b8a6','#3b82f6','#8b5cf6','#ec4899','#f43f5e',
  '#0ea5e9','#a855f7','#10b981','#f59e0b','#6366f1',
  '#d946ef','#64748b',
]

// "17 de septiembre" a partir de la fecha y hora que guarda la base de datos.
const fechaCorta = iso => {
  try {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' })
  } catch { return '' }
}

const EMOJI_PERSONA = {
  'Cris': '👤',
  'Adri': '👤',
  'Común': '🤝',
  'Sin asignar': '❔',
}


// Una línea de apunte dentro de un desplegable. Se usa en las cuatro listas
// (categoría, subcategoría, medio de pago y quién puso el dinero); "extra" es
// el dato que cambia según dónde se muestre: el medio de pago cuando ya
// sabemos la categoría, y la categoría en los demás casos.
function FilaApunte({ t, mostrarCifras, extra, yo }) {
  const importe = Number(t.importe)
  // Un ajuste de cuentas se lee al revés según quién mire: al que cobra le
  // entra dinero, no le sale. Mismo criterio que en ListaTransacciones.js.
  const loCobroYo = !!t.liquidacion_a && !!yo && t.liquidacion_a === yo
  const esGasto = t.tipo === 'gasto' && importe >= 0 && !loCobroYo
  const [, mesN, dia] = t.fecha.split('-')
  const fechaCorta = `${parseInt(dia)}/${parseInt(mesN)}`
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/50">
      <span className="text-xs text-gray-400 w-10 shrink-0">{fechaCorta}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700 truncate">
          {t.liquidacion_a && yo
            ? (loCobroYo ? `${t.quien} te pagó` : `Le pagaste a ${t.liquidacion_a}`)
            : (t.establecimiento || t.descripcion || t.subcategoria || t.categoria)}
        </p>
        {t.descripcion && t.establecimiento && (
          <p className="text-[10px] text-gray-400 truncate">{t.descripcion}</p>
        )}
      </div>
      {extra}
      <span className={`text-xs font-bold shrink-0 ${esGasto ? 'text-red-500' : 'text-emerald-500'}`}>
        {ocultar(mostrarCifras, `${esGasto ? '−' : '+'}${euros(Math.abs(importe))} €`)}
      </span>
    </div>
  )
}

function TarjetaComparativa({ label, actual, anterior, colorActual, colorBg, etiquetaAnterior, mostrarCifras }) {
  const diff = anterior > 0 ? ((actual - anterior) / anterior) * 100 : null
  const sube = diff > 0
  const igual = diff === null || Math.abs(diff) < 0.5

  return (
    <div className={`${colorBg} rounded-2xl p-3 space-y-1`}>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${colorActual}`}>{ocultar(mostrarCifras, `${euros(actual)} €`)}</p>
      <div className="flex items-center gap-1">
        {igual ? (
          <span className="text-xs text-gray-400">Sin datos anteriores</span>
        ) : (
          <>
            <span className={`text-xs font-bold ${sube ? 'text-red-500' : 'text-emerald-600'}`}>
              {sube ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
            </span>
            <span className="text-xs text-gray-400">vs {etiquetaAnterior || 'mes ant.'} ({ocultar(mostrarCifras, `${euros0(anterior)} €`)})</span>
          </>
        )}
      </div>
    </div>
  )
}

// Exportar a Excel de verdad (.xlsx), no a CSV.
//
// Un CSV es texto pelado: no puede llevar dentro cómo se pinta un número, así
// que los importes salían como 1400 en vez de 1.400,00. En un .xlsx el
// formato va dentro del archivo, y además el importe es un NÚMERO, no texto:
// se puede sumar, ordenar y filtrar.
//
// La librería se carga solo al pulsar el botón (import dinámico), para que no
// pese en el arranque de la app en el móvil.
async function exportarExcel(transacciones, nombreArchivo) {
  const XLSX = await import('xlsx')

  const cabecera = ['Fecha', 'Tipo', 'Importe (€)', 'Categoría', 'Subcategoría', 'Establecimiento', 'Notas', 'Medio de pago', 'Quién', 'De los dos o personal', 'Ajuste de cuentas a']
  const filas = transacciones.map(t => [
    t.fecha,
    t.tipo === 'gasto' && Number(t.importe) < 0 ? 'Devolución o cobro' : t.tipo,
    Number(Number(t.importe).toFixed(2)),   // número, no texto
    t.categoria || '',
    t.subcategoria || '',
    t.establecimiento || '',
    t.descripcion || '',
    t.medio_pago || '',
    t.quien || '',
    t.comun === false ? 'Personal' : 'De los dos',
    t.liquidacion_a || '',
  ])

  const hoja = XLSX.utils.aoa_to_sheet([cabecera, ...filas])

  // Punto de miles y dos decimales siempre, también cuando son ,00.
  // La columna del importe es la tercera (índice 2).
  const FORMATO_EUROS = '#,##0.00'
  for (let fila = 1; fila <= filas.length; fila++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: 2 })]
    if (celda) { celda.t = 'n'; celda.z = FORMATO_EUROS }
  }

  // Anchos para no tener que ajustarlos a mano cada vez
  hoja['!cols'] = [
    { wch: 11 }, { wch: 18 }, { wch: 13 }, { wch: 18 }, { wch: 18 },
    { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 18 },
  ]
  hoja['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: cabecera.length - 1 } }) }

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Apuntes')
  XLSX.writeFile(libro, nombreArchivo)
}

// Los totales de un mes. Se llama dos veces con listas distintas: la del mes
// entero y la que deja pasar el filtro De los dos / Míos. Al ser la misma
// función, las dos dan cifras calculadas exactamente igual.
function calcularDatos(lista, cuentas) {
    // Las liquidaciones quedan fuera de todos los totales: no son gasto.
    const delMes = lista.filter(t => !esLiquidacion(t))
    const gastos = delMes.filter(t => t.tipo === 'gasto')
    const ingresos = delMes.filter(t => t.tipo === 'ingreso')
    const totalGastos = gastos.reduce((s, t) => s + Number(t.importe), 0)
    const totalIngresos = ingresos.reduce((s, t) => s + Number(t.importe), 0)

    const porCategoria = {}
    delMes.forEach(t => {
      if (!porCategoria[t.categoria]) porCategoria[t.categoria] = { gasto: 0, ingreso: 0 }
      porCategoria[t.categoria][t.tipo] += Number(t.importe)
    })

    const categorias = Object.entries(porCategoria)
      .map(([nombre, vals]) => ({ nombre, ...vals, total: vals.gasto + vals.ingreso }))
      .sort((a, b) => b.total - a.total)

    // Por medio de pago
    const porMedio = {}
    delMes.forEach(t => {
      if (!t.medio_pago) return
      if (!porMedio[t.medio_pago]) porMedio[t.medio_pago] = { gasto: 0, ingreso: 0 }
      porMedio[t.medio_pago][t.tipo] += Number(t.importe)
    })
    const medios = Object.entries(porMedio)
      .map(([nombre, vals]) => ({ nombre, gasto: vals.gasto || 0, ingreso: vals.ingreso || 0 }))
      .sort((a, b) => b.gasto - a.gasto)

    // Por persona: cuánto ha puesto de su bolsillo cada uno este mes
    const porPersona = {}
    delMes.forEach(t => {
      const quien = personaDeMedioPago(t.medio_pago, cuentas)
      if (!porPersona[quien]) porPersona[quien] = { gasto: 0, ingreso: 0 }
      porPersona[quien][t.tipo] += Number(t.importe)
    })
    const personas = Object.entries(porPersona)
      .map(([nombre, vals]) => ({ nombre, gasto: vals.gasto || 0, ingreso: vals.ingreso || 0 }))
      .sort((a, b) => b.gasto - a.gasto)


    return { totalGastos, totalIngresos, balance: totalIngresos - totalGastos, categorias, medios, personas }
}

// `seccion` dice cuál de las dos pantallas se está pintando:
//
//   'informes' — en qué se ha ido el dinero este mes (y, desplegable al final,
//                la comparación con otros meses y el año).
//   'balance'  — la cuenta de los dos: quién debe a quién, saldar, cerrar.
//
// Las dos viven en el mismo archivo a propósito. Comparten el cálculo de la
// deuda, las cuentas, el reparto y el historial; partirlo en dos componentes
// obligaría a pasar quince cosas de una a otra, y cada una de esas quince es
// un sitio donde equivocarse. Lo que cambia es qué se pinta, no qué se calcula.
export default function Informes({ transacciones, mostrarCifras, onCambio, onCopiaDescargada, abrirEn, seccion = 'informes', onSaldar }) {
  // Se cargan antes que nada: de ellas salen los emojis, los saldos y
  // el reparto de "quién puso el dinero".
  const [cuentas, setCuentas] = useState(CUENTAS_RESPALDO)
  useEffect(() => { cargarCuentas().then(setCuentas) }, [])
  // Quién está mirando la pantalla, para no enseñarle el saldo de las cuentas
  // del otro. Si no se consigue averiguar, se enseñan todas, como siempre.
  const [yo, setYo] = useState('')
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setYo(nombreDe(data?.user)))
  }, [])

  // Para saber si alguna categoría no va a medias (p. ej. el alquiler)
  // El último cierre: desde ahí empieza a contar la cuenta de los dos. Si no
  // hay ninguno, queda en null y todo se calcula como siempre, desde el
  // principio.
  const [ultimoCierre, setUltimoCierre] = useState(null)
  // Se traen todos, no solo el último: hacen falta para el historial. El
  // último es el que manda en el cálculo.
  const [cierres, setCierres] = useState([])
  const cargarCierres = useCallback(async () => {
    const { data } = await createClient()
      .from('cierres').select('id, created_at, quien')
      .order('created_at', { ascending: false })
    setCierres(data || [])
    setUltimoCierre(data?.[0] || null)
  }, [])
  useEffect(() => { cargarCierres() }, [cargarCierres])

  const [categoriasReparto, setCategoriasReparto] = useState([])
  useEffect(() => { cargarCategorias().then(setCategoriasReparto) }, [])

  const meses = useMemo(() => {
    const set = new Set(transacciones.map(t => t.fecha.slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [transacciones])

  const [mesSeleccionado, setMesSeleccionado] = useState(meses[0] || '')
  const [tabActiva, setTabActiva] = useState('gasto')
  // Informes se divide en tres pestañas para que cada pregunta tenga su
  // sitio: el mes corriente, la cuenta entre los dos, y el histórico.
  // abrirEn deja que la portada mande abrir esta pantalla en un sitio concreto:
  // el resumen del mes cerrado lleva directo a saldar la cuenta.
  // El Histórico ya no es una pestaña hermana de las demás: es un "quiero
  // profundizar" que se despliega al final de Informes. Se guarda si está
  // abierto o cerrado, nada más.
  const [verHistorico, setVerHistorico] = useState(abrirEn?.vista === 'historico')
  // De quién son los apuntes que se enseñan en "Mes": todo, los de los dos,
  // o los particulares de quien mira. Arranca en los de los dos.
  const [deQuien, setDeQuien] = useState('comunes')  // 'comunes' | 'mios'

  useEffect(() => {
    if (meses.length && !mesSeleccionado) setMesSeleccionado(meses[0])
  }, [meses, mesSeleccionado])

  // Cuánto de cada apunte es tuyo. La regla vive en lib/reparto.js para que la
  // portada y los informes no puedan decir cosas distintas.
  // (El cálculo de la deuda tiene la suya propia y no se toca: está verificado.)
  const miParte = useMemo(() => construirReparto(categoriasReparto), [categoriasReparto])

  const transaccionesMes = useMemo(() =>
    transacciones.filter(t => t.fecha.startsWith(mesSeleccionado))
  , [transacciones, mesSeleccionado])


  // Qué apuntes se enseñan en la pestaña "Mes". Por defecto, los de los dos:
  // es lo que más miran. "Míos" es donde cada uno ve sus gastos particulares.
  const transaccionesVista = useMemo(() => {
    if (deQuien === 'comunes') return transaccionesMes.filter(esDeLaCasa)
    if (deQuien === 'mios') {
      // Sin saber quién mira no se puede repartir: se enseñan al menos los
      // gastos particulares, que es lo que hacía antes.
      if (!yo) return transaccionesMes.filter(t => t.comun === false)
      return transaccionesMes.map(t => ({ ...t, importe: miParte(t, yo) }))
    }
    return transaccionesMes
  }, [transaccionesMes, deQuien, yo, miParte])

  const datosVista = useMemo(() => calcularDatos(transaccionesVista, cuentas), [transaccionesVista, cuentas])

  // El mismo mes, pero como lo cuenta el Histórico
  const datosHist = useMemo(() => calcularDatos(soloConjunto(transaccionesMes), cuentas), [transaccionesMes, cuentas])

  // Lo que han gastado entre los dos este mes. No depende del filtro: es la
  // cifra de la tarjeta de arriba, y tiene que salir igual en los dos móviles.
  const gastoConjuntoMes = useMemo(() =>
    transaccionesMes.filter(t => t.tipo === 'gasto' && esDeLaCasa(t) && !esLiquidacion(t))
      .reduce((s, t) => s + Number(t.importe), 0)
  , [transaccionesMes])

  // La cuenta de los dos NO es del mes: es un saldo acumulado desde el
  // principio, como se acordó. Por eso se calcula sobre todas las
  // transacciones y no sobre las del mes seleccionado.
  // El cálculo vive en lib/deuda.js: lo usan esta pantalla y el resumen del
  // mes cerrado de la portada. Aquí solo se envuelve para no recalcularlo
  // en cada repintado.
  const deuda = useMemo(
    () => calcularDeuda(transacciones, cuentas, miParte, ultimoCierre?.created_at || null),
    [transacciones, cuentas, miParte, ultimoCierre]
  )

  // Quién ha puesto el dinero de los dos DESDE EL ÚLTIMO CIERRE.
  //
  // Antes esta tarjeta era del mes y vivía debajo de una cuenta que es
  // acumulada: el total de arriba y el de abajo hablaban de periodos
  // distintos. Ahora las dos miran lo mismo.
  //
  // Los importes NO se vuelven a sumar aquí: salen de deuda.pagado, que es la
  // cifra ya verificada que usa la propia cuenta. Lo único que se calcula es
  // la lista de apuntes que hay detrás de cada cifra, y sale del mismo filtro
  // (gastosComunesDesde), así que la lista y el total no pueden separarse.
  const comunesAcumulados = useMemo(
    () => gastosComunesDesde(transacciones, ultimoCierre?.created_at || null),
    [transacciones, ultimoCierre]
  )
  const quienPuso = useMemo(() => {
    const puestos = NOMBRES.map(n => ({ nombre: n, puesto: deuda.pagado[n] || 0 }))
    const total = puestos.reduce((s, p) => s + p.puesto, 0)
    return { lista: puestos.filter(p => p.puesto > 0), total }
  }, [deuda])

  // Cerrar la cuenta: a partir de ahora se empieza de cero.
  //
  // SOLO se puede cuando el saldo está a cero. Es lo que hace que sea seguro:
  // si se pudiera cerrar debiendo 200 €, esos 200 € desaparecerían. Como no
  // hay nada que repartir, da igual cuál de los dos lo cierre.
  const [cerrando, setCerrando] = useState(false)
  async function cerrarCuenta() {
    if (deuda.importe >= 0.01) return   // cinturón: el botón ya no sale, pero por si acaso
    setCerrando(true)
    const { error } = await createClient().from('cierres').insert([{ quien: yo || null }])
    setCerrando(false)
    if (error) return
    await cargarCierres()
    onCambio?.()
  }

  // Deshacer el último cierre. Al quitarlo, la cuenta vuelve a contar desde el
  // cierre anterior (o desde el principio si no había otro): no se pierde
  // nada, los apuntes siguen todos ahí. Es la red de seguridad por si alguien
  // pulsa "cerrar" sin querer.
  const [confirmandoDeshacer, setConfirmandoDeshacer] = useState(false)
  async function deshacerCierre() {
    if (!ultimoCierre) return
    await createClient().from('cierres').delete().eq('id', ultimoCierre.id)
    setConfirmandoDeshacer(false)
    await cargarCierres()
    onCambio?.()
  }

  // Pagos entre ellos y cierres, mezclados en una sola línea de tiempo: es
  // como se entiende la historia ("saldamos, saldamos, cerramos, y desde ahí").
  const historial = useMemo(() => {
    const pagos = transacciones.filter(esLiquidacion).map(t => ({
      clave: `p${t.id}`,
      cuando: t.created_at || `${t.fecha}T00:00:00Z`,
      tipo: 'pago',
      texto: `${t.quien} pagó ${euros(Number(t.importe))} € a ${t.liquidacion_a}`,
    }))
    const marcas = cierres.map(c => ({
      clave: `c${c.id}`,
      cuando: c.created_at,
      tipo: 'cierre',
      texto: c.quien ? `Cuenta cerrada por ${c.quien}` : 'Cuenta cerrada',
    }))
    return [...pagos, ...marcas].sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)))
  }, [transacciones, cierres])

  const [historialAbierto, setHistorialAbierto] = useState(false)

  async function anotarPago() {
    const importe = parseFloat(String(importeSaldo).replace(',', '.'))
    if (!importe || importe <= 0) { setErrorSaldo('Pon un importe.'); return }
    if (!medioSaldo) { setErrorSaldo('Elige con qué lo has pagado.'); return }

    setGuardandoSaldo(true)
    setErrorSaldo('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('transacciones').insert([{
      fecha: hoy(),
      importe,
      tipo: 'gasto',
      categoria: 'Ajuste de cuentas',
      establecimiento: `Pago a ${deuda.acreedor}`,
      medio_pago: medioSaldo,
      quien: deuda.deudor,
      liquidacion_a: deuda.acreedor,
      comun: true,          // la ven los dos: es cosa de los dos
      user_id: user?.id || null,
    }])
    setGuardandoSaldo(false)
    if (error) { setErrorSaldo('No se ha podido guardar. Inténtalo otra vez.'); return }
    setSaldando(false)
    setImporteSaldo('')
    setMedioSaldo('')
    onCambio?.()
  }

  const datosTorta = useMemo(() => {
    const campo = tabActiva === 'gasto' ? 'gasto' : 'ingreso'
    const total = datosVista.categorias.reduce((s, c) => s + (c[campo] || 0), 0)
    return datosVista.categorias
      .filter(c => (c[campo] || 0) > 0)
      .map(c => ({
        nombre: c.nombre,
        valor: c[campo],
        pct: total > 0 ? Math.round((c[campo] / total) * 100) : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [datosVista, tabActiva])

  const totalTab = datosTorta.reduce((s, d) => s + d.valor, 0)
  const [categoriaAbierta, setCategoriaAbierta] = useState(null)
  const [subcategoriaAbierta, setSubcategoriaAbierta] = useState(null)
  const [medioAbierto, setMedioAbierto] = useState(null)
  const [personaAbierta, setPersonaAbierta] = useState(null)
  const [saldando, setSaldando] = useState(!!abrirEn?.saldar)
  const [importeSaldo, setImporteSaldo] = useState('')
  const [medioSaldo, setMedioSaldo] = useState('')
  const [guardandoSaldo, setGuardandoSaldo] = useState(false)
  const [errorSaldo, setErrorSaldo] = useState('')
  const [mesComparacion, setMesComparacion] = useState(null)

  const transaccionesComp = useMemo(() =>
    mesComparacion ? transacciones.filter(t => t.fecha.startsWith(mesComparacion)) : []
  , [transacciones, mesComparacion])

  const datosComp = useMemo(() => {
    if (!mesComparacion) return null
    const delMes = sinAjustes(soloConjunto(transaccionesComp))
    const gastos = delMes.filter(t => t.tipo === 'gasto')
    const ingresos = delMes.filter(t => t.tipo === 'ingreso')
    const totalGastos = gastos.reduce((s, t) => s + Number(t.importe), 0)
    const totalIngresos = ingresos.reduce((s, t) => s + Number(t.importe), 0)
    const porCategoria = {}
    delMes.forEach(t => {
      if (!porCategoria[t.categoria]) porCategoria[t.categoria] = { gasto: 0, ingreso: 0 }
      porCategoria[t.categoria][t.tipo] += Number(t.importe)
    })
    return { totalGastos, totalIngresos, balance: totalIngresos - totalGastos, porCategoria }
  }, [transaccionesComp, mesComparacion])
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('eventos').select('id, nombre, presupuesto').then(({ data }) => {
      if (data) setEventos(data)
    })
  }, [])

  // Saldo actual de cada cuenta = saldo_inicial + ingresos - gastos de TODAS las transacciones
  // Solo las cuentas propias y las comunes. La del otro no se enseña: su
  // saldo saldría mal, porque desde aquí no se ven sus apuntes personales, y
  // un número incompleto no se distingue de uno correcto. Se esconde solo si
  // la cuenta es claramente del otro de los dos; ante la duda, se enseña.
  // Lo que le queda a quien mira: sus ingresos menos su parte de los gastos.
  // Un gasto de los dos NO cuenta entero: cuenta la parte que le toca según el
  // reparto. Si no se sabe quién mira, devuelve null y se enseña el balance de
  // siempre, como hasta ahora.
  const miBalanceMes = useMemo(() => {
    if (!yo) return null
    const delMes = sinAjustes(transaccionesMes)
    const ingresos = delMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + miParte(t, yo), 0)
    const gastos = delMes.filter(t => t.tipo === 'gasto').reduce((s, t) => s + miParte(t, yo), 0)
    return { ingresos, gastos, queda: ingresos - gastos }
  }, [transaccionesMes, yo, miParte])

  // Reset al cambiar mes o tab
  useMemo(() => { setCategoriaAbierta(null); setSubcategoriaAbierta(null); setMedioAbierto(null) }, [mesSeleccionado, tabActiva])

  // Eventos con actividad en el mes seleccionado
  const eventosDelMes = useMemo(() => {
    const conEvento = transaccionesMes.filter(t => t.evento_id && t.tipo === 'gasto')
    const mapa = {}
    conEvento.forEach(t => {
      if (!mapa[t.evento_id]) mapa[t.evento_id] = { total: 0, count: 0 }
      mapa[t.evento_id].total += Number(t.importe)
      mapa[t.evento_id].count += 1
    })
    return Object.entries(mapa).map(([id, vals]) => ({
      id,
      nombre: eventos.find(e => e.id === id)?.nombre || 'Evento',
      presupuesto: eventos.find(e => e.id === id)?.presupuesto || null,
      ...vals,
    })).sort((a, b) => b.total - a.total)
  }, [transaccionesMes, eventos])

  // Mes anterior
  const mesAnterior = useMemo(() => {
    if (!mesSeleccionado) return ''
    const [a, m] = mesSeleccionado.split('-')
    const d = new Date(parseInt(a), parseInt(m) - 1, 1)
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [mesSeleccionado])

  const datosMesAnterior = useMemo(() => {
    const ts = sinAjustes(soloConjunto(transacciones.filter(t => t.fecha.startsWith(mesAnterior))))
    return {
      gastos: ts.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0),
      ingresos: ts.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.importe), 0),
    }
  }, [transacciones, mesAnterior])

  // Resumen anual
  const anioActual = mesSeleccionado.slice(0, 4)
  const anioAnterior = String(parseInt(anioActual) - 1)

  const resumenAnual = useMemo(() => {
    if (!anioActual) return null
    const tsActual = sinAjustes(soloConjunto(transacciones.filter(t => t.fecha.startsWith(anioActual))))
    const tsAnterior = sinAjustes(soloConjunto(transacciones.filter(t => t.fecha.startsWith(anioAnterior))))

    const totalGastosActual = tsActual.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0)
    const totalIngresosActual = tsActual.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.importe), 0)
    const totalGastosAnterior = tsAnterior.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0)
    const totalIngresosAnterior = tsAnterior.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.importe), 0)

    const porMes = Array.from({ length: 12 }, (_, i) => {
      const mes = `${anioActual}-${String(i + 1).padStart(2, '0')}`
      const mesAnt = `${anioAnterior}-${String(i + 1).padStart(2, '0')}`
      const tsM = sinAjustes(soloConjunto(transacciones.filter(t => t.fecha.startsWith(mes))))
      const tsMa = sinAjustes(soloConjunto(transacciones.filter(t => t.fecha.startsWith(mesAnt))))
      return {
        nombre: new Date(parseInt(anioActual), i, 1).toLocaleString('es', { month: 'short' }),
        gastos: tsM.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0),
        gastosAnt: tsMa.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0),
      }
    })

    return { totalGastosActual, totalIngresosActual, totalGastosAnterior, totalIngresosAnterior, porMes }
  }, [transacciones, anioActual, anioAnterior])

  if (!meses.length) {
    return (
      <div className="text-center mt-16 text-gray-400">
        <div className="text-4xl mb-3">📊</div>
        <p>Aún no hay datos para informes</p>
      </div>
    )
  }

  const idxMes = meses.indexOf(mesSeleccionado)

  // Selector Ingresos / Gastos. Lo usan "Mes" y "Histórico": las dos enseñan
  // cifras que dependen de él, así que se define una vez y se pinta en ambas.
  const barraTipos = d => (
      <div className="flex border-b border-gray-100">
        <button onClick={() => setTabActiva('ingreso')}
          className={`flex-1 pb-2 text-sm font-semibold transition-colors ${tabActiva === 'ingreso' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-gray-400'}`}>
          Ingresos {ocultar(mostrarCifras, `${euros(d.totalIngresos)} €`)}
        </button>
        <button onClick={() => setTabActiva('gasto')}
          className={`flex-1 pb-2 text-sm font-semibold transition-colors ${tabActiva === 'gasto' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400'}`}>
          Gastos {ocultar(mostrarCifras, `${euros(d.totalGastos)} €`)}
        </button>
      </div>
  )

  return (
    <div className="pb-24 space-y-4">

      {/* El mes y su resumen son de Informes. En Balance no pintan nada: esa
          pantalla enseña un saldo acumulado, no un mes, y tener arriba un
          selector que no afecta a la cifra de abajo era justo lo que
          confundía cuando esto era una pestaña más. */}
      {seccion === 'informes' && (<>
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => idxMes < meses.length - 1 && setMesSeleccionado(meses[idxMes + 1])}
          disabled={idxMes >= meses.length - 1}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 font-bold disabled:opacity-30">
          ‹
        </button>
        <select value={mesSeleccionado} onChange={e => { setMesSeleccionado(e.target.value); setMesComparacion(null) }}
          className="text-base font-bold text-gray-800 bg-transparent text-center focus:outline-none">
          {meses.map(m => {
            const [a, mn] = m.split('-')
            const label = new Date(a, parseInt(mn) - 1).toLocaleString('es', { month: 'short', year: 'numeric' })
            return <option key={m} value={m}>{label}</option>
          })}
        </select>
        <button
          onClick={() => idxMes > 0 && setMesSeleccionado(meses[idxMes - 1])}
          disabled={idxMes <= 0}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 font-bold disabled:opacity-30">
          ›
        </button>
      </div>

      {/* Lo único que hay que mirar de un vistazo */}
      <div className="flex gap-2">
        <div className="flex-1 bg-red-50 rounded-2xl px-4 py-3">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Gasto conjunto del mes</p>
          <p className="text-xl font-bold text-red-500 mt-0.5">
            {ocultar(mostrarCifras, `${euros(gastoConjuntoMes)} €`)}
          </p>
          <p className="text-[10px] text-red-300 mt-0.5">Lo de los dos, sin los gastos particulares</p>
        </div>
        {/* Pulsando esta tarjeta se va a Balance. Si hay deuda, además abre
            directamente el formulario de "ya le he pagado": es lo que se
            quiere hacer justo después de leer que debes dinero, y antes
            había que ir a buscarlo a otra pantalla.
            Es un <button> de verdad, no un div con onClick: así se puede
            pulsar también con el teclado y el móvil lo anuncia como botón. */}
        <button type="button" onClick={onSaldar}
          className="flex-1 bg-[#0d1b2a] rounded-2xl px-4 py-3 text-left active:opacity-80">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-bold text-[#8fa6c9] uppercase tracking-widest">La cuenta de los dos</p>
            <span className="text-[#8fa6c9] text-xs shrink-0">›</span>
          </div>
          {/* Desde cuándo se cuenta. Sin esto, la cifra sale sin contexto y no
              se sabe si habla de este mes o de toda la historia. */}
          <p className="text-[10px] text-[#8fa6c9]">
            {ultimoCierre ? `Desde el ${fechaCorta(ultimoCierre.created_at)}` : 'Desde el principio'}
          </p>
          {deuda.aRepartir <= 0 || deuda.importe < 0.01 ? (
            <p className="text-sm font-bold text-white mt-1">Estáis en paz</p>
          ) : (
            <p className="text-sm font-bold text-white mt-1 leading-snug">
              {deuda.deudor} le debe {ocultar(mostrarCifras, `${euros(deuda.importe)} €`)} a {deuda.acreedor}
            </p>
          )}
        </button>
      </div>

      </>)}

      {/* MES — en qué se ha ido el dinero este mes */}
      {seccion === 'informes' && (
        <>
      {/* De quién son los apuntes que se enseñan debajo. Aquí es donde cada
          uno ve sus gastos particulares desglosados. */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Qué gastos estás viendo</p>
        <div className="flex gap-1.5">
          {[['comunes', 'De los dos', 'bg-teal-600 border-teal-600'], ['mios', 'Lo mío', 'bg-violet-600 border-violet-600']].map(([id, label, activo]) => (
            <button key={id} type="button" onClick={() => setDeQuien(id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-colors ${deQuien === id ? activo + ' text-white' : 'bg-white text-gray-500 border-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {/* Sin esto las cifras confunden: en "Lo mío" el alquiler no sale por
            1.400 sino por lo que te toque, y conviene decirlo. */}
        <p className="text-[11px] text-gray-400 mt-1.5">
          {deQuien === 'comunes' && 'Los gastos de los dos, por su importe entero.'}
          {deQuien === 'mios' && 'Tu parte: lo tuyo entero y de lo de los dos, solo lo que te toca.'}
        </p>
      </div>

      {barraTipos(datosVista)}

      {/* Gráfico de tarta */}
      {datosTorta.length > 0 ? (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={datosTorta}
                  dataKey="valor"
                  nameKey="nombre"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={0}
                  paddingAngle={1}
                >
                  {datosTorta.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => [ocultar(mostrarCifras, `${euros(val)} €`), '']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.nombre || ''}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Lista por categoría — expandible */}
          <div className="space-y-1.5">
            {datosTorta.map((d, i) => {
              const abierta = categoriaAbierta === d.nombre
              const apuntesCategoria = transaccionesVista
                .filter(t => t.tipo === tabActiva && t.categoria === d.nombre)
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
              const color = COLORES[i % COLORES.length]

              // Agrupar por subcategoría solo si hay más de una en uso este
              // mes en esta categoría; si no, iría un toque de más para ver
              // los mismos 1-2 apuntes de siempre.
              const porSubcategoria = {}
              apuntesCategoria.forEach(t => {
                const clave = t.subcategoria || '__sin__'
                if (!porSubcategoria[clave]) porSubcategoria[clave] = { nombre: t.subcategoria || 'Sin subcategoría', total: 0, apuntes: [] }
                porSubcategoria[clave].total += Number(t.importe)
                porSubcategoria[clave].apuntes.push(t)
              })
              const gruposSubcategoria = Object.values(porSubcategoria).sort((a, b) => b.total - a.total)
              const agruparPorSub = gruposSubcategoria.length > 1

              return (
                <div key={d.nombre} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Cabecera de categoría */}
                  <button
                    type="button"
                    onClick={() => { setCategoriaAbierta(abierta ? null : d.nombre); setSubcategoriaAbierta(null) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg text-white min-w-[42px] text-center shrink-0"
                      style={{ backgroundColor: color }}>
                      {d.pct}%
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-800">{d.nombre}</span>
                    <span className="text-sm font-semibold text-gray-700 mr-1">{ocultar(mostrarCifras, `${euros(d.valor)} €`)}</span>
                    <span className="text-gray-400 text-xs">{abierta ? '▲' : '▼'}</span>
                  </button>

                  {/* Apuntes desplegados. Con una sola subcategoría en uso se
                      va directo a la lista de siempre, sin un toque de más. */}
                  {abierta && !agruparPorSub && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {apuntesCategoria.map(t => (
                        <FilaApunte key={t.id} t={t} mostrarCifras={mostrarCifras} yo={yo}
                          extra={t.medio_pago && <span className="text-[10px] text-gray-400 shrink-0">{t.medio_pago.split(' ')[0]}</span>} />
                      ))}
                    </div>
                  )}

                  {abierta && agruparPorSub && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {gruposSubcategoria.map(g => {
                        const claveSub = `${d.nombre}|${g.nombre}`
                        const subAbierta = subcategoriaAbierta === claveSub
                        return (
                          <div key={g.nombre}>
                            <button
                              type="button"
                              onClick={() => setSubcategoriaAbierta(subAbierta ? null : claveSub)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-left active:bg-gray-50 bg-gray-50/40">
                              <span className="flex-1 text-xs font-semibold text-gray-600">{g.nombre}</span>
                              <span className="text-xs font-bold text-gray-700">{ocultar(mostrarCifras, `${euros(g.total)} €`)}</span>
                              <span className="text-gray-400 text-[10px]">{subAbierta ? '▲' : '▼'}</span>
                            </button>
                            {subAbierta && (
                              <div className="divide-y divide-gray-50">
                                {g.apuntes.map(t => (
                                  <FilaApunte key={t.id} t={t} mostrarCifras={mostrarCifras} yo={yo}
                                    extra={t.medio_pago && <span className="text-[10px] text-gray-400 shrink-0">{t.medio_pago.split(' ')[0]}</span>} />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Lo que le queda a quien mira. No es ingresos menos gastos a secas:
              de los gastos de los dos solo cuenta su parte, si no le restaría
              el alquiler entero cuando solo le toca un trozo. */}
          {miBalanceMes ? (
            <div className={`rounded-xl p-3 text-center ${miBalanceMes.queda >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <p className={`text-xs font-medium ${miBalanceMes.queda >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Lo que te queda a ti este mes</p>
              <p className={`text-xl font-bold ${miBalanceMes.queda >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {ocultar(mostrarCifras, `${miBalanceMes.queda >= 0 ? '+' : ''}${euros(miBalanceMes.queda)} €`)}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Tus ingresos {ocultar(mostrarCifras, euros(miBalanceMes.ingresos))} € menos tu parte de los gastos {ocultar(mostrarCifras, euros(miBalanceMes.gastos))} €
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-gray-400 text-sm text-center mt-4">Sin datos este mes</p>
      )}

      {/* Resumen por medio de pago — expandible */}
      {datosVista.medios.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Por medio de pago</p>
          <div className="space-y-1.5">
            {datosVista.medios.map((m) => {
              const emoji = cuentas.find(c => c.nombre === m.nombre)?.emoji || '💳'
              const totalMedio = datosVista.totalGastos > 0 ? Math.round((m.gasto / datosVista.totalGastos) * 100) : 0
              const abierto = medioAbierto === m.nombre
              const apuntesMedio = transaccionesVista
                .filter(t => t.medio_pago === m.nombre && t.tipo === tabActiva)
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
              return (
                <div key={m.nombre} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMedioAbierto(abierto ? null : m.nombre)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                    <span className="text-xl w-8 text-center shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{m.nombre}</p>
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${totalMedio}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0 mr-1">
                      {tabActiva === 'gasto' && m.gasto > 0 && (
                        <p className="text-sm font-bold text-red-500">{ocultar(mostrarCifras, `−${euros(m.gasto)} €`)}</p>
                      )}
                      {tabActiva === 'ingreso' && m.ingreso > 0 && (
                        <p className="text-sm font-bold text-emerald-500">{ocultar(mostrarCifras, `+${euros(m.ingreso)} €`)}</p>
                      )}
                      <p className="text-xs text-gray-300">{totalMedio}%</p>
                    </div>
                    <span className="text-gray-400 text-xs">{abierto ? '▲' : '▼'}</span>
                  </button>

                  {abierto && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {apuntesMedio.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">Sin apuntes de {tabActiva === 'gasto' ? 'gastos' : 'ingresos'} con este medio</p>
                      ) : apuntesMedio.map(t => (
                        <FilaApunte key={t.id} t={t} mostrarCifras={mostrarCifras} yo={yo}
                          extra={<span className="text-[10px] text-gray-400 shrink-0">{t.categoria}</span>} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
        </>
      )}

      {/* NOSOTROS — quién debe a quién y quién ha puesto el dinero */}
      {seccion === 'balance' && (
        <>
      {/* La cuenta de los dos — solo con los gastos comunes */}
      {deuda.aRepartir > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">La cuenta de los dos</p>
          <div className="bg-[#0d1b2a] rounded-2xl px-5 py-5 text-center">
            {deuda.importe < 0.01 ? (
              <>
                <p className="text-base font-bold text-white">Estáis en paz</p>
                <p className="text-xs text-[#8fa6c9] mt-1">
                  {ultimoCierre ? `Desde el cierre del ${fechaCorta(ultimoCierre.created_at)}` : 'Habéis puesto lo mismo los dos'}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-widest text-[#8fa6c9] mb-1.5">
                  {ultimoCierre ? `Desde el cierre del ${fechaCorta(ultimoCierre.created_at)}` : 'En total, desde el principio'}
                </p>
                <p className="text-lg font-bold text-white leading-snug">
                  {deuda.deudor} le debe {ocultar(mostrarCifras, `${euros(deuda.importe)} €`)} a {deuda.acreedor}
                </p>
              </>
            )}
            {/* De dónde sale la deuda: lo que cada uno ha pagado frente a lo
                que le tocaba según el reparto. Los ajustes de las
                liquidaciones van en su propia línea: mezclarlos con lo
                pagado daba cifras que no se entendían. */}
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2.5">
              {NOMBRES.map(n => (
                <div key={n} className="flex items-baseline gap-2 text-left">
                  <span className="text-xs font-semibold text-white w-12 shrink-0">{n}</span>
                  <span className="flex-1 text-[11px] text-[#8fa6c9]">
                    ha pagado <b className="text-white font-semibold">{ocultar(mostrarCifras, `${euros((deuda.pagado[n] || 0))} €`)}</b>
                    {' · '}le tocaban <b className="text-white font-semibold">{ocultar(mostrarCifras, `${euros((deuda.toca[n] || 0))} €`)}</b>
                    {Math.abs(deuda.ajuste[n] || 0) >= 0.01 && (
                      <>
                        <br />
                        {(deuda.ajuste[n] || 0) > 0 ? 'y ha pagado a ' : 'y ha cobrado de '}
                        {NOMBRES.find(o => o !== n)}{' '}
                        <b className="text-white font-semibold">{ocultar(mostrarCifras, `${euros(Math.abs(deuda.ajuste[n]))} €`)}</b>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {deuda.comunSinAsignar > 0 && (
            <p className="text-xs text-gray-400">
              No cuentan {ocultar(mostrarCifras, `${euros(deuda.comunSinAsignar)} €`)} pagados con dinero común: no los ha puesto ninguno de los dos.
            </p>
          )}

          {/* Cerrar la cuenta. Solo aparece estando en paz: es lo que hace que
              no se pueda perder dinero de nadie al cerrar. */}
          {deuda.importe < 0.01 && (
            <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-3 space-y-2">
              <button type="button" onClick={cerrarCuenta} disabled={cerrando}
                className="w-full py-3.5 bg-teal-600 text-white font-bold rounded-2xl text-sm disabled:opacity-50 shadow-sm">
                {cerrando ? 'Cerrando…' : '🔒 Cerrar la cuenta y empezar de cero'}
              </button>
              <p className="text-xs text-teal-800 leading-snug">
                Los gastos se quedan donde están; lo único que cambia es que la cuenta de los
                dos empieza a contar desde hoy. Así se entiende mejor de dónde sale cada cifra.
              </p>
            </div>
          )}
          {/* Saldar: anota que uno le ha pagado al otro. No es un gasto —
              ese dinero cambia de bolsillo, no se gasta— así que no entra
              en los totales del mes, solo ajusta quién ha puesto cuánto. */}
          {deuda.importe >= 0.01 && (
            saldando ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">
                  {deuda.deudor} paga a {deuda.acreedor}
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cuánto</label>
                  <input type="text" inputMode="decimal" value={importeSaldo}
                    onChange={e => { setImporteSaldo(e.target.value); setErrorSaldo('') }}
                    placeholder={deuda.importe.toFixed(2)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button type="button" onClick={() => setImporteSaldo(deuda.importe.toFixed(2))}
                    className="text-xs text-blue-500 mt-1.5">
                    Poner los {euros(deuda.importe)} € enteros
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Con qué</label>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {soloActivas(cuentas).map(c => (
                      <button key={c.nombre} type="button"
                        onClick={() => { setMedioSaldo(c.nombre); setErrorSaldo('') }}
                        className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border ${medioSaldo === c.nombre ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                        {c.emoji} {c.nombre}
                      </button>
                    ))}
                  </div>
                </div>
                {errorSaldo && <p className="text-xs text-red-500">{errorSaldo}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={anotarPago} disabled={guardandoSaldo}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#0d1b2a] text-white disabled:opacity-50">
                    {guardandoSaldo ? 'Guardando…' : 'Anotar el pago'}
                  </button>
                  <button type="button" onClick={() => { setSaldando(false); setErrorSaldo('') }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => { setSaldando(true); setImporteSaldo('') }}
                className="w-full py-3 rounded-2xl text-sm font-bold bg-teal-600 text-white">
                Ya le he pagado
              </button>
            )
          )}
          <p className="text-xs text-gray-400">Cuenta acumulada de todos los meses, no solo del que estás viendo. Solo entra lo marcado «de los dos»: los gastos personales no cuentan.</p>
        </div>
      )}

      {/* Historial de ajustes y cierres. Los pagos ya se podían ver filtrando
          la lista por la categoría "Ajuste de cuentas", pero los cierres no se
          veían en ningún sitio, y ahora mandan sobre lo que cuenta la cuenta. */}
      {historial.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Historial</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button type="button" onClick={() => setHistorialAbierto(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
              <span className="text-xl w-8 text-center shrink-0">🧾</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">Pagos entre vosotros y cierres</p>
                <p className="text-xs text-gray-400">{historial.length} {historial.length === 1 ? 'apunte' : 'apuntes'}</p>
              </div>
              <span className="text-gray-400 text-xs">{historialAbierto ? '▲' : '▼'}</span>
            </button>

            {historialAbierto && (
              <div className="border-t border-gray-50 divide-y divide-gray-50">
                {historial.map(h => (
                  <div key={h.clave} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/50">
                    <span className="text-xs text-gray-400 w-14 shrink-0">
                      {new Date(h.cuando).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-sm shrink-0">{h.tipo === 'cierre' ? '🔒' : '🤝'}</span>
                    <span className={`flex-1 text-xs ${h.tipo === 'cierre' ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>
                      {ocultar(mostrarCifras, h.texto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deshacer el último cierre: la red de seguridad. No se pierde nada,
              la cuenta vuelve a contar desde el cierre anterior. */}
          {ultimoCierre && (
            confirmandoDeshacer ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs text-amber-900 leading-snug">
                  Si deshaces el cierre del {fechaCorta(ultimoCierre.created_at)}, la cuenta volverá a
                  contar desde antes. No se borra ningún gasto.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={deshacerCierre}
                    className="flex-1 py-2.5 bg-amber-600 text-white text-xs font-bold rounded-xl">
                    Sí, deshacerlo
                  </button>
                  <button type="button" onClick={() => setConfirmandoDeshacer(false)}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-500 text-xs font-semibold rounded-xl">
                    No
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmandoDeshacer(true)}
                className="text-xs text-gray-400 underline">
                Deshacer el último cierre
              </button>
            )
          )}
        </div>
      )}

      {/* Resumen por persona — expandible */}
      {quienPuso.lista.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quién puso el dinero de los dos</p>
          <p className="text-xs text-gray-400 -mt-1">
            {ultimoCierre ? `Desde el cierre del ${fechaCorta(ultimoCierre.created_at)}` : 'Desde el principio'}
          </p>
          <div className="space-y-1.5">
            {quienPuso.lista.map((p) => {
              const emoji = EMOJI_PERSONA[p.nombre] || '👤'
              const pctPersona = quienPuso.total > 0 ? Math.round((p.puesto / quienPuso.total) * 100) : 0
              const abierto = personaAbierta === p.nombre
              // La lista sale del MISMO filtro que el total (gastosComunesDesde):
              // si se filtrara aquí a mano, acabaría enseñando apuntes que la
              // cifra de al lado no ha sumado. Ya pasó una vez.
              const apuntesPersona = comunesAcumulados
                .filter(t => personaDeMedioPago(t.medio_pago, cuentas) === p.nombre)
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
              return (
                <div key={p.nombre} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPersonaAbierta(abierto ? null : p.nombre)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                    <span className="text-xl w-8 text-center shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{p.nombre}</p>
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${pctPersona}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0 mr-1">
                      <p className="text-sm font-bold text-red-500">{ocultar(mostrarCifras, `${euros(p.puesto)} €`)}</p>
                      <p className="text-xs text-gray-300">{pctPersona}%</p>
                    </div>
                    <span className="text-gray-400 text-xs">{abierto ? '▲' : '▼'}</span>
                  </button>

                  {abierto && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {apuntesPersona.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">Sin apuntes de esta persona</p>
                      ) : apuntesPersona.map(t => (
                        <FilaApunte key={t.id} t={t} mostrarCifras={mostrarCifras} yo={yo}
                          extra={<span className="text-[10px] text-gray-400 shrink-0">{t.categoria}</span>} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {deuda.aRepartir <= 0 && quienPuso.lista.length === 0 && (
        <p className="text-gray-400 text-sm text-center mt-8">Todavía no hay gastos de los dos que repartir</p>
      )}
        </>
      )}

      {/* HISTÓRICO — comparar con otros meses, el año y exportar.
          Va al final y plegado porque no es una pantalla hermana de las otras:
          necesita que antes hayas elegido un mes ahí arriba. Todo lo de aquí
          abajo (la comparación, el año, el gráfico) se calcula a partir de ese
          mes, así que ponerlo como pestaña al lado contaba una mentira sobre
          cómo funciona. */}
      {seccion === 'informes' && (
        <button type="button" onClick={() => setVerHistorico(v => !v)}
          className="w-full py-3.5 rounded-2xl text-sm font-bold bg-[#0d1b2a] text-white shadow-sm">
          {verHistorico ? '▲ Cerrar la comparación' : '📈 Comparar con otro mes y ver el año'}
        </button>
      )}

      {seccion === 'informes' && verHistorico && (
        <>
      {barraTipos(datosHist)}

      {/* Botón comparar */}
      {!mesComparacion ? (
        <div className="flex justify-end">
          <select
            value=""
            onChange={e => { if (e.target.value) setMesComparacion(e.target.value) }}
            className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 focus:outline-none">
            <option value="">⚖️ Comparar con...</option>
            {meses.filter(m => m !== mesSeleccionado).map(m => {
              const [a, mn] = m.split('-')
              const label = new Date(a, parseInt(mn) - 1).toLocaleString('es', { month: 'short', year: 'numeric' })
              return <option key={m} value={m}>{label}</option>
            })}
          </select>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
          <span className="text-xs font-semibold text-blue-700">
            ⚖️ Comparando con {new Date(mesComparacion.split('-')[0], parseInt(mesComparacion.split('-')[1]) - 1).toLocaleString('es', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setMesComparacion(null)} className="text-blue-400 text-sm font-bold">✕</button>
        </div>
      )}

      {/* Tabla comparativa */}
      {mesComparacion && datosComp && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Cabecera */}
          <div className="grid grid-cols-4 gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-400 col-span-1">Categoría</span>
            <span className="text-xs font-bold text-gray-600 text-right">{new Date(mesSeleccionado.split('-')[0], parseInt(mesSeleccionado.split('-')[1]) - 1).toLocaleString('es', { month: 'short' })}</span>
            <span className="text-xs font-bold text-gray-400 text-right">{new Date(mesComparacion.split('-')[0], parseInt(mesComparacion.split('-')[1]) - 1).toLocaleString('es', { month: 'short' })}</span>
            <span className="text-xs font-bold text-gray-400 text-right">Dif.</span>
          </div>

          {/* Fila totales */}
          <div className="grid grid-cols-4 gap-1 px-3 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs font-bold text-gray-700 col-span-1 truncate">{tabActiva === 'gasto' ? '💸 Total' : '💰 Total'}</span>
            <span className="text-xs font-bold text-gray-800 text-right">
              {ocultar(mostrarCifras, `${euros0((tabActiva === 'gasto' ? datosHist.totalGastos : datosHist.totalIngresos))}€`)}
            </span>
            <span className="text-xs font-semibold text-gray-400 text-right">
              {ocultar(mostrarCifras, `${euros0((tabActiva === 'gasto' ? datosComp.totalGastos : datosComp.totalIngresos))}€`)}
            </span>
            {(() => {
              const actual = tabActiva === 'gasto' ? datosHist.totalGastos : datosHist.totalIngresos
              const comp = tabActiva === 'gasto' ? datosComp.totalGastos : datosComp.totalIngresos
              const dif = actual - comp
              const esAlerta = tabActiva === 'gasto' ? dif > 0 : dif < 0
              return <span className={`text-xs font-bold text-right ${dif === 0 ? 'text-gray-400' : esAlerta ? 'text-red-500' : 'text-emerald-600'}`}>{ocultar(mostrarCifras, `${dif > 0 ? '+' : ''}${euros0(dif)}€`)}</span>
            })()}
          </div>

          {/* Filas por categoría */}
          {(() => {
            const campo = tabActiva === 'gasto' ? 'gasto' : 'ingreso'
            const todasCats = new Set([
              ...datosHist.categorias.filter(c => (c[campo] || 0) > 0).map(c => c.nombre),
              ...Object.entries(datosComp.porCategoria).filter(([, v]) => (v[campo] || 0) > 0).map(([k]) => k)
            ])
            return Array.from(todasCats).sort().map((cat, idx) => {
              const actual = datosHist.categorias.find(c => c.nombre === cat)?.[campo] || 0
              const comp = datosComp.porCategoria[cat]?.[campo] || 0
              const dif = actual - comp
              const esAlerta = tabActiva === 'gasto' ? dif > 0 : dif < 0
              return (
                <div key={cat} className={`grid grid-cols-4 gap-1 px-3 py-2 ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                  <span className="text-xs text-gray-600 col-span-1 truncate">{cat}</span>
                  <span className="text-xs font-semibold text-gray-800 text-right">{actual > 0 ? ocultar(mostrarCifras, `${euros0(actual)}€`) : '—'}</span>
                  <span className="text-xs text-gray-400 text-right">{comp > 0 ? ocultar(mostrarCifras, `${euros0(comp)}€`) : '—'}</span>
                  <span className={`text-xs font-semibold text-right ${dif === 0 ? 'text-gray-300' : esAlerta ? 'text-red-500' : 'text-emerald-600'}`}>
                    {dif === 0 ? '—' : ocultar(mostrarCifras, `${dif > 0 ? '+' : ''}${euros0(dif)}€`)}
                  </span>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Comparativa con mes anterior */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">vs mes anterior</p>
        <div className="grid grid-cols-2 gap-2">
          <TarjetaComparativa
            label="Gastos de los dos"
            actual={datosHist.totalGastos}
            anterior={datosMesAnterior.gastos}
            colorActual="text-red-500"
            colorBg="bg-red-50"
            mostrarCifras={mostrarCifras}
          />
          <TarjetaComparativa
            label="Tus ingresos"
            actual={datosHist.totalIngresos}
            anterior={datosMesAnterior.ingresos}
            colorActual="text-emerald-600"
            colorBg="bg-emerald-50"
            mostrarCifras={mostrarCifras}
          />
        </div>
      </div>

      {/* Resumen anual */}
      {resumenAnual && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Resumen {anioActual} vs {anioAnterior}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <TarjetaComparativa
              label={`Gastos de los dos ${anioActual}`}
              actual={resumenAnual.totalGastosActual}
              anterior={resumenAnual.totalGastosAnterior}
              colorActual="text-red-500"
              colorBg="bg-red-50"
              etiquetaAnterior={anioAnterior}
              mostrarCifras={mostrarCifras}
            />
            <TarjetaComparativa
              label={`Tus ingresos ${anioActual}`}
              actual={resumenAnual.totalIngresosActual}
              anterior={resumenAnual.totalIngresosAnterior}
              colorActual="text-emerald-600"
              colorBg="bg-emerald-50"
              etiquetaAnterior={anioAnterior}
              mostrarCifras={mostrarCifras}
            />
          </div>

          {/* Gráfico de barras mensual */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
            <p className="text-xs font-semibold text-gray-400 mb-3">Gastos de los dos por mes — {anioActual} vs {anioAnterior}</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={resumenAnual.porMes} barCategoryGap="20%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={32}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(val, name) => [ocultar(mostrarCifras, `${euros(val)} €`), name === 'gastos' ? anioActual : anioAnterior]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', fontSize: 12 }}
                />
                <Bar dataKey="gastosAnt" fill="#fca5a5" radius={[3, 3, 0, 0]} name="gastosAnt" />
                <Bar dataKey="gastos" fill="#ef4444" radius={[3, 3, 0, 0]} name="gastos" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-1">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-2 rounded bg-red-500 inline-block" /> {anioActual}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-2 rounded bg-red-200 inline-block" /> {anioAnterior}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Eventos del mes */}
      {eventosDelMes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">🎯 Eventos este mes</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {eventosDelMes.map((ev, idx) => {
              const pct = ev.presupuesto ? Math.min(100, (ev.total / ev.presupuesto) * 100) : null
              return (
                <div key={ev.id} className={`px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">🎯</span>
                      <span className="text-sm font-semibold text-gray-800 truncate">{ev.nombre}</span>
                      <span className="text-xs text-gray-400 shrink-0">{ev.count} apunte{ev.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-sm font-bold text-red-500 shrink-0 ml-2">{ocultar(mostrarCifras, `${euros(ev.total)} €`)}</span>
                  </div>
                  {pct !== null && (
                    <div className="mt-1.5">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {pct.toFixed(0)}% de {ocultar(mostrarCifras, `${euros0(ev.presupuesto)} €`)} presupuestados
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Exportar. Se separa la copia de la casa de la copia personal: la
          primera es la que vale como copia de seguridad de los dos y se puede
          compartir sin enseñar los gastos particulares de nadie. */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Exportar a Excel</p>
        <button onClick={async () => { await exportarExcel(soloComunes(transacciones), `gastos_de_los_dos_${hoy()}.xlsx`); onCopiaDescargada?.() }}
          disabled={soloComunes(transacciones).length === 0}
          className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold rounded-xl active:bg-emerald-100 disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
          <span>📥</span> Copia de los gastos de los dos (Excel)
        </button>
        <p className="text-[11px] text-gray-400 -mt-0.5">
          Sin gastos particulares de nadie. Es la que vale como copia de seguridad y se puede pasar al otro.
        </p>
        <button onClick={() => exportarExcel(soloMios(transacciones), `mis_gastos_${hoy()}.xlsx`)}
          disabled={soloMios(transacciones).length === 0}
          className="w-full py-2.5 bg-gray-50 border border-gray-200 text-gray-600 font-semibold rounded-xl active:bg-gray-100 disabled:opacity-40 flex items-center justify-center gap-2 text-sm mt-2">
          <span>📥</span> Solo mis apuntes personales (Excel)
        </button>
        <p className="text-[11px] text-gray-400 -mt-0.5">
          Tuyos y de nadie más. No lo compartas si no quieres que se vean.
        </p>
      </div>
        </>
      )}
    </div>
  )
}
