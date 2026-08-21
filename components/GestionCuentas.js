'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ocultar } from '@/lib/cifras'

export default function GestionCuentas({ transacciones, mostrarCifras }) {
  const [cuentas, setCuentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const supabase = createClient()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('cuentas').select('*').order('nombre')
    if (data) setCuentas(data)
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
          Introduce el saldo inicial de cada cuenta. El saldo actual se calcula restando todos los apuntes registrados.
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
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{cuenta.nombre}</p>
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
            </div>
          )
        })}
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
