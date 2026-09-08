'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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

  // ── Cambiar la propia contraseña ──────────────────────────────────────
  // Hace falta para que cada uno tenga la suya de verdad: si la pone otra
  // persona y no se puede cambiar desde aquí, esa persona la sabe siempre,
  // y entonces los gastos personales no son privados.
  const [clave, setClave] = useState('')
  const [claveRepetida, setClaveRepetida] = useState('')
  const [estadoClave, setEstadoClave] = useState(null) // null | 'guardando' | 'ok' | mensaje de error
  const [mostrarClave, setMostrarClave] = useState(false)

  async function cambiarContrasena() {
    if (clave.length < 6) { setEstadoClave('La contraseña tiene que tener 6 caracteres o más.'); return }
    if (clave !== claveRepetida) { setEstadoClave('Las dos contraseñas no coinciden.'); return }

    setEstadoClave('guardando')
    const { error } = await createClient().auth.updateUser({ password: clave })
    if (error) {
      setEstadoClave('No se ha podido cambiar. Sal de la app, vuelve a entrar e inténtalo otra vez.')
      return
    }
    setClave('')
    setClaveRepetida('')
    setEstadoClave('ok')
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

      {/* Mi contraseña */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Mi contraseña</p>
        <p className="text-xs text-gray-400 mb-2.5">
          Ponte una que solo sepas tú. Es lo que hace que tus gastos personales sean tuyos.
        </p>

        {!mostrarClave ? (
          <button type="button" onClick={() => { setMostrarClave(true); setEstadoClave(null) }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-500">
            Cambiar mi contraseña
          </button>
        ) : (
          <div className="space-y-2">
            <input type="password" value={clave} autoComplete="new-password"
              onChange={e => { setClave(e.target.value); setEstadoClave(null) }}
              placeholder="Contraseña nueva"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input type="password" value={claveRepetida} autoComplete="new-password"
              onChange={e => { setClaveRepetida(e.target.value); setEstadoClave(null) }}
              placeholder="Repítela"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />

            {estadoClave && estadoClave !== 'ok' && estadoClave !== 'guardando' && (
              <p className="text-xs text-red-500">{estadoClave}</p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={cambiarContrasena} disabled={estadoClave === 'guardando'}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#0d1b2a] text-white disabled:opacity-50">
                {estadoClave === 'guardando' ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button"
                onClick={() => { setMostrarClave(false); setClave(''); setClaveRepetida(''); setEstadoClave(null) }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {estadoClave === 'ok' && (
          <p className="text-xs text-emerald-600 font-semibold mt-2">
            ✓ Contraseña cambiada. A partir de ahora entras con la nueva.
          </p>
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
