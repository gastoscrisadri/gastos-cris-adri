'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ocultar } from '@/lib/cifras'

export default function DetalleEvento({ evento, onCerrar, mostrarCifras }) {
  const [transacciones, setTransacciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const { data } = await supabase
        .from('transacciones')
        .select('*')
        .eq('evento_id', evento.id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (data) setTransacciones(data)
      setCargando(false)
    }
    cargar()
  }, [evento.id])

  const gastos = useMemo(() =>
    transacciones.filter(t => t.tipo === 'gasto'),
  [transacciones])

  const totalGastado = useMemo(() =>
    gastos.reduce((s, t) => s + Number(t.importe), 0),
  [gastos])

  const presupuesto = evento.presupuesto ? Number(evento.presupuesto) : null
  const porcentaje = presupuesto ? Math.min(100, (totalGastado / presupuesto) * 100) : null
  const restante = presupuesto ? presupuesto - totalGastado : null

  // Días transcurridos y restantes
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const inicio = evento.fecha_inicio ? new Date(evento.fecha_inicio + 'T12:00:00') : null
  const fin = evento.fecha_fin ? new Date(evento.fecha_fin + 'T12:00:00') : null

  const diasTranscurridos = inicio
    ? Math.max(0, Math.floor((hoy - inicio) / 86400000) + 1)
    : null
  const diasRestantes = fin
    ? Math.max(0, Math.floor((fin - hoy) / 86400000))
    : null
  const mediaPorDia = diasTranscurridos > 0 ? totalGastado / diasTranscurridos : 0

  // Desglose por categoría
  const porCategoria = useMemo(() => {
    const mapa = {}
    gastos.forEach(t => {
      const cat = t.categoria || 'Sin categoría'
      mapa[cat] = (mapa[cat] || 0) + Number(t.importe)
    })
    return Object.entries(mapa).sort((a, b) => b[1] - a[1])
  }, [gastos])

  const maxCategoria = porCategoria[0]?.[1] || 1

  // Agrupar transacciones por fecha
  const porFecha = useMemo(() => {
    const mapa = {}
    transacciones.forEach(t => {
      if (!mapa[t.fecha]) mapa[t.fecha] = []
      mapa[t.fecha].push(t)
    })
    return Object.entries(mapa).sort((a, b) => b[0].localeCompare(a[0]))
  }, [transacciones])

  function formatFecha(f) {
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col max-w-lg mx-auto">
      {/* Cabecera */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-5 pt-12 pb-5">
        <button onClick={onCerrar} className="text-white/70 text-sm font-medium flex items-center gap-1 mb-3">
          ← Volver
        </button>
        <h1 className="text-xl font-bold text-white leading-tight">{evento.nombre}</h1>
        {(inicio || fin) && (
          <p className="text-xs text-white/70 mt-1">
            {inicio ? inicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
            {inicio && fin ? ' → ' : ''}
            {fin ? fin.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            {diasRestantes !== null && diasRestantes >= 0
              ? ` · ${diasRestantes === 0 ? 'último día' : `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`}`
              : diasRestantes !== null ? ' · Finalizado' : ''}
          </p>
        )}

        {/* Barra de presupuesto */}
        {presupuesto ? (
          <div className="mt-3">
            <div className="flex justify-between items-end mb-1.5">
              <div>
                <p className="text-2xl font-black text-white">{ocultar(mostrarCifras, `${totalGastado.toFixed(2)} €`)}</p>
                <p className="text-xs text-white/70">de {ocultar(mostrarCifras, `${presupuesto.toLocaleString('es-ES')} €`)} presupuestados</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${restante < 0 ? 'text-red-200' : 'text-white'}`}>
                  {ocultar(mostrarCifras, restante >= 0 ? `${restante.toFixed(0)} €` : `+${Math.abs(restante).toFixed(0)} €`)}
                </p>
                <p className="text-xs text-white/70">{restante >= 0 ? 'disponible' : 'excedido'}</p>
              </div>
            </div>
            <div className="h-2 bg-white/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${porcentaje >= 100 ? 'bg-red-300' : 'bg-white'}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            <p className="text-xs text-white/60 mt-1 text-right">{porcentaje.toFixed(0)}% usado</p>
          </div>
        ) : (
          <p className="text-2xl font-black text-white mt-3">{ocultar(mostrarCifras, `${totalGastado.toFixed(2)} €`)} gastado</p>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-8">
        {cargando ? (
          <div className="flex justify-center mt-10">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transacciones.length === 0 ? (
          <div className="text-center mt-16 text-gray-400 space-y-2">
            <div className="text-5xl">🎯</div>
            <p className="font-medium text-gray-500">Sin apuntes aún</p>
            <p className="text-sm">Los nuevos apuntes se asignarán automáticamente mientras el evento esté activo</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-lg font-black text-gray-900">{gastos.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">apuntes</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-lg font-black text-gray-900">{diasTranscurridos ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">días</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-lg font-black text-gray-900">{mediaPorDia > 0 ? ocultar(mostrarCifras, `${mediaPorDia.toFixed(0)}€`) : '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">media/día</p>
              </div>
            </div>

            {/* Desglose por categoría */}
            {porCategoria.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Por categoría</h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {porCategoria.map(([cat, importe], idx) => (
                    <div key={cat} className={`px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{cat}</span>
                        <span className="text-sm font-bold text-gray-900">{ocultar(mostrarCifras, `${importe.toFixed(2)} €`)}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full"
                          style={{ width: `${(importe / maxCategoria) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de apuntes */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Apuntes</h2>
              <div className="space-y-3">
                {porFecha.map(([fecha, apuntes]) => (
                  <div key={fecha}>
                    <p className="text-xs font-semibold text-gray-400 mb-1.5 px-1">{formatFecha(fecha)}</p>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {apuntes.map((t, idx) => {
                        const esGasto = t.tipo === 'gasto' && Number(t.importe) >= 0
                        return (
                          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {t.establecimiento || t.descripcion || t.categoria}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {t.categoria}{t.medio_pago ? ` · ${t.medio_pago}` : ''}
                              </p>
                            </div>
                            <p className={`text-sm font-bold shrink-0 ${esGasto ? 'text-red-500' : 'text-emerald-500'}`}>
                              {ocultar(mostrarCifras, `${esGasto ? '−' : '+'}${Math.abs(Number(t.importe)).toFixed(2)} €`)}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
