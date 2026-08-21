'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ocultar } from '@/lib/cifras'

export default function GestionCuentas({ transacciones, mostrarCifras }) {
  const [cuentas, setCuentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)
  const [nombreEdicion, setNombreEdicion] = useState('')
  const [nuevaCuenta, setNuevaCuenta] = useState({ nombre: '', emoji: '💳', persona: 'Común' })
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('cuentas').select('*').order('nombre')
    if (data) setCuentas(data.filter(c => c.activa !== false))
    setCargando(false)
  }

  const movimientos = useMemo(() => {
    const map = {}
    transacciones.forEach(t => {
      if (!t.medio_pago) return
      if (!map[t.medio_pago]) map[t.medio_pago] = { ingresos: 0, gastos: 0 }
      if (t.tipo === 'ingreso') map[t.medio_pago].ingresos += Number(t.importe)
      else map[t.medio_pago].gastos += Number(t.importe)
    })
    return map
  }, [transacciones])

  async function actualizarSaldo(cuenta, nuevoSaldo) {
    await supabase.from('cuentas').update({ saldo_inicial: nuevoSaldo }).eq('id', cuenta.id)
    setCuentas(cs => cs.map(c => c.id === cuenta.id ? { ...c, saldo_inicial: nuevoSaldo } : c))
  }

  async function crear() {
    const nombre = nuevaCuenta.nombre.trim()
    if (!nombre) return
    if (cuentas.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      setError('Ya hay una cuenta con ese nombre.')
      return
    }
    const { error: err } = await supabase.from('cuentas').insert({
      nombre,
      emoji: nuevaCuenta.emoji || '💳',
      persona: nuevaCuenta.persona,
      saldo_inicial: 0,
    })
    if (err) { setError('No se ha podido crear la cuenta.'); return }
    setNuevaCuenta({ nombre: '', emoji: '💳', persona: 'Común' })
    setError('')
    cargar()
  }

  // Los apuntes guardan el medio de pago como texto, no como referencia. Si
  // solo renombráramos la cuenta, sus apuntes se quedarían apuntando a un
  // nombre que ya no existe: hay que renombrarlos a la vez.
  async function renombrar(cuenta, nombreNuevo) {
    const nombre = nombreNuevo.trim()
    if (!nombre || nombre === cuenta.nombre) return
    if (cuentas.some(c => c.id !== cuenta.id && c.nombre.toLowerCase() === nombre.toLowerCase())) {
      setError('Ya hay una cuenta con ese nombre.')
      return
    }

    const { error: errApuntes } = await supabase
      .from('transacciones')
      .update({ medio_pago: nombre })
      .eq('medio_pago', cuenta.nombre)

    if (errApuntes) {
      setError('No se han podido actualizar los apuntes. La cuenta no se ha renombrado.')
      return
    }

    await supabase.from('cuentas').update({ nombre }).eq('id', cuenta.id)
    setError('')
    cargar()
  }

  async function cambiarPersona(cuenta, persona) {
    await supabase.from('cuentas').update({ persona }).eq('id', cuenta.id)
    setCuentas(cs => cs.map(c => c.id === cuenta.id ? { ...c, persona } : c))
  }

  // Igual que con las categorías: si nunca se ha usado se borra de verdad,
  // y si tiene apuntes solo se oculta, para no dejarlos sin medio de pago.
  async function quitar(cuenta) {
    const { count, error: errCount } = await supabase
      .from('transacciones')
      .select('id', { count: 'exact', head: true })
      .eq('medio_pago', cuenta.nombre)

    if (errCount) {
      setError('No he podido comprobar si la cuenta está en uso. Inténtalo de nuevo.')
      return
    }

    const usados = count || 0
    const aviso = usados > 0
      ? `"${cuenta.nombre}" se ha usado en ${usados} apunte${usados === 1 ? '' : 's'}.\n\n` +
        'Dejará de aparecer al crear apuntes nuevos, pero los ya guardados no cambian. ¿Seguimos?'
      : `Se borrará la cuenta "${cuenta.nombre}". No se ha usado en ningún apunte. ¿Seguimos?`

    if (!window.confirm(aviso)) return

    if (usados > 0) await supabase.from('cuentas').update({ activa: false }).eq('id', cuenta.id)
    else await supabase.from('cuentas').delete().eq('id', cuenta.id)
    setError('')
    cargar()
  }

  if (cargando) return (
    <div className="flex justify-center mt-10">
      <div className="w-6 h-6 border-2 border-[#0d1b2a] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="text-base font-bold text-gray-900">Cuentas</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Estas son las formas de pago que aparecen al crear un apunte. Pon el saldo inicial de cada una y el saldo actual se calcula solo. «El dinero es de» decide el reparto del informe «Quién puso el dinero».
        </p>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        {cuentas.map((cuenta, idx) => {
          const mov = movimientos[cuenta.nombre] || { ingresos: 0, gastos: 0 }
          const saldoActual = cuenta.saldo_inicial + mov.ingresos - mov.gastos
          const esPositivo = saldoActual >= 0

          return (
            <div key={cuenta.id}
              className={`px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">{cuenta.emoji}</span>
                <div className="flex-1 min-w-0">
                  {editando === cuenta.id ? (
                    <div className="flex items-center gap-1.5">
                      <input autoFocus value={nombreEdicion} onChange={e => setNombreEdicion(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { renombrar(cuenta, nombreEdicion); setEditando(null) } }}
                        className="flex-1 min-w-0 px-2 py-1 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      <button onClick={() => { renombrar(cuenta, nombreEdicion); setEditando(null) }}
                        className="text-blue-600 text-xs font-semibold shrink-0">Guardar</button>
                      <button onClick={() => setEditando(null)} className="text-gray-400 text-xs shrink-0">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{cuenta.nombre}</p>
                      <button onClick={() => { setEditando(cuenta.id); setNombreEdicion(cuenta.nombre) }}
                        className="text-xs text-gray-300 hover:text-blue-500 px-1">✏️</button>
                      <button onClick={() => quitar(cuenta)} aria-label={`Quitar ${cuenta.nombre}`}
                        className="text-xs text-gray-300 hover:text-red-500 px-1">🗑️</button>
                    </div>
                  )}
                  <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                    {mov.ingresos > 0 && <span className="text-emerald-500">↑ {ocultar(mostrarCifras, `${mov.ingresos.toFixed(2)} €`)}</span>}
                    {mov.gastos > 0 && <span className="text-red-400">↓ {ocultar(mostrarCifras, `${mov.gastos.toFixed(2)} €`)}</span>}
                    {!mov.ingresos && !mov.gastos && <span>Sin movimientos</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-base font-bold ${esPositivo ? 'text-emerald-500' : 'text-red-500'}`}>
                    {ocultar(mostrarCifras, `${esPositivo ? '+' : ''}${saldoActual.toFixed(2)} €`)}
                  </p>
                  <p className="text-[10px] text-gray-300">saldo actual</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">Saldo inicial:</span>
                <SaldoEditor valor={cuenta.saldo_inicial} onGuardar={v => actualizarSaldo(cuenta, v)} mostrarCifras={mostrarCifras} />
              </div>

              {/* De quién es este dinero — decide el reparto en Informes */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400 shrink-0">El dinero es de:</span>
                <div className="flex gap-1">
                  {['Cris', 'Adri', 'Común'].map(p => (
                    <button key={p} type="button" onClick={() => cambiarPersona(cuenta, p)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        (cuenta.persona || 'Común') === p
                          ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]'
                          : 'bg-white text-gray-400 border-gray-200'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      {/* Añadir cuenta */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Añadir cuenta</p>

        <div className="flex gap-2">
          <input value={nuevaCuenta.emoji} maxLength={2}
            onChange={e => setNuevaCuenta(c => ({ ...c, emoji: e.target.value }))}
            aria-label="Icono de la cuenta"
            className="w-14 text-center px-2 py-2 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input value={nuevaCuenta.nombre} placeholder="Nombre (p. ej. Tarjeta Cris)"
            onChange={e => setNuevaCuenta(c => ({ ...c, nombre: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && crear()}
            className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0">El dinero es de:</span>
          <div className="flex gap-1">
            {['Cris', 'Adri', 'Común'].map(p => (
              <button key={p} type="button" onClick={() => setNuevaCuenta(c => ({ ...c, persona: p }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  nuevaCuenta.persona === p
                    ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <button onClick={crear} disabled={!nuevaCuenta.nombre.trim()}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400">
          Añadir
        </button>
      </div>
    </div>
  )
}

function SaldoEditor({ valor, onGuardar, mostrarCifras }) {
  const [editando, setEditando] = useState(false)
  const [temp, setTemp] = useState(String(valor))
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { setTemp(String(valor)) }, [valor])

  async function guardar() {
    const v = parseFloat(temp)
    if (isNaN(v)) return
    setGuardando(true)
    await onGuardar(v)
    setEditando(false)
    setGuardando(false)
  }

  if (!editando) {
    return (
      <button onClick={() => setEditando(true)}
        className="flex items-center gap-1.5 text-xs text-blue-500 font-semibold border border-blue-200 rounded-lg px-2.5 py-1 bg-blue-50">
        {ocultar(mostrarCifras, `${valor.toFixed(2)} €`)} <span className="text-blue-300">✏️</span>
      </button>
    )
  }

  return (
    <div className="flex gap-1.5 flex-1">
      <input type="text" inputMode="decimal" value={temp} autoFocus
        onChange={e => setTemp(e.target.value.replace(',', '.'))}
        onKeyDown={e => e.key === 'Enter' && guardar()}
        className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
      <button onClick={guardar} disabled={guardando}
        className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg font-semibold disabled:opacity-50">
        {guardando ? '...' : '✓'}
      </button>
      <button onClick={() => setEditando(false)}
        className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs rounded-lg">✕</button>
    </div>
  )
}
