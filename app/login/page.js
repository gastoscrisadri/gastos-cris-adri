'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  // Recuperar la contraseña. Va aparte de la entrada de siempre a propósito:
  // login() no se toca, que es la que funciona todos los días.
  const [modo, setModo] = useState('entrar')   // 'entrar' | 'recuperar'
  const [enviado, setEnviado] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function login(e) {
    e.preventDefault()
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setCargando(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  async function pedirEnlace(e) {
    e.preventDefault()
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-clave`,
    })
    setCargando(false)
    // Se dice lo mismo haya o no cuenta con ese correo: si dijéramos "ese
    // correo no existe" estaríamos contando quién tiene cuenta y quién no.
    if (error) { setError('No se ha podido enviar. Inténtalo dentro de un rato.'); return }
    setEnviado(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-[var(--info-fondo)] to-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">💰</div>
          <p className="text-xs font-semibold text-[var(--adri)] uppercase tracking-widest mb-1">Control de gastos</p>
          <h1 className="text-2xl font-bold text-[var(--tinta)]">Cris y Adri</h1>
        </div>

        {modo === 'entrar' ? (
        <form onSubmit={login} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 border border-[var(--linea)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--acento)] bg-[var(--superficie)]"
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1.5">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 border border-[var(--linea)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--acento)] bg-[var(--superficie)]"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-[var(--gasto)] text-sm text-center bg-[#3A2230] py-2 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-4 bg-[var(--acento)] text-[var(--acento-tinta)] rounded-2xl text-base font-bold disabled:opacity-50 shadow-md mt-2"
          >
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>

          <button type="button" onClick={() => { setModo('recuperar'); setError('') }}
            className="w-full py-2 text-sm text-[var(--acento)] font-semibold">
            He olvidado mi contraseña
          </button>
        </form>
        ) : enviado ? (
          <div className="space-y-4 text-center">
            <div className="text-4xl">📧</div>
            <p className="text-sm text-[var(--tinta-3)] bg-[var(--comun-fondo)] border border-[var(--comun)] rounded-2xl p-4 leading-snug">
              Si hay una cuenta con ese correo, te llega un mensaje con un enlace para poner
              una contraseña nueva. <b>Mira también en la carpeta de spam.</b>
            </p>
            <button type="button" onClick={() => { setModo('entrar'); setEnviado(false) }}
              className="w-full py-3 text-sm text-[var(--acento)] font-semibold">
              Volver a la entrada
            </button>
          </div>
        ) : (
          <form onSubmit={pedirEnlace} className="space-y-4">
            <p className="text-sm text-[var(--tinta-3)] text-center leading-snug">
              Pon tu correo y te mandamos un enlace para poner una contraseña nueva.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" required value={email} autoComplete="email"
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 border border-[var(--linea)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--acento)] bg-[var(--superficie)]"
                placeholder="tu@email.com" />
            </div>

            {error && <p className="text-[var(--gasto)] text-sm text-center bg-[#3A2230] py-2 rounded-xl">{error}</p>}

            <button type="submit" disabled={cargando}
              className="w-full py-4 bg-[var(--acento)] text-[var(--acento-tinta)] rounded-2xl text-base font-bold disabled:opacity-50 shadow-md mt-2">
              {cargando ? 'Enviando...' : 'Enviarme el enlace'}
            </button>
            <button type="button" onClick={() => { setModo('entrar'); setError('') }}
              className="w-full py-2 text-sm text-[var(--tinta-4)] font-semibold">
              Volver a la entrada
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
