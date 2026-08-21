'use client'

import { useMemo, useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { ocultar } from '@/lib/cifras'

const COLORES = [
  '#ef4444','#f97316','#eab308','#84cc16','#22c55e',
  '#14b8a6','#3b82f6','#8b5cf6','#ec4899','#f43f5e',
  '#0ea5e9','#a855f7','#10b981','#f59e0b','#6366f1',
  '#d946ef','#64748b',
]

const MEDIOS_EMOJI = {
  'Tarjeta Cris': '💳',
  'Tarjeta Adri': '💳',
  'Efectivo Cris': '💵',
  'Efectivo Adri': '💵',
  'Bizum': '📱',
  'Transferencia': '🏦',
  'Tarjeta roja': '💳',
  'Banco': '🏦',
}

const EMOJI_PERSONA = {
  'Cris': '👤',
  'Adri': '👤',
  'Común': '🤝',
  'Sin asignar': '❔',
}

// Quién puso el dinero, deducido del medio de pago: el efectivo y la tarjeta
// de cada uno son suyos; banco, bizum, transferencia y tarjeta roja son comunes.
function quienPaga(medioPago) {
  if (!medioPago) return 'Sin asignar'
  if (/\bCris$/.test(medioPago)) return 'Cris'
  if (/\bAdri$/.test(medioPago)) return 'Adri'
  return 'Común'
}

function TarjetaComparativa({ label, actual, anterior, colorActual, colorBg, etiquetaAnterior, mostrarCifras }) {
  const diff = anterior > 0 ? ((actual - anterior) / anterior) * 100 : null
  const sube = diff > 0
  const igual = diff === null || Math.abs(diff) < 0.5

  return (
    <div className={`${colorBg} rounded-2xl p-3 space-y-1`}>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${colorActual}`}>{ocultar(mostrarCifras, `${actual.toFixed(2)} €`)}</p>
      <div className="flex items-center gap-1">
        {igual ? (
          <span className="text-xs text-gray-400">Sin datos anteriores</span>
        ) : (
          <>
            <span className={`text-xs font-bold ${sube ? 'text-red-500' : 'text-emerald-600'}`}>
              {sube ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
            </span>
            <span className="text-xs text-gray-400">vs {etiquetaAnterior || 'mes ant.'} ({ocultar(mostrarCifras, `${anterior.toFixed(0)} €`)})</span>
          </>
        )}
      </div>
    </div>
  )
}

function exportarCSV(transacciones, nombreArchivo) {
  const cabecera = ['Fecha','Tipo','Importe (€)','Categoría','Subcategoría','Establecimiento','Notas','Medio de pago','Quién']
  const filas = transacciones.map(t => [
    t.fecha,
    t.tipo === 'gasto' && Number(t.importe) < 0 ? 'Devolución o cobro' : t.tipo,
    String(Number(t.importe).toFixed(2)).replace('.', ','),
    t.categoria || '',
    t.subcategoria || '',
    t.establecimiento || '',
    t.descripcion || '',
    t.medio_pago || '',
    t.quien || '',
  ])
  const csv = [cabecera, ...filas]
    .map(fila => fila.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

export default function Informes({ transacciones, mostrarCifras }) {
  const meses = useMemo(() => {
    const set = new Set(transacciones.map(t => t.fecha.slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [transacciones])

  const [mesSeleccionado, setMesSeleccionado] = useState(meses[0] || '')
  const [tabActiva, setTabActiva] = useState('gasto')

  useEffect(() => {
    if (meses.length && !mesSeleccionado) setMesSeleccionado(meses[0])
  }, [meses, mesSeleccionado])

  const transaccionesMes = useMemo(() =>
    transacciones.filter(t => t.fecha.startsWith(mesSeleccionado))
  , [transacciones, mesSeleccionado])

  const datosMes = useMemo(() => {
    const gastos = transaccionesMes.filter(t => t.tipo === 'gasto')
    const ingresos = transaccionesMes.filter(t => t.tipo === 'ingreso')
    const totalGastos = gastos.reduce((s, t) => s + Number(t.importe), 0)
    const totalIngresos = ingresos.reduce((s, t) => s + Number(t.importe), 0)

    const porCategoria = {}
    transaccionesMes.forEach(t => {
      if (!porCategoria[t.categoria]) porCategoria[t.categoria] = { gasto: 0, ingreso: 0 }
      porCategoria[t.categoria][t.tipo] += Number(t.importe)
    })

    const categorias = Object.entries(porCategoria)
      .map(([nombre, vals]) => ({ nombre, ...vals, total: vals.gasto + vals.ingreso }))
      .sort((a, b) => b.total - a.total)

    // Por medio de pago
    const porMedio = {}
    transaccionesMes.forEach(t => {
      if (!t.medio_pago) return
      if (!porMedio[t.medio_pago]) porMedio[t.medio_pago] = { gasto: 0, ingreso: 0 }
      porMedio[t.medio_pago][t.tipo] += Number(t.importe)
    })
    const medios = Object.entries(porMedio)
      .map(([nombre, vals]) => ({ nombre, gasto: vals.gasto || 0, ingreso: vals.ingreso || 0 }))
      .sort((a, b) => b.gasto - a.gasto)

    // Por persona: cuánto ha puesto de su bolsillo cada uno este mes
    const porPersona = {}
    transaccionesMes.forEach(t => {
      const quien = quienPaga(t.medio_pago)
      if (!porPersona[quien]) porPersona[quien] = { gasto: 0, ingreso: 0 }
      porPersona[quien][t.tipo] += Number(t.importe)
    })
    const personas = Object.entries(porPersona)
      .map(([nombre, vals]) => ({ nombre, gasto: vals.gasto || 0, ingreso: vals.ingreso || 0 }))
      .sort((a, b) => b.gasto - a.gasto)

    return { totalGastos, totalIngresos, balance: totalIngresos - totalGastos, categorias, medios, personas }
  }, [transaccionesMes])

  const datosTorta = useMemo(() => {
    const campo = tabActiva === 'gasto' ? 'gasto' : 'ingreso'
    const total = datosMes.categorias.reduce((s, c) => s + (c[campo] || 0), 0)
    return datosMes.categorias
      .filter(c => (c[campo] || 0) > 0)
      .map(c => ({
        nombre: c.nombre,
        valor: c[campo],
        pct: total > 0 ? Math.round((c[campo] / total) * 100) : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [datosMes, tabActiva])

  const totalTab = datosTorta.reduce((s, d) => s + d.valor, 0)
  const [categoriaAbierta, setCategoriaAbierta] = useState(null)
  const [medioAbierto, setMedioAbierto] = useState(null)
  const [personaAbierta, setPersonaAbierta] = useState(null)
  const [mesComparacion, setMesComparacion] = useState(null)

  const transaccionesComp = useMemo(() =>
    mesComparacion ? transacciones.filter(t => t.fecha.startsWith(mesComparacion)) : []
  , [transacciones, mesComparacion])

  const datosComp = useMemo(() => {
    if (!mesComparacion) return null
    const gastos = transaccionesComp.filter(t => t.tipo === 'gasto')
    const ingresos = transaccionesComp.filter(t => t.tipo === 'ingreso')
    const totalGastos = gastos.reduce((s, t) => s + Number(t.importe), 0)
    const totalIngresos = ingresos.reduce((s, t) => s + Number(t.importe), 0)
    const porCategoria = {}
    transaccionesComp.forEach(t => {
      if (!porCategoria[t.categoria]) porCategoria[t.categoria] = { gasto: 0, ingreso: 0 }
      porCategoria[t.categoria][t.tipo] += Number(t.importe)
    })
    return { totalGastos, totalIngresos, balance: totalIngresos - totalGastos, porCategoria }
  }, [transaccionesComp, mesComparacion])
  const [cuentas, setCuentas] = useState([])
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('cuentas').select('*').order('nombre').then(({ data }) => {
      if (data) setCuentas(data)
    })
    supabase.from('eventos').select('id, nombre, presupuesto').then(({ data }) => {
      if (data) setEventos(data)
    })
  }, [])

  // Saldo actual de cada cuenta = saldo_inicial + ingresos - gastos de TODAS las transacciones
  const saldosCuentas = useMemo(() => {
    return cuentas.map(cuenta => {
      const movimientos = transacciones.filter(t => t.medio_pago === cuenta.nombre)
      const ingresos = movimientos.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.importe), 0)
      const gastos = movimientos.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0)
      const saldo = cuenta.saldo_inicial + ingresos - gastos
      return { ...cuenta, saldo }
    })
  }, [cuentas, transacciones])

  // Reset al cambiar mes o tab
  useMemo(() => { setCategoriaAbierta(null); setMedioAbierto(null) }, [mesSeleccionado, tabActiva])

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
    const ts = transacciones.filter(t => t.fecha.startsWith(mesAnterior))
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
    const tsActual = transacciones.filter(t => t.fecha.startsWith(anioActual))
    const tsAnterior = transacciones.filter(t => t.fecha.startsWith(anioAnterior))

    const totalGastosActual = tsActual.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0)
    const totalIngresosActual = tsActual.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.importe), 0)
    const totalGastosAnterior = tsAnterior.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0)
    const totalIngresosAnterior = tsAnterior.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.importe), 0)

    const porMes = Array.from({ length: 12 }, (_, i) => {
      const mes = `${anioActual}-${String(i + 1).padStart(2, '0')}`
      const mesAnt = `${anioAnterior}-${String(i + 1).padStart(2, '0')}`
      const tsM = transacciones.filter(t => t.fecha.startsWith(mes))
      const tsMa = transacciones.filter(t => t.fecha.startsWith(mesAnt))
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

  return (
    <div className="pb-24 space-y-4">

      {/* Saldos actuales de cuentas */}
      {saldosCuentas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Saldo actual de cuentas</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-hide">
            {saldosCuentas.map(cuenta => {
              const positivo = cuenta.saldo >= 0
              return (
                <div key={cuenta.id}
                  className={`shrink-0 rounded-2xl px-4 py-3 flex flex-col gap-1 min-w-[130px] border ${positivo ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <span className="text-2xl">{cuenta.emoji}</span>
                  <p className="text-xs font-semibold text-gray-500 leading-tight">{cuenta.nombre}</p>
                  <p className={`text-base font-bold ${positivo ? 'text-emerald-600' : 'text-red-500'}`}>
                    {ocultar(mostrarCifras, `${positivo ? '+' : ''}${cuenta.saldo.toFixed(2)} €`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Navegación de mes */}
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

      {/* Botón comparar */}
      {!mesComparacion ? (
        <div className="flex justify-end">
          <select
            value=""
            onChange={e => e.target.value && setMesComparacion(e.target.value)}
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
              {ocultar(mostrarCifras, `${(tabActiva === 'gasto' ? datosMes.totalGastos : datosMes.totalIngresos).toFixed(0)}€`)}
            </span>
            <span className="text-xs font-semibold text-gray-400 text-right">
              {ocultar(mostrarCifras, `${(tabActiva === 'gasto' ? datosComp.totalGastos : datosComp.totalIngresos).toFixed(0)}€`)}
            </span>
            {(() => {
              const actual = tabActiva === 'gasto' ? datosMes.totalGastos : datosMes.totalIngresos
              const comp = tabActiva === 'gasto' ? datosComp.totalGastos : datosComp.totalIngresos
              const dif = actual - comp
              const esAlerta = tabActiva === 'gasto' ? dif > 0 : dif < 0
              return <span className={`text-xs font-bold text-right ${dif === 0 ? 'text-gray-400' : esAlerta ? 'text-red-500' : 'text-emerald-600'}`}>{ocultar(mostrarCifras, `${dif > 0 ? '+' : ''}${dif.toFixed(0)}€`)}</span>
            })()}
          </div>

          {/* Filas por categoría */}
          {(() => {
            const campo = tabActiva === 'gasto' ? 'gasto' : 'ingreso'
            const todasCats = new Set([
              ...datosMes.categorias.filter(c => (c[campo] || 0) > 0).map(c => c.nombre),
              ...Object.entries(datosComp.porCategoria).filter(([, v]) => (v[campo] || 0) > 0).map(([k]) => k)
            ])
            return Array.from(todasCats).sort().map((cat, idx) => {
              const actual = datosMes.categorias.find(c => c.nombre === cat)?.[campo] || 0
              const comp = datosComp.porCategoria[cat]?.[campo] || 0
              const dif = actual - comp
              const esAlerta = tabActiva === 'gasto' ? dif > 0 : dif < 0
              return (
                <div key={cat} className={`grid grid-cols-4 gap-1 px-3 py-2 ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                  <span className="text-xs text-gray-600 col-span-1 truncate">{cat}</span>
                  <span className="text-xs font-semibold text-gray-800 text-right">{actual > 0 ? ocultar(mostrarCifras, `${actual.toFixed(0)}€`) : '—'}</span>
                  <span className="text-xs text-gray-400 text-right">{comp > 0 ? ocultar(mostrarCifras, `${comp.toFixed(0)}€`) : '—'}</span>
                  <span className={`text-xs font-semibold text-right ${dif === 0 ? 'text-gray-300' : esAlerta ? 'text-red-500' : 'text-emerald-600'}`}>
                    {dif === 0 ? '—' : ocultar(mostrarCifras, `${dif > 0 ? '+' : ''}${dif.toFixed(0)}€`)}
                  </span>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Tabs Ingresos / Gastos */}
      <div className="flex border-b border-gray-100">
        <button onClick={() => setTabActiva('ingreso')}
          className={`flex-1 pb-2 text-sm font-semibold transition-colors ${tabActiva === 'ingreso' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-gray-400'}`}>
          Ingresos {ocultar(mostrarCifras, `${datosMes.totalIngresos.toFixed(2)} €`)}
        </button>
        <button onClick={() => setTabActiva('gasto')}
          className={`flex-1 pb-2 text-sm font-semibold transition-colors ${tabActiva === 'gasto' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400'}`}>
          Gastos {ocultar(mostrarCifras, `${datosMes.totalGastos.toFixed(2)} €`)}
        </button>
      </div>

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
                  formatter={(val) => [ocultar(mostrarCifras, `${val.toFixed(2)} €`), '']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.nombre || ''}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Lista por categoría — expandible */}
          <div className="space-y-1.5">
            {datosTorta.map((d, i) => {
              const abierta = categoriaAbierta === d.nombre
              const apuntesCategoria = transaccionesMes
                .filter(t => t.tipo === tabActiva && t.categoria === d.nombre)
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
              const color = COLORES[i % COLORES.length]
              return (
                <div key={d.nombre} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Cabecera de categoría */}
                  <button
                    type="button"
                    onClick={() => setCategoriaAbierta(abierta ? null : d.nombre)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg text-white min-w-[42px] text-center shrink-0"
                      style={{ backgroundColor: color }}>
                      {d.pct}%
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-800">{d.nombre}</span>
                    <span className="text-sm font-semibold text-gray-700 mr-1">{ocultar(mostrarCifras, `${d.valor.toFixed(2)} €`)}</span>
                    <span className="text-gray-400 text-xs">{abierta ? '▲' : '▼'}</span>
                  </button>

                  {/* Apuntes desplegados */}
                  {abierta && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {apuntesCategoria.map(t => {
                        const importe = Number(t.importe)
                        const esGasto = t.tipo === 'gasto' && importe >= 0
                        const [, mesN, dia] = t.fecha.split('-')
                        const fechaCorta = `${parseInt(dia)}/${parseInt(mesN)}`
                        return (
                          <div key={t.id} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/50">
                            <span className="text-xs text-gray-400 w-10 shrink-0">{fechaCorta}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">
                                {t.establecimiento || t.descripcion || t.subcategoria || t.categoria}
                              </p>
                              {t.descripcion && t.establecimiento && (
                                <p className="text-[10px] text-gray-400 truncate">{t.descripcion}</p>
                              )}
                            </div>
                            {t.medio_pago && (
                              <span className="text-[10px] text-gray-400 shrink-0">{t.medio_pago.split(' ')[0]}</span>
                            )}
                            <span className={`text-xs font-bold shrink-0 ${esGasto ? 'text-red-500' : 'text-emerald-500'}`}>
                              {ocultar(mostrarCifras, `${esGasto ? '−' : '+'}${Math.abs(importe).toFixed(2)} €`)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Balance */}
          <div className={`rounded-xl p-3 text-center ${datosMes.balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <p className={`text-xs font-medium ${datosMes.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Balance del mes</p>
            <p className={`text-xl font-bold ${datosMes.balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              {ocultar(mostrarCifras, `${datosMes.balance >= 0 ? '+' : ''}${datosMes.balance.toFixed(2)} €`)}
            </p>
          </div>
        </>
      ) : (
        <p className="text-gray-400 text-sm text-center mt-4">Sin datos este mes</p>
      )}

      {/* Resumen por medio de pago — expandible */}
      {datosMes.medios.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Por medio de pago</p>
          <div className="space-y-1.5">
            {datosMes.medios.map((m) => {
              const emoji = MEDIOS_EMOJI[m.nombre] || '💳'
              const totalMedio = datosMes.totalGastos > 0 ? Math.round((m.gasto / datosMes.totalGastos) * 100) : 0
              const abierto = medioAbierto === m.nombre
              const apuntesMedio = transaccionesMes
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
                        <p className="text-sm font-bold text-red-500">{ocultar(mostrarCifras, `−${m.gasto.toFixed(2)} €`)}</p>
                      )}
                      {tabActiva === 'ingreso' && m.ingreso > 0 && (
                        <p className="text-sm font-bold text-emerald-500">{ocultar(mostrarCifras, `+${m.ingreso.toFixed(2)} €`)}</p>
                      )}
                      <p className="text-xs text-gray-300">{totalMedio}%</p>
                    </div>
                    <span className="text-gray-400 text-xs">{abierto ? '▲' : '▼'}</span>
                  </button>

                  {abierto && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {apuntesMedio.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">Sin apuntes de {tabActiva === 'gasto' ? 'gastos' : 'ingresos'} con este medio</p>
                      ) : apuntesMedio.map(t => {
                        const importe = Number(t.importe)
                        const esGasto = t.tipo === 'gasto' && importe >= 0
                        const [, mesN, dia] = t.fecha.split('-')
                        const fechaCorta = `${parseInt(dia)}/${parseInt(mesN)}`
                        return (
                          <div key={t.id} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/50">
                            <span className="text-xs text-gray-400 w-10 shrink-0">{fechaCorta}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">
                                {t.establecimiento || t.descripcion || t.subcategoria || t.categoria}
                              </p>
                              {t.descripcion && t.establecimiento && (
                                <p className="text-[10px] text-gray-400 truncate">{t.descripcion}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0">{t.categoria}</span>
                            <span className={`text-xs font-bold shrink-0 ${esGasto ? 'text-red-500' : 'text-emerald-500'}`}>
                              {ocultar(mostrarCifras, `${esGasto ? '−' : '+'}${Math.abs(importe).toFixed(2)} €`)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Resumen por persona — expandible */}
      {datosMes.personas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quién puso el dinero</p>
          <div className="space-y-1.5">
            {datosMes.personas.map((p) => {
              const emoji = EMOJI_PERSONA[p.nombre] || '👤'
              const pctPersona = datosMes.totalGastos > 0 ? Math.round((p.gasto / datosMes.totalGastos) * 100) : 0
              const abierto = personaAbierta === p.nombre
              const apuntesPersona = transaccionesMes
                .filter(t => quienPaga(t.medio_pago) === p.nombre && t.tipo === tabActiva)
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
                      {tabActiva === 'gasto' && p.gasto > 0 && (
                        <p className="text-sm font-bold text-red-500">{ocultar(mostrarCifras, `−${p.gasto.toFixed(2)} €`)}</p>
                      )}
                      {tabActiva === 'ingreso' && p.ingreso > 0 && (
                        <p className="text-sm font-bold text-emerald-500">{ocultar(mostrarCifras, `+${p.ingreso.toFixed(2)} €`)}</p>
                      )}
                      <p className="text-xs text-gray-300">{pctPersona}%</p>
                    </div>
                    <span className="text-gray-400 text-xs">{abierto ? '▲' : '▼'}</span>
                  </button>

                  {abierto && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {apuntesPersona.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">Sin apuntes de {tabActiva === 'gasto' ? 'gastos' : 'ingresos'} de esta persona</p>
                      ) : apuntesPersona.map(t => {
                        const importe = Number(t.importe)
                        const esGasto = t.tipo === 'gasto' && importe >= 0
                        const [, mesN, dia] = t.fecha.split('-')
                        const fechaCorta = `${parseInt(dia)}/${parseInt(mesN)}`
                        return (
                          <div key={t.id} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/50">
                            <span className="text-xs text-gray-400 w-10 shrink-0">{fechaCorta}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">
                                {t.establecimiento || t.descripcion || t.subcategoria || t.categoria}
                              </p>
                              {t.descripcion && t.establecimiento && (
                                <p className="text-[10px] text-gray-400 truncate">{t.descripcion}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0">{t.categoria}</span>
                            <span className={`text-xs font-bold shrink-0 ${esGasto ? 'text-red-500' : 'text-emerald-500'}`}>
                              {ocultar(mostrarCifras, `${esGasto ? '−' : '+'}${Math.abs(importe).toFixed(2)} €`)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Comparativa con mes anterior */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">vs mes anterior</p>
        <div className="grid grid-cols-2 gap-2">
          <TarjetaComparativa
            label="Gastos"
            actual={datosMes.totalGastos}
            anterior={datosMesAnterior.gastos}
            colorActual="text-red-500"
            colorBg="bg-red-50"
            mostrarCifras={mostrarCifras}
          />
          <TarjetaComparativa
            label="Ingresos"
            actual={datosMes.totalIngresos}
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
              label={`Gastos ${anioActual}`}
              actual={resumenAnual.totalGastosActual}
              anterior={resumenAnual.totalGastosAnterior}
              colorActual="text-red-500"
              colorBg="bg-red-50"
              etiquetaAnterior={anioAnterior}
              mostrarCifras={mostrarCifras}
            />
            <TarjetaComparativa
              label={`Ingresos ${anioActual}`}
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
            <p className="text-xs font-semibold text-gray-400 mb-3">Gastos por mes — {anioActual} vs {anioAnterior}</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={resumenAnual.porMes} barCategoryGap="20%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={32}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(val, name) => [ocultar(mostrarCifras, `${val.toFixed(2)} €`), name === 'gastos' ? anioActual : anioAnterior]}
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
                    <span className="text-sm font-bold text-red-500 shrink-0 ml-2">{ocultar(mostrarCifras, `${ev.total.toFixed(2)} €`)}</span>
                  </div>
                  {pct !== null && (
                    <div className="mt-1.5">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {pct.toFixed(0)}% de {ocultar(mostrarCifras, `${Number(ev.presupuesto).toLocaleString('es-ES')} €`)} presupuestados
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Exportar */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Exportar a Excel</p>
        <button onClick={() => exportarCSV(transaccionesMes, `gastos_${mesSeleccionado}.csv`)}
          disabled={transaccionesMes.length === 0}
          className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold rounded-xl active:bg-emerald-100 disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
          <span>📥</span> Descargar {mesSeleccionado}
        </button>
        <button onClick={() => exportarCSV(transacciones, `gastos_todos_${new Date().toISOString().slice(0,10)}.csv`)}
          disabled={transacciones.length === 0}
          className="w-full py-2.5 bg-gray-50 border border-gray-200 text-gray-600 font-semibold rounded-xl active:bg-gray-100 disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
          <span>📥</span> Descargar todos los datos
        </button>
      </div>
    </div>
  )
}
