'use client'

import { useState, useEffect } from 'react'
import { ocultar } from '@/lib/cifras'
import { createClient } from '@/lib/supabase/client'

const FORM_VACIO = {
  nombre: '',
  fecha_inicio: '',
  fecha_fin: '',
  presupuesto: '',
}

export default function GestionEventos({ onVerDetalle, mostrarCifras }) {
  const [eventos, setEventos] = useState([])
  const [formulario, setFormulario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [mostrarArchivados, setMostrarArchivados] = useState(false)
  const supabase = createClient()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('eventos')
      .select('*')
      .order('activo', { ascending: false })
      .order('created_at', { ascending: false })
    if (data) setEventos(data)
    setCargando(false)
  }

  async function toggleActivo(ev) {
    if (ev.activo) {
      await supabase.from('eventos').update({ activo: false }).eq('id', ev.id)
      setEventos(es => es.map(e => e.id === ev.id ? { ...e, activo: false } : e))
    } else {
      await supabase.from('eventos').update({ activo: false }).neq('id', ev.id)
      await supabase.from('eventos').update({ activo: true }).eq('id', ev.id)
      setEventos(es => es.map(e => e.id === ev.id ? { ...e, activo: true } : { ...e, activo: false }))
    }
  }

  async function archivar(ev) {
    await supabase.from('eventos').update({ activo: false, archivado: true }).eq('id', ev.id)
    setEventos(es => es.map(e => e.id === ev.id ? { ...e, activo: false, archivado: true } : e))
  }

  function onGuardado(ev) {
    if (ev._nuevo) {
      setEventos(es => [ev, ...es])
    } else {
      setEventos(es => es.map(e => e.id === ev.id ? ev : e))
    }
    setFormulario(null)
  }

  const activos = eventos.filter(e => !e.archivado)
  const archivados = eventos.filter(e => e.archivado)

  if (formulario !== null) {
    return (
      <FormEvento
        inicial={formulario === 'nuevo' ? FORM_VACIO : formulario}
        onGuardado={onGuardado}
        onCancelar={() => setFormulario(null)}
      />
    )
  }

  return (
    <div className="pb-24 space-y-4">
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-base font-bold text-gray-900">Eventos</h2>
          <p className="text-xs text-gray-400 mt-0.5">Viajes, reformas, celebraciones…</p>
        </div>
        <button
          onClick={() => setFormulario('nuevo')}
          className="px-4 py-2 bg-[#0d1b2a] text-white text-sm font-semibold rounded-xl">
          + Nuevo
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center mt-10">
          <div className="w-6 h-6 border-2 border-[#0d1b2a] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activos.length === 0 && archivados.length === 0 ? (
        <div className="text-center mt-16 text-gray-400 space-y-2">
          <div className="text-5xl">🎯</div>
          <p className="font-medium text-gray-500">No hay eventos</p>
          <p className="text-sm">Crea uno para agrupar gastos de un viaje, reforma…</p>
        </div>
      ) : (
        <>
          {activos.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              {activos.map((ev, idx) => (
                <EventoFila
                  key={ev.id}
                  ev={ev}
                  idx={idx}
                  onEditar={() => setFormulario(ev)}
                  onToggleActivo={() => toggleActivo(ev)}
                  onArchivar={() => archivar(ev)}
                  onVerDetalle={() => onVerDetalle?.(ev)}
                  mostrarCifras={mostrarCifras}
                />
              ))}
            </div>
          )}

          {archivados.length > 0 && (
            <div>
              <button
                onClick={() => setMostrarArchivados(v => !v)}
                className="text-xs text-gray-400 font-medium flex items-center gap-1 py-1">
                <span>{mostrarArchivados ? '▾' : '▸'}</span>
                <span>Archivados ({archivados.length})</span>
              </button>
              {mostrarArchivados && (
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mt-2">
                  {archivados.map((ev, idx) => (
                    <EventoFila
                      key={ev.id}
                      ev={ev}
                      idx={idx}
                      onEditar={() => setFormulario(ev)}
                      onToggleActivo={() => toggleActivo(ev)}
                      onArchivar={() => archivar(ev)}
                      onVerDetalle={() => onVerDetalle?.(ev)}
                      mostrarCifras={mostrarCifras}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EventoFila({ ev, idx, onEditar, onToggleActivo, onArchivar, onVerDetalle, mostrarCifras }) {
  const [expandido, setExpandido] = useState(false)

  return (
    <div className={`${idx > 0 ? 'border-t border-gray-50' : ''}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 ${ev.archivado ? 'opacity-50' : ''}`}
        onClick={() => setExpandido(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {ev.activo && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                Activo
              </span>
            )}
            <p className="font-semibold text-gray-900 text-sm truncate">{ev.nombre}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {ev.fecha_inicio ? new Date(ev.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
            {ev.fecha_inicio && ev.fecha_fin ? ' → ' : ''}
            {ev.fecha_fin ? new Date(ev.fecha_fin + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            {ev.presupuesto ? ` · ${ocultar(mostrarCifras, `${Number(ev.presupuesto).toLocaleString('es-ES', { minimumFractionDigits: 0 })} €`)} presup.` : ''}
          </p>
        </div>
        <span className="text-gray-300 text-xs">{expandido ? '▾' : '▸'}</span>
      </div>

      {expandido && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          <button
            onClick={onVerDetalle}
            className="text-xs px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg font-medium">
            Ver detalle
          </button>
          <button
            onClick={onEditar}
            className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-medium">
            Editar
          </button>
          {!ev.archivado && (
            <button
              onClick={onToggleActivo}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${ev.activo ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-600'}`}>
              {ev.activo ? 'Desactivar' : 'Activar'}
            </button>
          )}
          {!ev.archivado && !ev.activo && (
            <button
              onClick={onArchivar}
              className="text-xs px-3 py-1.5 bg-orange-50 text-orange-500 rounded-lg font-medium">
              Archivar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FormEvento({ inicial, onGuardado, onCancelar }) {
  const [form, setForm] = useState({ ...inicial })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const esEdicion = !!inicial.id

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    setError('')

    const datos = {
      nombre: form.nombre.trim(),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      presupuesto: form.presupuesto ? parseFloat(String(form.presupuesto).replace(',', '.')) : null,
    }

    if (esEdicion) {
      const { data, error } = await supabase.from('eventos').update(datos).eq('id', inicial.id).select().single()
      if (error) { setError('Error al guardar.'); setGuardando(false); return }
      onGuardado(data)
    } else {
      const { data, error } = await supabase.from('eventos').insert([datos]).select().single()
      if (error) { setError('Error al guardar.'); setGuardando(false); return }
      onGuardado({ ...data, _nuevo: true })
    }
  }

  return (
    <div className="space-y-3 pb-28">
      <h2 className="text-base font-bold text-gray-900 mb-2">
        {esEdicion ? 'Editar evento' : 'Nuevo evento'}
      </h2>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Nombre</label>
        <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
          placeholder="Viaje a Roma, Reforma cocina…"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Inicio (opcional)</label>
          <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Fin (opcional)</label>
          <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Presupuesto (opcional)</label>
        <div className="relative">
          <input type="text" inputMode="decimal" value={form.presupuesto}
            onChange={e => set('presupuesto', e.target.value)}
            placeholder="0"
            className="w-full pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-300 font-bold">€</span>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl p-3">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">
          Cancelar
        </button>
        <button type="button" onClick={guardar} disabled={guardando}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm">
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
