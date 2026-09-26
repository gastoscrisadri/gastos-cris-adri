'use client'

import { ocultar, euros } from '@/lib/cifras'
import { nombreDe } from '@/lib/identidad'
import { personaDeMedioPago } from '@/lib/cuentas'

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

// El color de cada persona. Rosa Cris, azul Adri, verde los automáticos.
// Vive aquí arriba y no suelto dentro de la fila para que no acabe habiendo
// dos versiones distintas del mismo color en la misma pantalla.
const COLOR_PUNTO = { Cris: 'bg-pink-400', Adri: 'bg-blue-400' }
const COLOR_AUTO = 'bg-emerald-500'

export default function ListaTransacciones({ transacciones, cargando, onSeleccionar, mostrarCifras, usuario, cuentas }) {
  // Un ajuste de cuentas se lee al revés según quién mire: el que paga ve que
  // sale dinero, el que cobra ve que entra. Es el mismo apunte.
  const yo = nombreDe(usuario)
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
              // ¿Este ajuste de cuentas lo cobré yo? Entonces es dinero que entra.
              const loCobroYo = !!t.liquidacion_a && !!yo && t.liquidacion_a === yo
              const esGastoNormal = t.tipo === 'gasto' && importe >= 0 && !loCobroYo
              const colorImporte = esGastoNormal ? 'text-red-500' : 'text-emerald-500'
              const signo = esGastoNormal ? '−' : '+'
              // El texto del ajuste, contado desde quien mira. Sin saber quién
              // es, se deja el que trae guardado el apunte.
              // El día a secas: la lista ya va agrupada por meses con su
              // título encima, así que repetir el mes y el año en cada apunte
              // sobra. Antes salía la fecha en crudo ("2026-09-26"), que
              // además no es el formato de toda la app.
              const dia = parseInt(t.fecha.slice(8), 10)
              // Quién puso el dinero. Puede ser una cuenta común, y puede no
              // saberse si el medio de pago no tiene dueño asignado: en ese
              // caso no se enseña nada, mejor que inventarse un nombre.
              const duenoMedio = personaDeMedioPago(t.medio_pago, cuentas)
              const pagador = duenoMedio && duenoMedio !== 'Sin asignar' ? duenoMedio : null

              const titulo = t.liquidacion_a && yo
                ? (loCobroYo ? `${t.quien} te pagó` : `Le pagaste a ${t.liquidacion_a}`)
                : (t.descripcion || t.establecimiento || t.subcategoria || t.categoria)

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

                  {/* Info.
                      Antes esta parte era una sola cadena de trozos de largo
                      variable —establecimiento · fecha · etiqueta · nombre—
                      pegados uno detrás de otro. Como cada trozo medía
                      distinto en cada apunte, el nombre caía en un sitio
                      distinto en cada fila, y cuando no cabía se partía en dos
                      líneas. De ahí que la lista se viera desordenada.
                      Ahora hay sitios fijos: el punto de color y el título
                      arriba, y la fecha y quien pagó en la columna de la
                      derecha, que tiene ancho fijo. */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {/* Quién lo apuntó, en un punto de color. Va como punto y
                          no coloreando el título porque el rosa y el azul sobre
                          blanco tienen un contraste de 2,6 —el mínimo para leer
                          es 4,5— y el título es lo primero que se lee de cada
                          apunte. Así queda negro y legible. */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_PUNTO[t.quien] || COLOR_AUTO}`} />
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {titulo}
                      </p>
                    </div>
                    {/* Esta línea NO puede partirse: si no cabe, se corta. Es
                        lo que hace que todas las filas midan lo mismo. */}
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0 overflow-hidden">
                      {t.descripcion && t.establecimiento && (
                        <>
                          <span className="text-xs text-gray-400 truncate">{t.establecimiento}</span>
                          <span className="text-gray-200 text-xs shrink-0">·</span>
                        </>
                      )}
                      {/* Siempre se dice de quién es el gasto: si solo se
                          marcara lo personal, no se sabría si lo demás es
                          común o es que falta el dato. Un pago entre ellos
                          no es ninguna de las dos cosas y se marca aparte. */}
                      {t.liquidacion_a ? (
                        <span className="text-[10px] font-semibold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded shrink-0">
                          ajuste de cuentas
                        </span>
                      ) : t.a_cargo_de ? (
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                          {t.a_cargo_de === yo ? 'tuyo, lo pagó el otro' : `de ${t.a_cargo_de}, lo pagaste tú`}
                        </span>
                      ) : t.comun === false ? (
                        <span className="text-[10px] font-semibold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded shrink-0">
                          personal
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded shrink-0">
                          de los dos
                        </span>
                      )}
                      {t.evento_id && <span className="text-[10px] shrink-0">🎯</span>}
                      {t.imagen_url && <span className="text-[10px] text-gray-300 shrink-0">📎</span>}
                    </div>
                  </div>

                  {/* Columna de la derecha, de ancho FIJO. Es lo que hace que
                      el importe, el día y quien pagó caigan siempre en la misma
                      vertical en todas las filas.
                      Debajo del importe va QUIEN PAGÓ, no quien lo apuntó: este
                      hueco está pegado al dinero y ahí un nombre se lee como
                      "este dinero lo puso ese". Quien lo apuntó es el punto de
                      color de la izquierda. */}
                  <div className="w-[76px] shrink-0 text-right">
                    <p className={`font-bold text-sm ${colorImporte}`}>
                      {ocultar(mostrarCifras, `${signo}${euros(Math.abs(importe))} €`)}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {dia}{pagador ? ` · ${pagador}` : ''}
                    </p>
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
