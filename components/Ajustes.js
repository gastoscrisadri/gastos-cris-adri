'use client'

import { useState, useEffect } from 'react'
import GestionRecurrentes from './GestionRecurrentes'
import GestionCategorias from './GestionCategorias'
import GestionCuentas from './GestionCuentas'
import GestionEventos from './GestionEventos'

const SECCIONES = [
  { id: 'recurrentes', emoji: '🔄', label: 'Fijos' },
  { id: 'cuentas', emoji: '💳', label: 'Cuentas' },
  { id: 'categorias', emoji: '🗂️', label: 'Categorías' },
  { id: 'eventos', emoji: '🎯', label: 'Eventos' },
]

export default function Ajustes({ transacciones, onVerDetalleEvento, mostrarCifras }) {
  const [seccion, setSeccion] = useState('recurrentes')
  const [duenoMovil, setDuenoMovil] = useState('')

  // Se guarda en este móvil, no en la base de datos: cada teléfono es de uno
  useEffect(() => {
    setDuenoMovil(localStorage.getItem('quienRegistra') || '')
  }, [])

  function elegirDueno(nombre) {
    localStorage.setItem('quienRegistra', nombre)
    setDuenoMovil(nombre)
  }

  return (
    <div className="pb-24">
      {/* De quién es este móvil */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Este móvil es de</p>
        <p className="text-xs text-gray-400 mb-2.5">Los apuntes que hagas se guardarán a este nombre</p>
        <div className="flex gap-2">
          {['Cris', 'Adri'].map(nombre => (
            <button key={nombre} type="button" onClick={() => elegirDueno(nombre)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${duenoMovil === nombre ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-white text-gray-400 border-gray-200'}`}>
              {nombre}
            </button>
          ))}
        </div>
        {!duenoMovil && (
          <p className="text-xs text-amber-600 mt-2">Sin elegir: al crear un apunte se preguntará cada vez.</p>
        )}
      </div>

      {/* Sub-navegación */}
      <div className="grid grid-cols-4 gap-1 bg-gray-100 rounded-2xl p-1 mb-5">
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => setSeccion(s.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-xs font-semibold transition-colors ${seccion === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
            <span>{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {seccion === 'recurrentes' && <GestionRecurrentes mostrarCifras={mostrarCifras} />}
      {seccion === 'cuentas' && <GestionCuentas transacciones={transacciones} mostrarCifras={mostrarCifras} />}
      {seccion === 'categorias' && <GestionCategorias />}
      {seccion === 'eventos' && <GestionEventos onVerDetalle={onVerDetalleEvento} mostrarCifras={mostrarCifras} />}
    </div>
  )
}
