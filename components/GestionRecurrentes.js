'use client'

import { useState, useEffect } from 'react'
import { ocultar, euros } from '@/lib/cifras'
import { createClient } from '@/lib/supabase/client'
import { cargarCategorias, principalesPorTipo, subcategoriasDeCategoria } from '@/lib/categorias'
import { cargarCuentas, soloActivas, CUENTAS_RESPALDO } from '@/lib/cuentas'

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
    const activando = !r.activo

    // Al REACTIVAR hay que ponerlo al día antes de encenderlo.
    //
    // La app rellena los meses que falten desde el último generado, y eso es
    // lo que se quiere cuando nadie ha abierto la app en un tiempo. Pero si
    // este gasto llevaba medio año pausado A PROPÓSITO, su último mes
    // generado es de hace medio año, y al reactivarlo se crearían de golpe
    // los seis meses que estuvo apagado. Nadie quiere eso.
    //
    // Poniéndole el mes pasado, al reactivarlo genera solo el mes en curso,
    // que es justo lo que espera quien pulsa "Activar".
    const datos = { activo: activando }
    if (activando) {
      const d = new Date()
      d.setDate(1)                  // primero el día, o al restar un mes se va al que no es
      d.setMonth(d.getMonth() - 1)
      datos.ultimo_generado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    await supabase.from('apuntes_recurrentes').update(datos).eq('id', r.id)
    setRecurrentes(rs => rs.map(x => x.id === r.id ? { ...x, ...datos } : x))
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
          <h2 className="text-base font-bold text-[var(--tinta)]">Apuntes recurrentes</h2>
          <p className="text-xs text-[var(--tinta-4)] mt-0.5">Se generan automáticamente cada mes</p>
        </div>
        <button
          onClick={() => setFormulario('nuevo')}
          className="px-4 py-2 bg-[var(--superficie)] text-white text-sm font-semibold rounded-xl">
          + Nuevo
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center mt-10">
          <div className="w-6 h-6 border-2 border-[var(--acento)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : recurrentes.length === 0 ? (
        <div className="text-center mt-16 text-[var(--tinta-4)] space-y-2">
          <div className="text-5xl">🔄</div>
          <p className="font-medium text-[var(--tinta-3)]">No hay apuntes recurrentes</p>
          <p className="text-sm">Pulsa + Nuevo para añadir el primero</p>
        </div>
      ) : (
        <div className="bg-[var(--superficie)] rounded-2xl overflow-hidden shadow-sm border border-[var(--linea-2)]">
          {recurrentes.map((r, idx) => {
            const importe = Number(r.importe)
            const esGasto = r.tipo === 'gasto' && importe >= 0
            return (
              <div key={r.id}
                className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-[var(--linea-3)]' : ''} ${!r.activo ? 'opacity-40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--tinta)] text-sm truncate">{r.nombre}</p>
                  <p className="text-xs text-[var(--tinta-4)] mt-0.5">
                    Día {r.dia_mes} de cada mes
                    {r.categoria ? ` · ${r.categoria}` : ''}
                    {r.medio_pago ? ` · ${r.medio_pago}` : ''}
                  </p>
                  {r.ultimo_generado && (
                    <p className="text-xs text-[var(--ingreso)] mt-0.5">✓ Generado {r.ultimo_generado}</p>
                  )}
                </div>
                <div className="text-right shrink-0 mr-2">
                  <p className={`font-bold text-sm ${esGasto ? 'text-[var(--gasto)]' : 'text-[var(--ingreso)]'}`}>
                    {ocultar(mostrarCifras, `${esGasto ? '−' : '+'}${euros(Math.abs(importe))} €`)}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => setFormulario(r)}
                    className="text-xs px-2 py-1 bg-[var(--info-fondo)] text-[var(--acento)] rounded-lg font-medium">
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActivo(r)}
                    className={`text-xs px-2 py-1 rounded-lg font-medium ${r.activo ? 'bg-[var(--superficie-3)] text-[var(--tinta-3)]' : 'bg-[var(--comun-fondo)] text-[var(--ingreso)]'}`}>
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
  const [mediosPago, setMediosPago] = useState(CUENTAS_RESPALDO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const supabase = createClient()

  useEffect(() => { cargarCategorias().then(setCategorias) }, [])
  useEffect(() => { cargarCuentas().then(cs => setMediosPago(soloActivas(cs))) }, [])

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
    // El medio de pago es OBLIGATORIO, igual que en el formulario de nuevo
    // apunte. No es un campo más: es lo único que dice quién puso el dinero.
    //
    // Sin él, el apunte que se genere cada mes sale en el total del mes pero
    // NO entra en la cuenta de los dos: el cálculo lo trata como dinero que no
    // ha puesto ninguno y lo descuenta de lo que hay que repartir. Un alquiler
    // de 1.400 € que aparece en los informes y no mueve la deuda, cada mes,
    // sin que nada lo avise. Por eso aquí se corta.
    if (!form.medio_pago) { setError('Di con qué se paga: es lo que dice quién pone el dinero.'); return }

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
      <h2 className="text-base font-bold text-[var(--tinta)] mb-2">
        {esEdicion ? 'Editar recurrente' : 'Nuevo apunte recurrente'}
      </h2>

      <div>
        <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1">Nombre</label>
        <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
          placeholder="Hipoteca, Netflix, Seguro..."
          className="w-full px-3 py-2.5 border border-[var(--linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--acento)]" />
      </div>

      <div className="flex rounded-xl overflow-hidden border border-[var(--linea)]">
        <button type="button" onClick={() => { set('tipo', 'gasto'); set('categoria', '') }}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${form.tipo === 'gasto' ? 'bg-red-500 text-white' : 'bg-[var(--superficie)] text-[var(--tinta-4)]'}`}>
          💸 Gasto
        </button>
        <button type="button" onClick={() => { set('tipo', 'ingreso'); set('categoria', '') }}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${form.tipo === 'ingreso' ? 'bg-emerald-500 text-white' : 'bg-[var(--superficie)] text-[var(--tinta-4)]'}`}>
          💰 Ingreso
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1">Importe</label>
        <div className="relative">
          <input type="text" inputMode="decimal" value={form.importe}
            onChange={e => set('importe', e.target.value.replace(',', '.'))}
            className="w-full pl-4 pr-10 py-2.5 border border-[var(--linea)] rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-[var(--acento)]"
            placeholder="0,00" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-[var(--tinta-5)] font-bold">€</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1">Día del mes</label>
        <input type="number" min="1" max="28" value={form.dia_mes} onChange={e => set('dia_mes', e.target.value)}
          className="w-full px-3 py-2.5 border border-[var(--linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--acento)]" />
        <p className="text-xs text-[var(--tinta-4)] mt-0.5 pl-1">Máximo 28 para evitar problemas en febrero</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1">Categoría</label>
        <select value={form.categoria} onChange={e => { set('categoria', e.target.value); set('subcategoria', '') }}
          className="w-full px-3 py-2.5 border border-[var(--linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--acento)] bg-[var(--superficie)]">
          <option value="">Selecciona categoría...</option>
          {principales.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
      </div>

      {subcategorias.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1">Subcategoría</label>
          <select value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--acento)] bg-[var(--superficie)]">
            <option value="">Sin subcategoría</option>
            {subcategorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1">Establecimiento (opcional)</label>
        <input type="text" value={form.establecimiento} onChange={e => set('establecimiento', e.target.value)}
          placeholder="Banco, Netflix, Mutua..."
          className="w-full px-3 py-2.5 border border-[var(--linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--acento)]" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1">Notas (opcional)</label>
        <input type="text" value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
          placeholder="Descripción breve..."
          className="w-full px-3 py-2.5 border border-[var(--linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--acento)]" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1">Medio de pago *</label>
        <div className="grid grid-cols-2 gap-1.5">
          {mediosPago.map(m => (
            <button key={m.nombre} type="button"
              onClick={() => set('medio_pago', m.nombre)}
              className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${form.medio_pago === m.nombre ? 'bg-[var(--acento)] text-[var(--acento-tinta)] border-[var(--acento)]' : 'bg-[var(--superficie)] text-[var(--tinta-4)] border-[var(--linea)]'}`}>
              <span>{m.emoji}</span>
              <span className="truncate">{m.nombre}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[#FFBAC8] text-sm bg-[#6B3E4C] rounded-xl p-3">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar}
          className="flex-1 py-2.5 border border-[var(--linea)] rounded-xl text-sm text-[#F0DCE1] font-medium">
          Cancelar
        </button>
        <button type="button" onClick={guardar} disabled={guardando}
          className="flex-1 py-2.5 bg-[var(--acento)] text-[var(--acento-tinta)] rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm">
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {esEdicion && (
        !confirmando ? (
          <button type="button" onClick={() => setConfirmando(true)}
            className="w-full py-2.5 bg-[#6B3E4C] border border-[#7A4657] text-[#FFBAC8] rounded-xl text-sm font-semibold">
            🗑️ Eliminar recurrente
          </button>
        ) : (
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmando(false)}
              className="flex-1 py-2.5 border border-[var(--linea)] rounded-xl text-sm text-[#F0DCE1] font-medium">
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
