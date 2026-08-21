'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FormTransaccion from '@/components/FormTransaccion'
import ListaTransacciones from '@/components/ListaTransacciones'
import Informes from '@/components/Informes'
import Ajustes from '@/components/Ajustes'
import DetalleTransaccion from '@/components/DetalleTransaccion'
import DetalleEvento from '@/components/DetalleEvento'
import { ocultar } from '@/lib/cifras'

export default function Home() {
  // La app abre directamente en "nuevo apunte" con la cámara intentando
  // dispararse sola (ver FormTransaccion). Solo la primera vez que carga —
  // navegar por dentro de la app (Lista/Informes/Ajustes) no se ve afectado.
  const [vista, setVista] = useState('nuevo')
  const [autoAbrirCamara, setAutoAbrirCamara] = useState(true)
  // Cifras siempre ocultas al abrir, y cada pantalla (Lista/Informes/Ajustes)
  // recuerda su propia elección por separado — mostrar en una no las
  // destapa en las demás
  const [cifrasVisibles, setCifrasVisibles] = useState({})
  const mostrarCifras = !!cifrasVisibles[vista]
  function alternarCifras() {
    setCifrasVisibles(v => ({ ...v, [vista]: !v[vista] }))
  }
  const [transaccionDetalle, setTransaccionDetalle] = useState(null)
  const [transaccionEditar, setTransaccionEditar] = useState(null)
  const [transacciones, setTransacciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [toast, setToast] = useState(null)
  const [mostrarRecordatorioCopia, setMostrarRecordatorioCopia] = useState(false)
  const [avisoAlmacenamiento, setAvisoAlmacenamiento] = useState(false)
  const [eventoActivo, setEventoActivo] = useState(null)
  const [eventoDetalle, setEventoDetalle] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({ categoria: '', quien: '', medio_pago: '' })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUsuario(user))
  }, [])

  // Solo el arranque cuenta como "apertura de la app": una vez montado,
  // volver a entrar en "nuevo" (con el botón +) ya no dispara la cámara sola
  useEffect(() => {
    setAutoAbrirCamara(false)
  }, [])

  const cargarTransacciones = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase
      .from('transacciones')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (data) setTransacciones(data)
    setCargando(false)
  }, [])

  useEffect(() => { cargarTransacciones() }, [cargarTransacciones])

  const cargarEventoActivo = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data: eventos } = await supabase.from('eventos').select('*').eq('archivado', false)
    if (!eventos?.length) { setEventoActivo(null); return }

    // Si hay un evento cuyas fechas cubren hoy, activarlo automáticamente
    const eventoHoy = eventos.find(e =>
      (!e.fecha_inicio || e.fecha_inicio <= today) &&
      (!e.fecha_fin || e.fecha_fin >= today) &&
      (e.fecha_inicio || e.fecha_fin) // solo si tiene alguna fecha definida
    )

    const eventoYaActivo = eventos.find(e => e.activo)

    if (eventoHoy && !eventoHoy.activo) {
      // Activar el evento de hoy automáticamente
      await supabase.from('eventos').update({ activo: false }).neq('id', eventoHoy.id)
      await supabase.from('eventos').update({ activo: true }).eq('id', eventoHoy.id)
      setEventoActivo({ ...eventoHoy, activo: true })
    } else if (eventoYaActivo?.fecha_fin && eventoYaActivo.fecha_fin < today) {
      // El evento activo ya caducó → desactivar automáticamente
      await supabase.from('eventos').update({ activo: false }).eq('id', eventoYaActivo.id)
      setEventoActivo(null)
    } else {
      setEventoActivo(eventoYaActivo || null)
    }
  }, [])

  useEffect(() => { cargarEventoActivo() }, [cargarEventoActivo])

  // Comprobación de almacenamiento Supabase (una vez por semana)
  useEffect(() => {
    async function comprobarAlmacenamiento() {
      const KEY = 'ultimaRevisionAlmacenamiento'
      const ultima = localStorage.getItem(KEY)
      const ahora = Date.now()
      if (ultima && ahora - parseInt(ultima) < 30 * 24 * 60 * 60 * 1000) return

      const LIMITE_BYTES = 1_073_741_824 // 1 GB (plan gratuito Supabase)
      const UMBRAL = 0.75

      const { data: archivos } = await supabase.storage.from('documentos').list('', { limit: 1000 })
      if (!archivos) return

      const totalBytes = archivos.reduce((s, f) => s + (f.metadata?.size || 0), 0)
      localStorage.setItem(KEY, String(ahora))
      if (totalBytes >= LIMITE_BYTES * UMBRAL) setAvisoAlmacenamiento(true)
    }
    comprobarAlmacenamiento()
  }, [])

  // Recordatorio mensual de backup
  useEffect(() => {
    const mesActual = new Date().toISOString().slice(0, 7) // "2026-05"
    const copiaHecha = localStorage.getItem('copiaCsvHecha') // mes en que se descargó
    if (copiaHecha !== mesActual) {
      const timer = setTimeout(() => setMostrarRecordatorioCopia(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  function posponerRecordatorio() {
    // No guarda nada: la próxima vez que entre volverá a aparecer
    setMostrarRecordatorioCopia(false)
  }

  function marcarCopiaHecha() {
    const mesActual = new Date().toISOString().slice(0, 7)
    localStorage.setItem('copiaCsvHecha', mesActual)
    setMostrarRecordatorioCopia(false)
  }

  // Auto-generación de apuntes recurrentes al cargar
  useEffect(() => {
    async function generarRecurrentes() {
      const mesActual = new Date().toISOString().slice(0, 7)
      const { data: recurrentes } = await supabase
        .from('apuntes_recurrentes')
        .select('*')
        .eq('activo', true)

      if (!recurrentes?.length) return

      const pendientes = recurrentes.filter(r => r.ultimo_generado !== mesActual)
      if (!pendientes.length) return

      const [anio, mes] = mesActual.split('-')
      const inserts = pendientes.map(r => {
        const diasEnMes = new Date(parseInt(anio), parseInt(mes), 0).getDate()
        const dia = Math.min(r.dia_mes || 1, diasEnMes)
        return {
          fecha: `${mesActual}-${String(dia).padStart(2, '0')}`,
          importe: r.importe,
          tipo: r.tipo,
          categoria: r.categoria,
          subcategoria: r.subcategoria || null,
          establecimiento: r.establecimiento || null,
          descripcion: r.descripcion || null,
          medio_pago: r.medio_pago || null,
          quien: 'Auto',
        }
      })

      await supabase.from('transacciones').insert(inserts)
      await Promise.all(
        pendientes.map(r =>
          supabase.from('apuntes_recurrentes').update({ ultimo_generado: mesActual }).eq('id', r.id)
        )
      )
      await cargarTransacciones()
      mostrarToast(`🔄 ${pendientes.length} apunte${pendientes.length > 1 ? 's' : ''} fijo${pendientes.length > 1 ? 's' : ''} generado${pendientes.length > 1 ? 's' : ''}`)
    }
    generarRecurrentes()
  }, [])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function mostrarToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function onGuardado() {
    setVista('lista')
    cargarTransacciones()
    mostrarToast('✅ Apunte guardado')
  }

  // Balance del mes actual
  const balanceMes = useMemo(() => {
    const mesActual = new Date().toISOString().slice(0, 7)
    const delMes = transacciones.filter(t => t.fecha.startsWith(mesActual))
    const ingresos = delMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.importe), 0)
    const gastos = delMes.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.importe), 0)
    return { ingresos, gastos, balance: ingresos - gastos }
  }, [transacciones])

  const mesNombre = new Date().toLocaleString('es', { month: 'long', year: 'numeric' })

  const filtrosActivos = Object.values(filtros).filter(Boolean).length

  const categoriasFiltro = useMemo(() =>
    [...new Set(transacciones.map(t => t.categoria).filter(Boolean))].sort()
  , [transacciones])

  const mediosFiltro = useMemo(() =>
    [...new Set(transacciones.map(t => t.medio_pago).filter(Boolean))].sort()
  , [transacciones])

  const transaccionesFiltradas = useMemo(() => {
    let lista = transacciones
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(t =>
        (t.descripcion && t.descripcion.toLowerCase().includes(q)) ||
        (t.establecimiento && t.establecimiento.toLowerCase().includes(q)) ||
        (t.categoria && t.categoria.toLowerCase().includes(q)) ||
        (t.subcategoria && t.subcategoria.toLowerCase().includes(q))
      )
    }
    if (filtros.categoria) lista = lista.filter(t => t.categoria === filtros.categoria)
    if (filtros.quien) lista = lista.filter(t => t.quien === filtros.quien)
    if (filtros.medio_pago) lista = lista.filter(t => t.medio_pago === filtros.medio_pago)
    return lista
  }, [transacciones, busqueda, filtros])

  const gastoEvento = useMemo(() => {
    if (!eventoActivo) return 0
    return transacciones
      .filter(t => t.evento_id === eventoActivo.id && t.tipo === 'gasto')
      .reduce((s, t) => s + Number(t.importe), 0)
  }, [transacciones, eventoActivo])

  async function desactivarEvento() {
    if (!eventoActivo) return
    await supabase.from('eventos').update({ activo: false }).eq('id', eventoActivo.id)
    setEventoActivo(null)
  }

  function cambiarVista(nuevaVista) {
    setTransaccionEditar(null)
    setVista(nuevaVista)
    if (nuevaVista !== 'ajustes') cargarEventoActivo()
  }

  const navItems = [
    { id: 'lista', emoji: '🧾', label: 'Lista' },
    { id: 'informes', emoji: '📊', label: 'Informes' },
    { id: 'ajustes', emoji: '⚙️', label: 'Ajustes' },
  ]

  const mostrarFormulario = vista === 'nuevo' || !!transaccionEditar

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">

      {/* Cabecera oscura */}
      {!mostrarFormulario && (
        <header className="bg-[#0d1b2a] px-5 pt-8 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Control de gastos</p>
              <h1 className="text-base font-bold text-white leading-tight">Cris y Adri</h1>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button onClick={cerrarSesion}
                className="text-xs text-white/30 hover:text-white/60 border border-white/10 rounded-xl px-3 py-1.5">
                Salir
              </button>
              <button onClick={alternarCifras}
                className="text-xs font-semibold text-white bg-emerald-500 rounded-xl px-3 py-1.5 whitespace-nowrap">
                {mostrarCifras ? '🙈 Ocultar' : '👁️ Mostrar'}
              </button>
            </div>
          </div>

          {/* Balance */}
          <div className="mb-3">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Balance {mesNombre}</p>
            <p className={`text-3xl font-black tracking-tight ${balanceMes.balance >= 0 ? 'text-white' : 'text-red-300'}`}>
              {ocultar(mostrarCifras, `${balanceMes.balance >= 0 ? '+' : ''}${balanceMes.balance.toFixed(2)} €`)}
            </p>
          </div>

          {/* Chips ingresos / gastos */}
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 bg-white/8 rounded-xl px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-xs text-emerald-300 font-semibold">↑ {ocultar(mostrarCifras, `${balanceMes.ingresos.toFixed(2)} €`)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/8 rounded-xl px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              <span className="text-xs text-red-300 font-semibold">↓ {ocultar(mostrarCifras, `${balanceMes.gastos.toFixed(2)} €`)}</span>
            </div>
          </div>
        </header>
      )}

      {/* Aviso almacenamiento Supabase */}
      {avisoAlmacenamiento && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="text-lg mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Almacenamiento al 75%</p>
            <p className="text-xs text-amber-600 mt-0.5">El espacio de fotos de tickets está casi lleno. Considera borrar fotos antiguas o ampliar el plan de Supabase.</p>
          </div>
          <button onClick={() => setAvisoAlmacenamiento(false)} className="text-amber-400 text-sm font-bold shrink-0">✕</button>
        </div>
      )}

      {/* Contenido */}
      <main className="flex-1 px-4 pt-4 overflow-y-auto">
        {vista === 'lista' && !mostrarFormulario && (
          <>
            {/* Buscador + filtros */}
            <div className="space-y-2 mb-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
                  <input
                    type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar apuntes..."
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {busqueda && (
                    <button onClick={() => setBusqueda('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs font-bold">✕</button>
                  )}
                </div>
                <button onClick={() => setMostrarFiltros(f => !f)}
                  className={`relative px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${filtrosActivos > 0 || mostrarFiltros ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-white text-gray-500 border-gray-200'}`}>
                  ⚙️
                  {filtrosActivos > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {filtrosActivos}
                    </span>
                  )}
                </button>
              </div>

              {mostrarFiltros && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
                  {/* Quién */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Quién</p>
                    <div className="flex gap-1.5">
                      {['', 'Cris', 'Adri', 'Auto'].map(q => (
                        <button key={q} onClick={() => setFiltros(f => ({ ...f, quien: q }))}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${filtros.quien === q ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {q || 'Todos'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Categoría */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Categoría</p>
                    <select value={filtros.categoria} onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">Todas</option>
                      {categoriasFiltro.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Medio de pago */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Medio de pago</p>
                    <select value={filtros.medio_pago} onChange={e => setFiltros(f => ({ ...f, medio_pago: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">Todos</option>
                      {mediosFiltro.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {filtrosActivos > 0 && (
                    <button onClick={() => setFiltros({ categoria: '', quien: '', medio_pago: '' })}
                      className="w-full py-2 text-sm text-red-500 font-semibold border border-red-200 rounded-xl bg-red-50">
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}

              {(busqueda || filtrosActivos > 0) && !cargando && (
                <p className="text-xs text-gray-400 px-1">
                  {transaccionesFiltradas.length} resultado{transaccionesFiltradas.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <ListaTransacciones
              transacciones={transaccionesFiltradas}
              cargando={cargando}
              onSeleccionar={t => setTransaccionDetalle(t)}
              mostrarCifras={mostrarCifras}
            />
          </>
        )}
        {mostrarFormulario && (
          <div>
            <div className="bg-[#0d1b2a] px-5 pt-10 pb-5 -mx-4 -mt-4 mb-4">
              <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Control de gastos</p>
              <h1 className="text-xl font-bold text-white">
                {transaccionEditar ? 'Editar apunte' : 'Nuevo apunte'}
              </h1>
            </div>
            <FormTransaccion
              usuario={usuario}
              transaccionEditar={transaccionEditar}
              eventoActivo={eventoActivo}
              autoAbrirCamara={!transaccionEditar && autoAbrirCamara}
              onGuardado={() => {
                setTransaccionEditar(null)
                setTransaccionDetalle(null)
                onGuardado()
              }}
              onCancelar={() => {
                setTransaccionEditar(null)
                setVista('lista')
              }}
              onEliminar={async t => {
                await supabase.from('transacciones').delete().eq('id', t.id)
                setTransaccionEditar(null)
                setTransaccionDetalle(null)
                setVista('lista')
                cargarTransacciones()
              }}
            />
          </div>
        )}
        {vista === 'informes' && !mostrarFormulario && (
          <Informes transacciones={transacciones} mostrarCifras={mostrarCifras} />
        )}
        {vista === 'ajustes' && !mostrarFormulario && (
          <Ajustes transacciones={transacciones} onVerDetalleEvento={ev => setEventoDetalle(ev)} mostrarCifras={mostrarCifras} />
        )}
      </main>

      {/* Barra de navegación inferior */}
      {!mostrarFormulario && <nav className="fixed bottom-0 left-0 right-0 bg-white max-w-lg mx-auto shadow-lg">
        {/* Chip evento activo */}
        {eventoActivo && (
          <div className="px-4 pt-3 pb-2 bg-gradient-to-r from-orange-500 to-amber-400">
            <div className="flex items-center justify-between mb-1.5">
              <button onClick={() => setEventoDetalle(eventoActivo)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                <span className="text-base">🎯</span>
                <span className="text-sm font-bold text-white truncate">{eventoActivo.nombre}</span>
                <span className="text-white/50 text-xs ml-1">›</span>
              </button>
              <button onClick={desactivarEvento}
                className="text-white/70 text-xs font-bold ml-2 shrink-0 px-2 py-0.5 rounded-lg hover:bg-white/20">
                ✕
              </button>
            </div>
            {eventoActivo.presupuesto ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-white/80">
                    {ocultar(mostrarCifras, `${gastoEvento.toFixed(0)} € gastado de ${Number(eventoActivo.presupuesto).toFixed(0)} €`)}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {Math.round((gastoEvento / eventoActivo.presupuesto) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${Math.min(100, (gastoEvento / eventoActivo.presupuesto) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <span className="text-xs text-white/70">
                {gastoEvento > 0 ? ocultar(mostrarCifras, `${gastoEvento.toFixed(2)} € gastado`) : 'Sin presupuesto definido'}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center h-16 border-t border-gray-100">
          {navItems.map((item, i) => (
            <React.Fragment key={item.id}>
              {i === 1 && (
                <button
                  onClick={() => { setTransaccionEditar(null); setVista('nuevo') }}
                  className="flex flex-col items-center justify-center px-6">
                  <span className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light shadow-lg -mt-6 transition-colors ${vista === 'nuevo' ? 'bg-[#0a1520]' : 'bg-[#0d1b2a]'}`}
                    style={{ boxShadow: '0 4px 16px rgba(13,27,42,0.4)' }}>
                    <span className="text-white">+</span>
                  </span>
                  <span className="text-[10px] text-[#0d1b2a] font-medium mt-0.5">Nuevo</span>
                </button>
              )}
              <button
                onClick={() => cambiarVista(item.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${vista === item.id && !mostrarFormulario ? 'text-[#0d1b2a]' : 'text-gray-300'}`}>
                <span className="text-xl">{item.emoji}</span>
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </nav>}

      {/* Toast confirmación */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* Recordatorio mensual de backup */}
      {mostrarRecordatorioCopia && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={posponerRecordatorio} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl animate-fade-in">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="text-4xl text-center mb-3">💾</div>
            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Copia de seguridad</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Descarga tus datos una vez al mes para tenerlos a salvo si algo falla con el servidor.
            </p>
            <button
              onClick={() => { marcarCopiaHecha(); setVista('informes') }}
              className="w-full py-3.5 bg-[#0d1b2a] text-white font-bold rounded-2xl text-sm mb-3">
              📥 Ir a Informes y descargar
            </button>
            <button
              onClick={posponerRecordatorio}
              className="w-full py-3 text-gray-400 font-medium text-sm">
              Recordar la próxima vez que entre
            </button>
          </div>
        </div>
      )}

      {/* Detalle de evento */}
      {eventoDetalle && (
        <DetalleEvento
          evento={eventoDetalle}
          onCerrar={() => setEventoDetalle(null)}
          mostrarCifras={mostrarCifras}
        />
      )}

      {/* Detalle de transacción */}
      {transaccionDetalle && (
        <DetalleTransaccion
          transaccion={transaccionDetalle}
          onCerrar={() => setTransaccionDetalle(null)}
          mostrarCifras={mostrarCifras}
          onGuardado={() => {
            setTransaccionDetalle(null)
            cargarTransacciones()
            mostrarToast('✅ Apunte guardado')
          }}
          onEliminar={async t => {
            await supabase.from('transacciones').delete().eq('id', t.id)
            setTransaccionDetalle(null)
            cargarTransacciones()
          }}
        />
      )}
    </div>
  )
}
