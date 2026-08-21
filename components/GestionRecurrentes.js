'use client'

import { useState, useEffect } from 'react'
import { ocultar } from '@/lib/cifras'
import { createClient } from '@/lib/supabase/client'
import { cargarCategorias, principalesPorTipo, subcategoriasDeCategoria } from '@/lib/categorias'

const MEDIOS_PAGO = [
  { valor: 'Efectivo Adri', emoji: '💵' },
  { valor: 'Efectivo Cris', emoji: '💵' },
  { valor: 'Tarjeta Cris', emoji: '💳' },
  { valor: 'Banco', emoji: '🏦' },
  { valor: 'Tarjeta Adri', emoji: '💳' },
  { valor: 'Bizum', emoji: '📱' },
  { valor: 'Transferencia', emoji: '🏦' },
  { valor: 'Tarjeta roja', emoji: '💳' },
]

const FORM_VACIO = {
  nombre: '',
  importe: '',
  tipo: 'gasto',
  categoria: '',
  subcategoria: '',
  establecimiento: '',
  descripcion: '',
  medio_pago: '',
  dia_mes: 1,
}

export default function GestionRecurrentes({ mostrarCifras }) {
  const [recurrentes, setRecurrentes] = useState([])
  const [formulario, setFormulario] = useState(null) // null | 'nuevo' | objeto
  const [cargando, setCargando] = useState(true)
  const supabase = createClient()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('apuntes_recurrentes')
      .select('*')
      .order('nombre')
    if (data) setRecurrentes(data)
    setCargando(false)
  }

  async function toggleActivo(r) {
    await supabase.from('apuntes_recurrentes').update({ activo: !r.activo }).eq('id', r.id)
    setRecurrentes(rs => rs.map(x => x.id === r.id ? { ...x, activo: !r.activo } : x))
  }

  async function eliminar(r) {
    await supabase.from('apuntes_recurrentes').delete().eq('id', r.id)
    setRecurrentes(rs => rs.filter(x => x.id !== r.id))
  }

  function onGuardado(nuevo) {
    if (nuevo._eliminado) {
      setRecurrentes(rs => rs.filter(x => x.id !== nuevo.id))
    } else if (formulario?.id) {
      setRecurrentes(rs => rs.map(x => x.id === nuevo.id ? nuevo : x))
    } else {
      setRecurrentes(rs => [...rs, nuevo])
    }
    setFormulario(null)
  }

  if (formulario !== null) {
    return (
      <FormRecurrente
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
          <h2 className="text-base font-bold text-gray-900">Apuntes recurrentes</h2>
          <p className="text-xs text-gray-400 mt-0.5">Se generan automáticamente cada mes</p>
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
      ) : recurrentes.length === 0 ? (
        <div className="text-center mt-16 text-gray-400 space-y-2">
          <div className="text-5xl">🔄</div>
          <p className="font-medium text-gray-500">No hay apuntes recurrentes</p>
          <p className="text-sm">Pulsa + Nuevo para añadir el primero</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          {recurrentes.map((r, idx) => {
            const importe = Number(r.importe)
            const esGasto = r.tipo === 'gasto' && importe >= 0
            return (
              <div key={r.id}
                className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''} ${!r.activo ? 'opacity-40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{r.nombre}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Día {r.dia_mes} de cada mes
                    {r.categoria ? ` · ${r.categoria}` : ''}
                    {r.medio_pago ? ` · ${r.medio_pago}` : ''}
                  </p>
                  {r.ultimo_generado && (
                    <p className="text-xs text-emerald-500 mt-0.5">✓ Generado {r.ultimo_generado}</p>
                  )}
                </div>
                <div className="text-right shrink-0 mr-2">
                  <p className={`font-bold text-sm ${esGasto ? 'text-red-500' : 'text-emerald-500'}`}>
                    {ocultar(mostrarCifras, `${esGasto ? '−' : '+'}${Math.abs(importe).toFixed(2)} €`)}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => setFormulario(r)}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg font-medium">
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActivo(r)}
                    className={`text-xs px-2 py-1 rounded-lg font-medium ${r.activo ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-600'}`}>
                    {r.activo ? 'Pausar' : 'Activar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FormRecurrente({ inicial, onGuardado, onCancelar }) {
  const [form, setForm] = useState({
    ...inicial,
    importe: inicial.importe != null ? String(inicial.importe) : '',
    subcategoria: inicial.subcategoria || '',
    establecimiento: inicial.establecimiento || '',
    descripcion: inicial.descripcion || '',
    medio_pago: inicial.medio_pago || '',
    dia_mes: inicial.dia_mes || 1,
  })
  const [categorias, setCategorias] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const supabase = createClient()

  useEffect(() => { cargarCategorias().then(setCategorias) }, [])

  const esEdicion = !!inicial.id
  const principales = principalesPorTipo(categorias, form.tipo)
  const subcategorias = form.categoria
    ? subcategoriasDeCategoria(categorias, principales.find(c => c.nombre === form.categoria)?.id)
    : []

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    const importeNormalizado = normalizarImporte(form.importe)
    if (!form.importe || isNaN(parseFloat(importeNormalizado))) { setError('El importe es obligatorio.'); return }
    if (!form.categoria) { setError('La categoría es obligatoria.'); return }

    setGuardando(true)
    setError('')

    const datos = {
      nombre: form.nombre.trim(),
      importe: parseFloat(importeNormalizado),
      tipo: form.tipo,
      categoria: form.categoria,
      subcategoria: form.subcategoria || null,
      establecimiento: form.establecimiento || null,
      descripcion: form.descripcion || null,
      medio_pago: form.medio_pago || null,
      dia_mes: parseInt(form.dia_mes) || 1,
      activo: inicial.activo ?? true,
    }

    let resultado
    if (esEdicion) {
      const { data, error } = await supabase.from('apuntes_recurrentes').update(datos).eq('id', inicial.id).select().single()
      if (error) { setError('Error al guardar.'); setGuardando(false); return }
      resultado = data
    } else {
      const { data, error } = await supabase.from('apuntes_recurrentes').insert([datos]).select().single()
      if (error) { setError('Error al guardar.'); setGuardando(false); return }
      resultado = data
    }

    onGuardado(resultado)
  }

  async function eliminar() {
    await supabase.from('apuntes_recurrentes').delete().eq('id', inicial.id)
    onGuardado({ _eliminado: true, id: inicial.id })
  }

  return (
    <div className="space-y-3 pb-28">
      <h2 className="text-base font-bold text-gray-900 mb-2">
        {esEdicion ? 'Editar recurrente' : 'Nuevo apunte recurrente'}
      </h2>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Nombre</label>
        <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
          placeholder="Hipoteca, Netflix, Seguro..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        <button type="button" onClick={() => { set('tipo', 'gasto'); set('categoria', '') }}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${form.tipo === 'gasto' ? 'bg-red-500 text-white' : 'bg-white text-gray-400'}`}>
          💸 Gasto
        </button>
        <button type="button" onClick={() => { set('tipo', 'ingreso'); set('categoria', '') }}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${form.tipo === 'ingreso' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-400'}`}>
          💰 Ingreso
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Importe</label>
        <div className="relative">
          <input type="text" inputMode="decimal" value={form.importe}
            onChange={e => set('importe', e.target.value.replace(',', '.'))}
            className="w-full pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="0,00" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-gray-300 font-bold">€</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Día del mes</label>
        <input type="number" min="1" max="28" value={form.dia_mes} onChange={e => set('dia_mes', e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <p className="text-xs text-gray-400 mt-0.5 pl-1">Máximo 28 para evitar problemas en febrero</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Categoría</label>
        <select value={form.categoria} onChange={e => { set('categoria', e.target.value); set('subcategoria', '') }}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">Selecciona categoría...</option>
          {principales.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
      </div>

      {subcategorias.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Subcategoría</label>
          <select value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            <option value="">Sin subcategoría</option>
            {subcategorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Establecimiento (opcional)</label>
        <input type="text" value={form.establecimiento} onChange={e => set('establecimiento', e.target.value)}
          placeholder="Banco, Netflix, Mutua..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notas (opcional)</label>
        <input type="text" value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
          placeholder="Descripción breve..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Medio de pago (opcional)</label>
        <div className="grid grid-cols-2 gap-1.5">
          {MEDIOS_PAGO.map(m => (
            <button key={m.valor} type="button"
              onClick={() => set('medio_pago', form.medio_pago === m.valor ? '' : m.valor)}
              className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${form.medio_pago === m.valor ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200'}`}>
              <span>{m.emoji}</span>
              <span className="truncate">{m.valor}</span>
            </button>
          ))}
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

      {esEdicion && (
        !confirmando ? (
          <button type="button" onClick={() => setConfirmando(true)}
            className="w-full py-2.5 bg-red-50 border border-red-200 text-red-500 rounded-xl text-sm font-semibold">
            🗑️ Eliminar recurrente
          </button>
        ) : (
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmando(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">
              No, cancelar
            </button>
            <button type="button" onClick={eliminar}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold">
              Sí, eliminar
            </button>
          </div>
        )
      )}
    </div>
  )
}

function normalizarImporte(valor) {
  const s = String(valor).trim()
  if (s.includes(',') && s.includes('.')) {
    return s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    return s.replace(',', '.')
  }
  return s
}
