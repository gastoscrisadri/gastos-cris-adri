'use client'

// Poner una contraseña nueva, al llegar desde el enlace del correo.
//
// Sin esto, quien olvide su contraseña se queda fuera de su propia
// contabilidad: la app solo sabía entrar sabiéndola, y cambiarla solo se podía
// desde dentro. La única salida era el panel de Supabase, que es una pantalla
// técnica y en inglés.
//
// El enlace del correo puede llegar de dos formas distintas según cómo esté
// configurado Supabase y con qué navegador se abra. Se aceptan las dos, y si
// no vale ninguna se dice claramente en vez de dejar la pantalla muerta.

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NuevaClavePage() {
  const [estado, setEstado] = useState('comprobando')  // comprobando | listo | sinEnlace
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function comprobar() {
      // Forma 1: el enlace trae un código en la dirección (?code=...)
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        setEstado(error ? 'sinEnlace' : 'listo')
        return
      }

      // Forma 2: el enlace trae los datos detrás de una almohadilla (#...)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        setEstado(error ? 'sinEnlace' : 'listo')
        return
      }

      // Si ya hay sesión abierta (la librería puede haberlo hecho sola), vale
      const { data } = await supabase.auth.getUser()
      setEstado(data?.user ? 'listo' : 'sinEnlace')
    }

    comprobar()
  }, [])

  async function guardar(e) {
    e.preventDefault()
    setError('')
    if (clave.length < 6) { setError('La contraseña tiene que tener al menos 6 caracteres.'); return }
    if (clave !== repetida) { setError('Las dos contraseñas no son iguales.'); return }

    setGuardando(true)
    const { error } = await createClient().auth.updateUser({ password: clave })
    setGuardando(false)
    if (error) { setError('No se ha podido cambiar. Pide otro enlace e inténtalo de nuevo.'); return }
    setHecho(true)
    setTimeout(() => { router.push('/'); router.refresh() }, 1800)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-[var(--info-fondo)] to-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold text-[var(--tinta)]">Nueva contraseña</h1>
        </div>

        {estado === 'comprobando' && (
          <p className="text-sm text-[var(--tinta-4)] text-center">Comprobando el enlace…</p>
        )}

        {estado === 'sinEnlace' && (
          <div className="text-center space-y-4">
            <p className="text-sm text-[var(--tinta-3)] bg-[var(--aviso-fondo)] border border-[var(--aviso-linea)] rounded-2xl p-4 leading-snug">
              Este enlace no vale o ha caducado. Los enlaces duran poco rato a propósito.
              Vuelve a pedir uno desde la pantalla de entrada.
            </p>
            <button onClick={() => router.push('/login')}
              className="w-full py-4 bg-[var(--acento)] text-[var(--acento-tinta)] rounded-2xl text-base font-bold shadow-md">
              Volver a la entrada
            </button>
          </div>
        )}

        {estado === 'listo' && !hecho && (
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1.5">Contraseña nueva</label>
              <input type="password" required value={clave} autoComplete="new-password"
                onChange={e => setClave(e.target.value)}
                className="w-full px-4 py-3.5 border border-[var(--linea)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--acento)] bg-[var(--superficie)]"
                placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1.5">Repítela</label>
              <input type="password" required value={repetida} autoComplete="new-password"
                onChange={e => setRepetida(e.target.value)}
                className="w-full px-4 py-3.5 border border-[var(--linea)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--acento)] bg-[var(--superficie)]"
                placeholder="••••••••" />
            </div>

            {error && <p className="text-[var(--gasto)] text-sm text-center bg-[#3A2230] py-2 rounded-xl">{error}</p>}

            <button type="submit" disabled={guardando}
              className="w-full py-4 bg-[var(--acento)] text-[var(--acento-tinta)] rounded-2xl text-base font-bold disabled:opacity-50 shadow-md mt-2">
              {guardando ? 'Guardando…' : 'Guardar y entrar'}
            </button>
          </form>
        )}

        {hecho && (
          <p className="text-sm font-semibold text-[var(--comun)] text-center bg-[var(--comun-fondo)] border border-[var(--comun)] rounded-2xl p-4">
            Contraseña cambiada. Entrando…
          </p>
        )}
      </div>
    </div>
  )
}
