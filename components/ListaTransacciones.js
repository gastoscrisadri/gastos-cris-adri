'use client'

import { ocultar } from '@/lib/cifras'

const ICONOS = {
  'Alimentación': { emoji: '🛒', bg: '#fef3c7' },
  'Transporte': { emoji: '🚌', bg: '#dbeafe' },
  'Cultura': { emoji: '🎭', bg: '#ede9fe' },
  'Ropa': { emoji: '👗', bg: '#fce7f3' },
  'Belleza': { emoji: '💄', bg: '#fce7f3' },
  'Gastos Cris': { emoji: '👤', bg: '#e0f2fe' },
  'Salud': { emoji: '💊', bg: '#d1fae5' },
  'Hogar': { emoji: '🏠', bg: '#fef9c3' },
  'Vehículos': { emoji: '🚗', bg: '#e0f2fe' },
  'Ocio': { emoji: '🎉', bg: '#ede9fe' },
  'Loterias': { emoji: '🎰', bg: '#fef3c7' },
  'Suministros': { emoji: '💡', bg: '#f0fdf4' },
  'Gastos Adri': { emoji: '👦', bg: '#dbeafe' },
  'Regalos': { emoji: '🎁', bg: '#fce7f3' },
  'Autopistas': { emoji: '🛣️', bg: '#f1f5f9' },
  'Gastos varios o compensaciones': { emoji: '💳', bg: '#f1f5f9' },
  'Inversión': { emoji: '📈', bg: '#d1fae5' },
  'Efectivo mensual': { emoji: '💵', bg: '#d1fae5' },
  'Salario': { emoji: '💰', bg: '#d1fae5' },
  'Varios': { emoji: '💫', bg: '#ede9fe' },
  'Primer asiento': { emoji: '📋', bg: '#f1f5f9' },
  'Bizum recibido': { emoji: '📱', bg: '#dbeafe' },
  'Tarjeta roja': { emoji: '💳', bg: '#fee2e2' },
}

const DEFAULT_ICONO = { emoji: '📝', bg: '#f1f5f9' }

export default function ListaTransacciones({ transacciones, cargando, onSeleccionar, mostrarCifras }) {
  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 gap-3">
        <div className="w-8 h-8 border-2 border-[#0d1b2a] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Cargando...</p>
      </div>
    )
  }

  if (!transacciones.length) {
    return (
      <div className="text-center mt-20 text-gray-400">
        <div className="text-5xl mb-4">🧾</div>
        <p className="font-medium text-gray-500">No hay registros aún</p>
        <p className="text-sm mt-1">Pulsa + para añadir el primero</p>
      </div>
    )
  }

  // Agrupar por mes
  const grupos = []
  let mesActual = ''
  let grupoActual = null

  for (const t of transacciones) {
    const mes = t.fecha.slice(0, 7)
    if (mes !== mesActual) {
      mesActual = mes
      const [anio, mesNum] = mes.split('-')
      const nombre = new Date(anio, parseInt(mesNum) - 1)
        .toLocaleString('es', { month: 'long', year: 'numeric' })
      grupoActual = { mes, nombre, items: [] }
      grupos.push(grupoActual)
    }
    grupoActual.items.push(t)
  }

  return (
    <div className="space-y-5 pb-24">
      {grupos.map(grupo => (
        <div key={grupo.mes}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
            {grupo.nombre}
          </p>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {grupo.items.map((t, idx) => {
              const icono = ICONOS[t.categoria] || DEFAULT_ICONO
              const importe = Number(t.importe)
              const esGastoNormal = t.tipo === 'gasto' && importe >= 0
              const colorImporte = esGastoNormal ? 'text-red-500' : 'text-emerald-500'
              const signo = esGastoNormal ? '−' : '+'

              return (
                <button
                  key={t.id}
                  onClick={() => onSeleccionar?.(t)}
                  className={`w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 text-left ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                >
                  {/* Icono */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: icono.bg }}>
                    {icono.emoji}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {t.descripcion || t.establecimiento || t.subcategoria || t.categoria}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.descripcion && t.establecimiento && (
                        <>
                          <span className="text-xs text-gray-400 truncate">{t.establecimiento}</span>
                          <span className="text-gray-200 text-xs">·</span>
                        </>
                      )}
                      <span className="text-xs text-gray-300">{t.fecha}</span>
                      {t.quien && (
                        <>
                          <span className="text-gray-200 text-xs">·</span>
                          <span className={`text-xs font-semibold ${t.quien === 'Cris' ? 'text-blue-400' : t.quien === 'Adri' ? 'text-pink-400' : 'text-emerald-500'}`}>
                            {t.quien}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Importe */}
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${colorImporte}`}>
                      {ocultar(mostrarCifras, `${signo}${Math.abs(importe).toFixed(2)} €`)}
                    </p>
                    <div className="flex justify-end gap-1 mt-0.5">
                      {t.evento_id && <span className="text-[10px]">🎯</span>}
                      {t.imagen_url && <span className="text-[10px] text-gray-300">📎</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
