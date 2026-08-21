'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SaldosCuentas({ transacciones }) {
  const [cuentas, setCuentas] = useState([])
  const [editando, setEditando] = useState(null)
  const [valorEdicion, setValorEdicion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('cuentas').select('*').order('nombre').then(({ data }) => {
      if (data) setCuentas(data)
    })
  }, [])

  // Calcular movimientos acumulados de TODOS los apuntes por cuenta
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

  function iniciarEdicion(cuenta) {
    setEditando(cuenta.id)
    setValorEdicion(String(cuenta.saldo_inicial))
  }

  async function guardarSaldo(cuenta) {
    const nuevoSaldo = parseFloat(valorEdicion)
    if (isNaN(nuevoSaldo)) return
    setGuardando(true)
    await supabase.from('cuentas').update({ saldo_inicial: nuevoSaldo }).eq('id', cuenta.id)
    setCuentas(cs => cs.map(c => c.id === cuenta.id ? { ...c, saldo_inicial: nuevoSaldo } : c))
    setEditando(null)
    setGuardando(false)
  }

  if (!cuentas.length) return null

  // Solo mostrar cuentas que tienen saldo_inicial distinto de 0 o que tienen movimientos
  const cuentasConDatos = cuentas.filter(c => {
    const mov = movimientos[c.nombre]
    return c.saldo_inicial !== 0 || mov
  })

  if (!cuentasConDatos.length) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Saldos de cuentas</p>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center space-y-3">
          <p className="text-sm text-gray-500">Introduce el saldo inicial de cada cuenta para ver el arrastre en tiempo real.</p>
          <button
            onClick={() => setEditando('_config')}
            className="text-xs text-blue-500 underline">
            Configurar saldos iniciales →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Saldos de cuentas</p>
        <button
          onClick={() => setEditando(editando === '_config' ? null : '_config')}
          className="text-xs text-blue-500 font-medium">
          {editando === '_config' ? 'Cerrar' : '⚙️ Configurar'}
        </button>
      </div>

      {/* Modo configuración: editar saldos iniciales de todas las cuentas */}
      {editando === '_config' ? (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          {cuentas.map((cuenta, idx) => {
            const mov = movimientos[cuenta.nombre] || { ingresos: 0, gastos: 0 }
            const saldoActual = cuenta.saldo_inicial + mov.ingresos - mov.gastos
            return (
              <div key={cuenta.id} className={`px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">{cuenta.emoji}</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">{cuenta.nombre}</span>
                  <span className={`text-sm font-bold ${saldoActual >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {saldoActual >= 0 ? '+' : ''}{saldoActual.toFixed(2)} €
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 shrink-0">Saldo inicial:</span>
                  <SaldoInlineEdit
                    valor={cuenta.saldo_inicial}
                    onGuardar={async (v) => {
                      await supabase.from('cuentas').update({ saldo_inicial: v }).eq('id', cuenta.id)
                      setCuentas(cs => cs.map(c => c.id === cuenta.id ? { ...c, saldo_inicial: v } : c))
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Modo visualización: tarjetas de saldo */
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          {cuentasConDatos.map((cuenta, idx) => {
            const mov = movimientos[cuenta.nombre] || { ingresos: 0, gastos: 0 }
            const saldoActual = cuenta.saldo_inicial + mov.ingresos - mov.gastos
            const esPositivo = saldoActual >= 0

            return (
              <div key={cuenta.id}
                className={`px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center">{cuenta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{cuenta.nombre}</p>
                    <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                      {mov.ingresos > 0 && <span className="text-emerald-500">↑ {mov.ingresos.toFixed(2)} €</span>}
                      {mov.gastos > 0 && <span className="text-red-400">↓ {mov.gastos.toFixed(2)} €</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-bold ${esPositivo ? 'text-emerald-500' : 'text-red-500'}`}>
                      {esPositivo ? '+' : ''}{saldoActual.toFixed(2)} €
                    </p>
                    <p className="text-[10px] text-gray-300">saldo actual</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SaldoInlineEdit({ valor, onGuardar }) {
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
        className="flex items-center gap-1 text-xs text-blue-500 font-medium border border-blue-200 rounded-lg px-2 py-1 bg-blue-50">
        {valor.toFixed(2)} € <span className="text-gray-300">✏️</span>
      </button>
    )
  }

  return (
    <div className="flex gap-1 flex-1">
      <input type="number" step="0.01" value={temp} autoFocus
        onChange={e => setTemp(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && guardar()}
        className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
      <button onClick={guardar} disabled={guardando}
        className="px-2 py-1 bg-blue-600 text-white text-xs rounded-lg font-semibold disabled:opacity-50">
        {guardando ? '...' : '✓'}
      </button>
      <button onClick={() => setEditando(false)}
        className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-lg">✕</button>
    </div>
  )
}
