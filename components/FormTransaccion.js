'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cargarCategorias, principalesPorTipo, subcategoriasDeCategoria } from '@/lib/categorias'

const EMOJI_MEDIO_PAGO = {
  'Efectivo Adri': '💵',
  'Efectivo Cris': '💵',
  'Tarjeta Cris': '💳',
  'Tarjeta Adri': '💳',
  'Banco': '🏦',
  'Bizum': '📱',
  'Transferencia': '🏦',
  'Tarjeta roja': '💳',
}

// Orden si no sabemos quién registra (móvil sin configurar): el de siempre
const MEDIOS_PAGO_SIN_DUENO = Object.keys(EMOJI_MEDIO_PAGO).map(valor => ({ valor, emoji: EMOJI_MEDIO_PAGO[valor] }))

// El efectivo y la tarjeta de quien registra van primero, luego lo común,
// y al final el efectivo y la tarjeta del otro
function mediosPagoPara(quien) {
  if (quien !== 'Cris' && quien !== 'Adri') return MEDIOS_PAGO_SIN_DUENO
  const otro = quien === 'Cris' ? 'Adri' : 'Cris'
  const orden = [
    `Efectivo ${quien}`, `Tarjeta ${quien}`, 'Bizum', 'Banco', 'Transferencia', 'Tarjeta roja',
    `Efectivo ${otro}`, `Tarjeta ${otro}`,
  ]
  return orden.map(valor => ({ valor, emoji: EMOJI_MEDIO_PAGO[valor] }))
}

const FORM_VACIO = {
  fecha: new Date().toISOString().split('T')[0],
  importe: '',
  tipo: 'gasto',
  categoria: '',
  subcategoria: '',
  establecimiento: '',
  descripcion: '',
  medio_pago: '',
  quien: '',
}

export default function FormTransaccion({ usuario, onGuardado, onCancelar, transaccionEditar, onEliminar, eventoActivo, autoAbrirCamara }) {
  const esEdicion = !!transaccionEditar

  const [form, setForm] = useState(() => {
    if (transaccionEditar) {
      return {
        fecha: transaccionEditar.fecha || FORM_VACIO.fecha,
        importe: transaccionEditar.importe != null ? String(transaccionEditar.importe) : '',
        tipo: transaccionEditar.tipo || 'gasto',
        categoria: transaccionEditar.categoria || '',
        subcategoria: transaccionEditar.subcategoria || '',
        establecimiento: transaccionEditar.establecimiento || '',
        descripcion: transaccionEditar.descripcion || '',
        medio_pago: transaccionEditar.medio_pago || '',
        quien: transaccionEditar.quien || '',
        evento_id: transaccionEditar.evento_id || null,
      }
    }
    // Cada móvil recuerda a quién pertenece, así no hay que marcarlo cada vez.
    // Y como habitualmente se paga en efectivo, viene ya marcado "Efectivo <dueño>".
    const recordado = typeof window !== 'undefined' ? localStorage.getItem('quienRegistra') : null
    return {
      ...FORM_VACIO,
      quien: recordado || '',
      medio_pago: recordado ? `Efectivo ${recordado}` : '',
      evento_id: eventoActivo?.id || null,
    }
  })

  const [categorias, setCategorias] = useState([])
  const [foto, setFoto] = useState(null)
  const [fotoFile, setFotoFile] = useState(null)
  const [estadoOCR, setEstadoOCR] = useState(null)
  const [camposFaltantes, setCamposFaltantes] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [historialEstablecimientos, setHistorialEstablecimientos] = useState([])
  const [historialNotas, setHistorialNotas] = useState([])
  const [sugerenciasEstablecimiento, setSugerenciasEstablecimiento] = useState([])
  const [sugerenciasNotas, setSugerenciasNotas] = useState([])
  const [confirmando, setConfirmando] = useState(false)
  // Si el móvil ya tiene dueño, "quién" se muestra como texto en vez de botones
  const [movilConfigurado, setMovilConfigurado] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('quienRegistra')
  )
  const [usoCategorias, setUsoCategorias] = useState({})
  const [usoSubcategorias, setUsoSubcategorias] = useState({})
  const [porEstablecimiento, setPorEstablecimiento] = useState({})

  const inputFotoRef = useRef()
  const importeRef = useRef()
  const categoriaRef = useRef()
  const fechaRef = useRef()
  const establecimientoRef = useRef()
  const notasRef = useRef()
  const supabase = createClient()

  // La app abre directamente aquí con la cámara intentando dispararse sola.
  // Si iOS no deja hacerlo sin un toque explícito, no pasa nada — el botón
  // verde de abajo sigue disponible para hacerlo con un toque.
  useEffect(() => {
    if (autoAbrirCamara) inputFotoRef.current?.click()
  }, [])

  // Si cancelas la cámara que se abrió sola (la X/Cancelar nativa de iOS),
  // es que no querías registrar un gasto — te lleva a la lista igual que el
  // botón "Cancelar" del formulario, en vez de dejarte en un formulario vacío
  useEffect(() => {
    const input = inputFotoRef.current
    if (!autoAbrirCamara || !input) return
    const alCancelar = () => onCancelar()
    input.addEventListener('cancel', alCancelar)
    return () => input.removeEventListener('cancel', alCancelar)
  }, [autoAbrirCamara])

  useEffect(() => {
    cargarCategorias().then(setCategorias)
    supabase.from('transacciones').select('establecimiento, descripcion, categoria, subcategoria').then(({ data }) => {
      if (!data) return
      setHistorialEstablecimientos([...new Set(data.map(t => t.establecimiento).filter(Boolean))].sort())
      setHistorialNotas([...new Set(data.map(t => t.descripcion).filter(Boolean))].sort())

      // Nº de apuntes por categoría, para ordenar el desplegable por uso
      const uso = {}
      // Igual con las subcategorías, pero contando la pareja categoría+subcategoría:
      // "Pastelería" existe a la vez en Alimentación y en Ocio.
      const usoSub = {}
      // Combinación categoría+subcategoría más repetida de cada establecimiento,
      // para proponerla al leer un ticket de ese mismo sitio
      const porEst = {}
      for (const t of data) {
        if (t.categoria) uso[t.categoria] = (uso[t.categoria] || 0) + 1
        if (t.categoria && t.subcategoria) {
          const k = `${t.categoria}|${t.subcategoria}`
          usoSub[k] = (usoSub[k] || 0) + 1
        }
        const est = (t.establecimiento || '').trim().toLowerCase()
        if (!est || !t.categoria) continue
        const clave = `${t.categoria}|${t.subcategoria || ''}`
        porEst[est] = porEst[est] || {}
        porEst[est][clave] = (porEst[est][clave] || 0) + 1
      }
      const masUsada = {}
      for (const [est, combos] of Object.entries(porEst)) {
        const [clave] = Object.entries(combos).sort((a, b) => b[1] - a[1])[0]
        const [categoria, subcategoria] = clave.split('|')
        masUsada[est] = { categoria, subcategoria }
      }
      setUsoCategorias(uso)
      setUsoSubcategorias(usoSub)
      setPorEstablecimiento(masUsada)
    })
  }, [])

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  // Sigue a quien registra el apunte, no al dueño del móvil: si se edita un
  // apunte antiguo del otro, sus medios de pago pasan a ir primero.
  const mediosPago = useMemo(() => mediosPagoPara(form.quien), [form.quien])

  // Las más usadas primero; a igualdad de uso se mantiene el orden original
  const principales = useMemo(() => {
    const lista = principalesPorTipo(categorias, form.tipo)
    return [...lista].sort((a, b) => (usoCategorias[b.nombre] || 0) - (usoCategorias[a.nombre] || 0))
  }, [categorias, form.tipo, usoCategorias])

  // Buscar subcategorías buscando la categoría seleccionada en TODO el array
  // (más robusto que buscar solo en principales filtradas por tipo)
  // También ordenadas por uso, las más frecuentes primero
  const subcategorias = useMemo(() => {
    if (!form.categoria || !categorias.length) return []
    const cat = categorias.find(c => c.nombre === form.categoria && !c.padre_id)
    if (!cat) return []
    const hijas = categorias.filter(c => c.padre_id === cat.id)
    const veces = n => usoSubcategorias[`${form.categoria}|${n}`] || 0
    return [...hijas].sort((a, b) => veces(b.nombre) - veces(a.nombre))
  }, [form.categoria, categorias, usoSubcategorias])

  // ── OCR ──────────────────────────────────────────────────────────────
  async function procesarFoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setFoto(URL.createObjectURL(file))
    setFotoFile(file)
    setEstadoOCR('procesando')
    setError('')

    try {
      const fd = new FormData()
      fd.append('imagen', file)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 55000)
      const res = await fetch('/api/ocr', { method: 'POST', body: fd, signal: controller.signal })
      clearTimeout(timeout)
      const data = await res.json()

      if (!data.error) {
        // Si ya hemos comprado antes en este sitio, reutilizamos su subcategoría
        // habitual (y su categoría, si el OCR no la ha sabido deducir).
        const est = (data.establecimiento || '').trim().toLowerCase()
        let previo = porEstablecimiento[est]
        if (!previo && est) {
          // Comparamos por palabras completas, nunca por trozos sueltos: si no,
          // "zara" encajaría dentro de "ecociudad zaragoza" y "bus" dentro de "cibus".
          const palabras = est.split(/\s+/).filter(Boolean)
          const empiezaIgual = (a, b) => a.every((p, i) => b[i] === p)
          const parecido = Object.keys(porEstablecimiento).find(k => {
            const kp = k.split(/\s+/).filter(Boolean)
            return kp.length && (empiezaIgual(kp, palabras) || empiezaIgual(palabras, kp))
          })
          if (parecido) previo = porEstablecimiento[parecido]
        }
        // Solo sirve si su categoría coincide con la que ha leído el OCR
        const categoriaFinal = data.categoria || previo?.categoria || form.categoria
        const subcategoriaFinal =
          previo && previo.categoria === categoriaFinal ? previo.subcategoria || '' : ''

        const nuevo = {
          tipo: data.tipo || form.tipo,
          importe: data.importe ? String(data.importe) : form.importe,
          fecha: data.fecha || form.fecha,
          categoria: categoriaFinal,
          subcategoria: subcategoriaFinal,
          establecimiento: data.establecimiento || form.establecimiento,
          descripcion: data.descripcion || form.descripcion,
          quien: form.quien,
          medio_pago: form.medio_pago,
        }
        setForm(f => ({ ...f, ...nuevo }))

        const faltantes = []
        if (!nuevo.importe) faltantes.push('importe')
        if (!nuevo.fecha) faltantes.push('fecha')
        if (!nuevo.categoria || data.confianza_categoria === 'baja') faltantes.push('categoría')
        if (!nuevo.establecimiento) faltantes.push('establecimiento')

        setCamposFaltantes(faltantes)
        setEstadoOCR(faltantes.length === 0 ? 'exito' : 'duda')
      } else {
        setCamposFaltantes(['importe', 'fecha', 'categoría', 'establecimiento'])
        setEstadoOCR('duda')
      }
    } catch {
      setCamposFaltantes(['importe', 'fecha', 'categoría', 'establecimiento'])
      setEstadoOCR('duda')
    }
  }

  // ── Guardar ───────────────────────────────────────────────────────────
  async function guardar() {
    const requeridos = { importe: 'Importe', categoria: 'Categoría', fecha: 'Fecha', establecimiento: 'Establecimiento', quien: '¿Quién?' }
    for (const [campo, etiqueta] of Object.entries(requeridos)) {
      if (!form[campo] || String(form[campo]).trim() === '') {
        setError(`El campo "${etiqueta}" es obligatorio.`)
        return
      }
    }
    const importeNormalizado = normalizarImporte(form.importe)
    if (isNaN(parseFloat(importeNormalizado))) {
      setError('El importe no es válido.')
      return
    }
    setGuardando(true)
    setError('')

    let imagen_url = transaccionEditar?.imagen_url || null
    if (fotoFile) {
      const ext = fotoFile.name.split('.').pop()
      const nombre = `${Date.now()}.${ext}`
      const { error: errUpload } = await supabase.storage.from('documentos').upload(nombre, fotoFile, { upsert: false })
      if (!errUpload) {
        const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(nombre)
        imagen_url = urlData?.publicUrl || null
      }
    }

    const datos = {
      fecha: form.fecha,
      importe: parseFloat(importeNormalizado),
      tipo: form.tipo,
      categoria: form.categoria,
      subcategoria: form.subcategoria || null,
      establecimiento: form.establecimiento || null,
      descripcion: form.descripcion || null,
      medio_pago: form.medio_pago || null,
      quien: form.quien || null,
      imagen_url,
      evento_id: form.evento_id || null,
    }

    let errDB
    if (esEdicion) {
      const { error } = await supabase.from('transacciones').update(datos).eq('id', transaccionEditar.id)
      errDB = error
    } else {
      const { error } = await supabase.from('transacciones').insert([datos])
      errDB = error
    }

    if (errDB) {
      setError('Error al guardar. Inténtalo de nuevo.')
      setGuardando(false)
    } else {
      onGuardado()
    }
  }

  // ── Pantallas OCR ─────────────────────────────────────────────────────
  if (estadoOCR === 'procesando') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg font-semibold text-gray-700">Analizando documento...</p>
        <p className="text-sm text-gray-400 text-center">Estoy leyendo el ticket para rellenar los datos automáticamente</p>
        {foto && <img src={foto} alt="documento" className="w-48 rounded-2xl border border-gray-100 shadow object-contain max-h-48" />}
      </div>
    )
  }

  if (estadoOCR === 'exito') {
    return (
      <div className="flex flex-col gap-4 px-2 py-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
          <span className="text-4xl">✅</span>
          <p className="text-lg font-bold text-emerald-800">Documento reconocido</p>
          <p className="text-sm text-emerald-700">He leído correctamente todos los datos</p>
        </div>
        {foto && <img src={foto} alt="documento" className="w-full rounded-2xl border border-gray-100 shadow object-contain max-h-40" />}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <ResumenFila label="Tipo" valor={form.tipo === 'gasto' ? '💸 Gasto' : '💰 Ingreso'} />
          <ResumenFila label="Importe" valor={form.importe ? `${form.importe} €` : '—'} />
          <ResumenFila label="Categoría" valor={form.categoria || '—'} />
          <ResumenFila label="Fecha" valor={form.fecha || '—'} />
          <ResumenFila label="Establecimiento" valor={form.establecimiento || '—'} />
        </div>
        <button onClick={() => setEstadoOCR(null)}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl text-base font-bold shadow">
          Revisar y guardar →
        </button>
      </div>
    )
  }

  if (estadoOCR === 'duda') {
    return (
      <div className="flex flex-col gap-4 px-2 py-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
          <span className="text-4xl">⚠️</span>
          <p className="text-lg font-bold text-amber-800">Necesito tu ayuda</p>
          <p className="text-sm text-amber-700">No he podido leer con seguridad:</p>
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {camposFaltantes.map(c => (
              <span key={c} className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full capitalize">{c}</span>
            ))}
          </div>
        </div>
        {foto && <img src={foto} alt="documento" className="w-full rounded-2xl border border-gray-100 shadow object-contain max-h-32" />}
        <button onClick={() => setEstadoOCR(null)}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl text-base font-bold shadow">
          Completar datos →
        </button>
      </div>
    )
  }

  // ── Formulario único ──────────────────────────────────────────────────
  return (
    <div className="space-y-3 pb-28">

      {/* Botón foto OCR — es el campo más usado. Mismo verde que ya usa la app
          para lo positivo (Ingreso, saldos a favor, "Documento reconocido").
          Cancelar va aquí arriba, junto a la foto: cuando la app abre
          directamente en este formulario (ver page.js) es lo primero que se
          ve, así que la salida rápida tiene que estar a la vista. */}
      <div className="flex gap-2">
        <button type="button" onClick={() => inputFotoRef.current?.click()}
          className="basis-[70%] py-4 rounded-xl bg-emerald-500 text-white text-base font-bold flex items-center justify-center gap-2 shadow-sm">
          <span className="text-xl">📷</span>
          {foto ? 'Cambiar foto' : 'Foto del documento'}
        </button>
        <button type="button" onClick={onCancelar}
          className="basis-[30%] py-4 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium">
          Cancelar
        </button>
      </div>
      <input ref={inputFotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={procesarFoto} />
      {foto && <img src={foto} alt="ticket" className="w-full rounded-xl object-contain max-h-28 border border-gray-100" />}

      {/* Tipo */}
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

      {/* Importe */}
      <div className="relative">
        <input
          ref={importeRef}
          type="text" inputMode="decimal" autoFocus value={form.importe}
          onChange={e => set('importe', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && categoriaRef.current?.focus()}
          placeholder="0,00"
          className="w-full pl-4 pr-10 py-3 border-2 border-blue-300 rounded-xl text-3xl font-bold text-center focus:outline-none focus:border-blue-500"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-gray-300 font-bold">€</span>
      </div>
      <p className="text-xs text-gray-400 text-center -mt-1">Importe negativo = devolución · usa punto o coma de decimales</p>

      {/* Categoría */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Categoría *</label>
        <select ref={categoriaRef} value={form.categoria}
          onChange={e => { set('categoria', e.target.value); set('subcategoria', '') }}
          onKeyDown={e => e.key === 'Enter' && fechaRef.current?.focus()}
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

      {/* Fecha */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Fecha *</label>
        <input ref={fechaRef} type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && establecimientoRef.current?.focus()}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      {/* Establecimiento */}
      <div className="relative">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Establecimiento / Pagador *</label>
        <input ref={establecimientoRef} type="text" value={form.establecimiento} autoComplete="off"
          onChange={e => { set('establecimiento', e.target.value); filtrarSugerencias(e.target.value, historialEstablecimientos, setSugerenciasEstablecimiento) }}
          onBlur={() => setTimeout(() => setSugerenciasEstablecimiento([]), 150)}
          onKeyDown={e => e.key === 'Enter' && notasRef.current?.focus()}
          placeholder="Mercadona, Empresa S.L., ..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        {sugerenciasEstablecimiento.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden">
            {sugerenciasEstablecimiento.map(s => (
              <li key={s}>
                <button type="button" onMouseDown={() => { set('establecimiento', s); setSugerenciasEstablecimiento([]) }}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 last:border-0">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Notas */}
      <div className="relative">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notas (opcional)</label>
        <input ref={notasRef} type="text" value={form.descripcion} autoComplete="off"
          onChange={e => { set('descripcion', e.target.value); filtrarSugerencias(e.target.value, historialNotas, setSugerenciasNotas) }}
          onBlur={() => setTimeout(() => setSugerenciasNotas([]), 150)}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          placeholder="Descripción breve..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        {sugerenciasNotas.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden">
            {sugerenciasNotas.map(s => (
              <li key={s}>
                <button type="button" onMouseDown={() => { set('descripcion', s); setSugerenciasNotas([]) }}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 last:border-0">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Medio de pago — scroll horizontal */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Medio de pago (opcional)</label>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-hide">
          {mediosPago.map(m => (
            <button key={m.valor} type="button"
              onClick={() => set('medio_pago', form.medio_pago === m.valor ? '' : m.valor)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${form.medio_pago === m.valor ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>
              <span>{m.emoji}</span>
              <span>{m.valor}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quién — si el móvil ya sabe de quién es, solo se muestra;
          si no, salen los botones para que nunca se quede sin rellenar */}
      {movilConfigurado && form.quien ? (
        <p className="text-xs text-gray-400 text-center">
          Registra: <span className="font-semibold text-gray-500">{form.quien}</span>
          {' · '}
          <button type="button" onClick={() => setMovilConfigurado(false)}
            className="underline text-gray-400">cambiar</button>
        </p>
      ) : (
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">¿Quién lo registra? *</label>
          <div className="flex gap-2">
            {['Cris', 'Adri'].map(nombre => (
              <button key={nombre} type="button"
                onClick={() => { set('quien', nombre); localStorage.setItem('quienRegistra', nombre) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${form.quien === nombre ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-white text-gray-400 border-gray-200'}`}>
                {nombre}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Se recordará en este móvil. Se cambia en Ajustes.</p>
        </div>
      )}

      {/* Evento */}
      {(eventoActivo || form.evento_id) && (
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${form.evento_id ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <div>
              <p className="text-xs font-semibold text-amber-800">
                {form.evento_id ? (eventoActivo?.nombre || 'Evento') : 'Sin evento'}
              </p>
              <p className="text-xs text-gray-400">{form.evento_id ? 'Apunte asignado a este evento' : ''}</p>
            </div>
          </div>
          {form.evento_id ? (
            <button type="button" onClick={() => set('evento_id', null)}
              className="text-amber-500 text-xs font-bold px-2 py-0.5 rounded-lg hover:bg-amber-100">
              ✕
            </button>
          ) : eventoActivo ? (
            <button type="button" onClick={() => set('evento_id', eventoActivo.id)}
              className="text-xs text-amber-700 font-semibold px-2 py-1 bg-amber-100 rounded-lg">
              + Asignar
            </button>
          ) : null}
        </div>
      )}

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl p-3">{error}</p>}

      {/* Guardar — Cancelar ya está arriba, junto a la foto */}
      <div className="pt-1">
        <button type="button" onClick={guardar} disabled={guardando}
          className="w-full py-4 bg-[#0d1b2a] text-white rounded-xl text-base font-bold disabled:opacity-50 shadow-sm">
          {guardando ? 'Guardando...' : '✓ Guardar apunte'}
        </button>
      </div>

      {/* Eliminar (solo edición) */}
      {esEdicion && (
        !confirmando ? (
          <button type="button" onClick={() => setConfirmando(true)}
            className="w-full py-2.5 bg-red-50 border border-red-200 text-red-500 rounded-xl text-sm font-semibold">
            🗑️ Eliminar apunte
          </button>
        ) : (
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmando(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">No, cancelar</button>
            <button type="button" onClick={() => onEliminar?.(transaccionEditar)}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold">Sí, eliminar</button>
          </div>
        )
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

// Convierte importes en formato español (1.089,46) o inglés (1089.46) a número válido
function normalizarImporte(valor) {
  const s = String(valor).trim()
  if (s.includes(',') && s.includes('.')) {
    // Ambos separadores: el punto es de miles, la coma es decimal → "1.089,46" → "1089.46"
    return s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    // Solo coma: es el decimal → "1089,46" → "1089.46"
    return s.replace(',', '.')
  }
  // Solo punto o sin separador decimal: ya es formato válido
  return s
}

function filtrarSugerencias(valor, historial, setSugerencias) {
  if (valor.length >= 1) {
    setSugerencias(historial.filter(e => e.toLowerCase().includes(valor.toLowerCase())).slice(0, 5))
  } else {
    setSugerencias([])
  }
}

function ResumenFila({ label, valor }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 gap-4">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-800 text-right">{valor}</span>
    </div>
  )
}
