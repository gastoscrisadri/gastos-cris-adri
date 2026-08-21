'use client'

import { useState, useEffect } from 'react'
import { ocultar } from '@/lib/cifras'
import { createClient } from '@/lib/supabase/client'
import FormTransaccion from './FormTransaccion'

export default function DetalleTransaccion({ transaccion: t, onCerrar, onEliminar, onGuardado, mostrarCifras }) {
  const [confirmando, setConfirmando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [eventos, setEventos] = useState([])
  const [eventoId, setEventoId] = useState(t?.evento_id || null)
  const [mostrarSelectorEvento, setMostrarSelectorEvento] = useState(false)
  const [guardandoEvento, setGuardandoEvento] = useState(false)
  const [eliminandoFoto, setEliminandoFoto] = useState(false)
  const [imagenUrl, setImagenUrl] = useState(t?.imagen_url || null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('eventos').select('id, nombre').eq('archivado', false).order('activo', { ascending: false }).then(({ data }) => {
      if (data) setEventos(data)
    })
  }, [])

  async function eliminarFoto() {
    setEliminandoFoto(true)
    const nombreArchivo = imagenUrl.split('/documentos/').pop()
    await supabase.storage.from('documentos').remove([nombreArchivo])
    await supabase.from('transacciones').update({ imagen_url: null }).eq('id', t.id)
    setImagenUrl(null)
    setEliminandoFoto(false)
    onGuardado?.()
  }

  async function guardarEvento(nuevoEventoId) {
    setGuardandoEvento(true)
    await supabase.from('transacciones').update({ evento_id: nuevoEventoId }).eq('id', t.id)
    setEventoId(nuevoEventoId)
    setMostrarSelectorEvento(false)
    setGuardandoEvento(false)
    onGuardado?.()
  }

  if (!t) return null

  // Modo edición en el mismo overlay
  if (editando) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="bg-[#0d1b2a] px-4 pt-10 pb-5">
          <button onClick={() => setEditando(false)}
            className="text-white/60 text-sm mb-3 flex items-center gap-1">
            ← Volver al detalle
          </button>
          <h1 className="text-xl font-bold text-white">Editar apunte</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <FormTransaccion
            transaccionEditar={t}
            onGuardado={() => { setEditando(false); onGuardado?.() }}
            onCancelar={() => setEditando(false)}
            onEliminar={tx => onEliminar?.(tx)}
          />
        </div>
      </div>
    )
  }

  const importe = Number(t.importe)
  const esDevolucion = t.tipo === 'gasto' && importe < 0
  const esGastoNormal = t.tipo === 'gasto' && importe >= 0
  const colorImporte = esGastoNormal ? 'text-red-500' : 'text-emerald-500'
  const signo = esGastoNormal ? '-' : '+'

  const [anio, mesNum, dia] = t.fecha.split('-')
  const fechaLegible = new Date(t.fecha + 'T12:00:00').toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-gray-100">
        <button
          onClick={onCerrar}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-lg font-bold"
        >
          ←
        </button>
        <h2 className="text-lg font-bold text-gray-900 flex-1">Detalle</h2>
        {!confirmando ? (
          <>
            <button onClick={() => setEditando(true)}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl">
              Editar
            </button>
            <button onClick={() => setConfirmando(true)}
              className="px-3 py-2 bg-red-50 text-red-500 text-sm font-semibold rounded-xl">
              Eliminar
            </button>
          </>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-500">¿Seguro?</span>
            <button onClick={() => onEliminar?.(t)}
              className="px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl">
              Sí, borrar
            </button>
            <button onClick={() => setConfirmando(false)}
              className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-semibold rounded-xl">
              No
            </button>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 pb-12 space-y-4 pt-4">

        {/* Importe grande */}
        <div className="text-center py-4">
          {esDevolucion && (
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Devolución o cobro</p>
          )}
          <p className={`text-5xl font-bold ${colorImporte}`}>
            {ocultar(mostrarCifras, `${signo}${Math.abs(importe).toFixed(2)} €`)}
          </p>
          <p className="text-sm text-gray-400 mt-2 capitalize">{fechaLegible}</p>
        </div>

        {/* Datos */}
        <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100">
          {t.establecimiento && (
            <Fila label="Establecimiento" valor={t.establecimiento} />
          )}
          <Fila label="Categoría" valor={t.categoria} />
          {t.subcategoria && <Fila label="Subcategoría" valor={t.subcategoria} />}
          <Fila
            label="Tipo"
            valor={esDevolucion ? 'Devolución o cobro' : t.tipo === 'gasto' ? 'Gasto' : 'Ingreso'}
          />
          {t.medio_pago && <Fila label="Medio de pago" valor={t.medio_pago} />}
          {t.quien && <Fila label="Registrado por" valor={t.quien} />}
          {t.descripcion && <Fila label="Notas" valor={t.descripcion} />}
        </div>

        {/* Evento */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Evento</p>
            <button
              onClick={() => setMostrarSelectorEvento(v => !v)}
              className="text-xs text-blue-500 font-semibold">
              {eventoId ? 'Cambiar' : '+ Asignar'}
            </button>
          </div>
          {eventoId ? (
            <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span>🎯</span>
                <span className="text-sm font-semibold text-orange-800">
                  {eventos.find(e => e.id === eventoId)?.nombre || 'Evento'}
                </span>
              </div>
              <button onClick={() => guardarEvento(null)} disabled={guardandoEvento}
                className="text-orange-400 text-xs font-bold px-2">✕</button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 px-1">Sin evento asignado</p>
          )}

          {mostrarSelectorEvento && (
            <div className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {eventos.length === 0 ? (
                <p className="text-sm text-gray-400 p-3 text-center">No hay eventos disponibles</p>
              ) : (
                eventos.map((ev, idx) => (
                  <button key={ev.id} onClick={() => guardarEvento(ev.id)} disabled={guardandoEvento}
                    className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between ${idx > 0 ? 'border-t border-gray-50' : ''} ${eventoId === ev.id ? 'text-orange-600 bg-orange-50' : 'text-gray-800'}`}>
                    <span>{ev.nombre}</span>
                    {eventoId === ev.id && <span className="text-orange-500 text-xs">✓ Actual</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Foto del ticket */}
        {imagenUrl && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Foto del documento</p>
              <button
                onClick={eliminarFoto}
                disabled={eliminandoFoto}
                className="text-xs text-red-400 font-semibold disabled:opacity-40">
                {eliminandoFoto ? 'Eliminando…' : 'Eliminar foto'}
              </button>
            </div>
            <a href={imagenUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={imagenUrl}
                alt="Documento"
                className="w-full rounded-2xl border border-gray-100 shadow-sm object-contain max-h-96"
              />
              <p className="text-xs text-blue-500 text-center mt-1">Toca para ver a tamaño completo</p>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function Fila({ label, valor }) {
  return (
    <div className="flex justify-between items-start px-4 py-3 gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">{valor}</span>
    </div>
  )
}
