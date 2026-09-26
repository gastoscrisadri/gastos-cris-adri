'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FormTransaccion, { MODELO_CADUCADO_MARCA } from '@/components/FormTransaccion'
import ListaTransacciones from '@/components/ListaTransacciones'
import Informes from '@/components/Informes'
import Ajustes from '@/components/Ajustes'
import DetalleTransaccion from '@/components/DetalleTransaccion'
import DetalleEvento from '@/components/DetalleEvento'
import { ocultar, euros, euros0 } from '@/lib/cifras'
import { cargarCategorias } from '@/lib/categorias'
import { construirReparto } from '@/lib/reparto'
import { nombreDe } from '@/lib/identidad'
import { apuntarme } from '@/lib/personas'
import { hoy, mesDeHoy, mesesEntre, mesesQueFaltan } from '@/lib/fechas'
import { esDeLaCasa, esLiquidacion, gastoDeLaCasaDelMes } from '@/lib/apuntes'
import { cargarCuentas, personaDeMedioPago, CUENTAS_RESPALDO } from '@/lib/cuentas'
import { calcularDeuda } from '@/lib/deuda'
import { borrarApunte } from '@/lib/fotos'

export default function Home() {
  // La app abre directamente en "nuevo apunte", que es lo que más se hace.
  // La foto del ticket se saca con el botón verde, a un toque.
  const [vista, setVista] = useState('nuevo')
  // Las cifras empiezan siempre tapadas, y el botón las destapa TODAS a la vez.
  // Antes cada pantalla recordaba lo suyo por separado: destapar la lista no
  // destapaba informes, así que para ver lo mismo había que pulsar el botón
  // en cada sitio. Una sola memoria en vez de cuatro.
  const [mostrarCifras, setMostrarCifras] = useState(false)
  function alternarCifras() {
    setMostrarCifras(v => !v)
  }

  // Y se vuelven a tapar solas en cuanto la app deja de verse: cambias a otra
  // aplicación, bloqueas el móvil o la dejas en segundo plano. Al volver están
  // tapadas otra vez.
  //
  // Se descartó un temporizador de dos minutos a propósito: un reloj no sabe
  // si estás mirando, y te taparía las cifras en la cara mientras repasas la
  // lista con calma. Esto no se equivoca nunca en ese sentido — mientras estás
  // delante no pasa nada, dure lo que dure — y acierta con el peligro de
  // verdad, que no es que te miren por encima del hombro, sino que alguien
  // coja el móvil desbloqueado un rato después.
  //
  // Moverse entre Lista, Informes y Ajustes NO las tapa: sigues dentro de la
  // app, y taparlas ahí obligaría a pulsar Mostrar veinte veces al día.
  useEffect(() => {
    function alDejarDeVerse() {
      if (document.visibilityState === 'hidden') setMostrarCifras(false)
    }
    document.addEventListener('visibilitychange', alDejarDeVerse)
    return () => document.removeEventListener('visibilitychange', alDejarDeVerse)
  }, [])
  const [transaccionDetalle, setTransaccionDetalle] = useState(null)
  const [transaccionEditar, setTransaccionEditar] = useState(null)
  const [transacciones, setTransacciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [toast, setToast] = useState(null)
  const [mostrarRecordatorioCopia, setMostrarRecordatorioCopia] = useState(false)
  // Resumen del mes que acaba de terminar. Sale una vez, al abrir la app por
  // primera vez del mes nuevo. Antes había que acordarse de entrar en Informes
  // y mirar tres sitios; ahora el cierre del mes te sale al paso.
  const [mostrarResumenMes, setMostrarResumenMes] = useState(false)
  const [abrirInformesEn, setAbrirInformesEn] = useState(null)
  // La tarjeta del resumen tiene su propio interruptor de cifras. El de la app
  // va por pantalla, y esta sale encima de "nuevo apunte", donde nunca se han
  // destapado: salían todos los importes en puntitos y sin forma de verlos.
  const [verCifrasResumen, setVerCifrasResumen] = useState(false)
  const [cuentas, setCuentas] = useState(CUENTAS_RESPALDO)
  useEffect(() => { cargarCuentas().then(setCuentas) }, [])
  // El último cierre de la cuenta de los dos. Sin ninguno queda en null y todo
  // se calcula desde el principio, como siempre.
  const [ultimoCierre, setUltimoCierre] = useState(null)
  useEffect(() => {
    supabase.from('cierres').select('created_at').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setUltimoCierre(data?.[0] || null))
  }, [])
  // Meses enteros desde la última copia. Con 2 o más el aviso cambia de tono:
  // una sugerencia que se cierra y se olvida no sirve para algo que, si falla,
  // se pierde y no se recupera.
  const [mesesSinCopia, setMesesSinCopia] = useState(0)
  const [avisoAlmacenamiento, setAvisoAlmacenamiento] = useState(false)
  // El escáner de tickets funciona, pero con el modelo de reserva porque el
  // principal ya no existe. Es el aviso temprano: Google no retira los dos el
  // mismo día, así que esto da meses de margen para actualizarlos antes de
  // quedarse sin ninguno.
  const [avisoEscaner, setAvisoEscaner] = useState(false)
  useEffect(() => {
    try {
      setAvisoEscaner(localStorage.getItem('geminiPrincipalCaducado') === MODELO_CADUCADO_MARCA)
    } catch {}
  }, [])
  const [eventoActivo, setEventoActivo] = useState(null)
  const [eventoDetalle, setEventoDetalle] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({ categoria: '', quien: '', medio_pago: '' })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUsuario(user)
      // Al entrar, cada uno se apunta en la tabla "personas": nombre + cuenta.
      // Hace falta para poder guardar un gasto privado A NOMBRE DE SU DUEÑO
      // cuando lo teclea el otro. Si esto falla no se nota nada: la app
      // funciona igual y se reintentará la próxima vez que se abra.
      apuntarme(user, nombreDe(user))
    })
  }, [])

  // Los apuntes se piden POR TANDAS, no de una vez.
  //
  // Supabase no devuelve más de unos 1.000 de golpe, y no avisa de nada:
  // manda los primeros y se queda tan ancho. La cuenta de los dos se calcula
  // desde el principio de los tiempos, así que en cuanto se cayeran los
  // apuntes viejos la deuda saldría mal SIN dar ningún error. Con unos 100
  // apuntes al mes entre los dos, eso llegaría en menos de un año.
  //
  // Si una tanda falla no se pisan los datos que ya había: mejor quedarse con
  // lo de antes y avisar, que enseñar media contabilidad como si fuera entera.
  const cargarTransacciones = useCallback(async () => {
    setCargando(true)
    const TANDA = 1000
    const MAX_TANDAS = 50   // 50.000 apuntes; tope para no dar vueltas sin fin
    const todos = []
    let fallo = false
    // Se avanza por lo que ha venido DE VERDAD, no por lo que se ha pedido.
    // Si el servidor tuviera un tope más bajo que TANDA, contar de mil en mil
    // se saltaría apuntes; así funciona sea cual sea su tope.
    let desde = 0

    for (let i = 0; i < MAX_TANDAS; i++) {
      const { data, error } = await supabase
        .from('transacciones')
        .select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .range(desde, desde + TANDA - 1)

      if (error) { fallo = true; break }
      if (!data?.length) break         // no queda nada más
      todos.push(...data)
      desde += data.length
    }

    if (fallo) {
      mostrarToast('⚠️ No se han podido cargar todos los apuntes. Vuelve a abrir la app.')
    } else {
      setTransacciones(todos)
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargarTransacciones() }, [cargarTransacciones])

  const cargarEventoActivo = useCallback(async () => {
    const today = hoy()
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

      // Las fotos se cuentan POR TANDAS.
      //
      // Antes se pedían con { limit: 1000 } y se sumaban esas. Pasadas las mil
      // fotos, la cuenta se quedaba congelada y siempre daba menos de lo real:
      // el aviso de "se te llena el almacén" no habría saltado NUNCA, justo
      // cuando más falta hace. A un ticket por compra, mil fotos son un par de
      // años.
      //
      // Si una tanda falla no se avisa de nada y se reintentará el mes que
      // viene: mejor callar que dar un susto con media cuenta.
      const TANDA = 1000
      const MAX_TANDAS = 50
      let totalBytes = 0
      let desde = 0
      for (let i = 0; i < MAX_TANDAS; i++) {
        const { data: archivos, error } = await supabase.storage
          .from('documentos')
          .list('', { limit: TANDA, offset: desde })
        if (error) return
        if (!archivos?.length) break
        totalBytes += archivos.reduce((s, f) => s + (f.metadata?.size || 0), 0)
        desde += archivos.length
      }

      localStorage.setItem(KEY, String(ahora))
      if (totalBytes >= LIMITE_BYTES * UMBRAL) setAvisoAlmacenamiento(true)
    }
    comprobarAlmacenamiento()
  }, [])


  // Lo gastado entre los dos el mes pasado, y cuánto puso cada uno. La deuda
  const resumenMes = useMemo(() => {
    const d = new Date()
    d.setDate(1)                 // primero el día, o al restar un mes se va al mes que no es
    d.setMonth(d.getMonth() - 1)
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = gastoDeLaCasaDelMes(transacciones, mes)
    if (total <= 0) return null  // un mes sin gastos de los dos no tiene nada que resumir

    const puesto = {}
    transacciones
      .filter(t => t.fecha?.startsWith(mes) && t.tipo === 'gasto' && esDeLaCasa(t) && !esLiquidacion(t))
      .forEach(t => {
        const quien = personaDeMedioPago(t.medio_pago, cuentas)
        puesto[quien] = (puesto[quien] || 0) + Number(t.importe)
      })

    return {
      mes,
      nombre: d.toLocaleString('es', { month: 'long', year: 'numeric' }),
      total,
      puesto: Object.entries(puesto).sort((a, b) => b[1] - a[1]),
    }
  }, [transacciones, cuentas])

  // ¿Hay resumen por enseñar? Se mira aquí para que el recordatorio de copia no
  // se abra encima: dos ventanas a la vez al abrir la app es insufrible.
  const resumenPendiente = !!resumenMes &&
    (typeof window !== 'undefined') &&
    localStorage.getItem('resumenMesVisto') !== resumenMes.mes

  useEffect(() => {
    if (!resumenPendiente) return
    const timer = setTimeout(() => setMostrarResumenMes(true), 1200)
    return () => clearTimeout(timer)
  }, [resumenPendiente])

  function cerrarResumenMes() {
    if (resumenMes) localStorage.setItem('resumenMesVisto', resumenMes.mes)
    setMostrarResumenMes(false)
  }

  // Recordatorio mensual de backup
  useEffect(() => {
    const mesActual = mesDeHoy()
    const copiaHecha = localStorage.getItem('copiaCsvHecha') // mes en que se descargó
    if (copiaHecha !== mesActual && !resumenPendiente) {
      setMesesSinCopia(mesesEntre(copiaHecha, mesActual))
      const timer = setTimeout(() => setMostrarRecordatorioCopia(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [resumenPendiente])

  function posponerRecordatorio() {
    // No guarda nada: la próxima vez que entre volverá a aparecer
    setMostrarRecordatorioCopia(false)
  }

  // Se llama desde Informes cuando la descarga ha terminado de verdad.
  // Antes se daba por hecha al pulsar "Ir a Informes", así que bastaba con
  // asomarse a la pantalla para que el aviso callara un mes entero sin que
  // existiera ninguna copia.
  function marcarCopiaHecha() {
    localStorage.setItem('copiaCsvHecha', mesDeHoy())
    setMostrarRecordatorioCopia(false)
    setMesesSinCopia(0)
  }

  // Auto-generación de apuntes recurrentes al cargar
  useEffect(() => {
    async function generarRecurrentes() {
      const mesActual = mesDeHoy()
      const { data: recurrentes } = await supabase
        .from('apuntes_recurrentes')
        .select('*')
        .eq('activo', true)

      if (!recurrentes?.length) return

      const candidatos = recurrentes.filter(r => r.ultimo_generado !== mesActual)
      if (!candidatos.length) return

      // PEDIR EL TURNO ANTES DE CREAR NADA.
      //
      // Antes esto iba al revés: se miraba si estaba generado, se creaba, y
      // después se marcaba. Si Cris y Adri abrían la app con unos segundos de
      // diferencia --lo normal el día que llega el cargo-- los dos veían "aún
      // no está" antes de que ninguno llegase a marcarlo, y los dos lo creaban:
      // alquiler duplicado, y la cuenta de los dos descuadrada sin avisar.
      //
      // Ahora se marca PRIMERO, y solo si nadie lo había marcado ya. Esa
      // condición la resuelve la base de datos, así que de dos móviles a la vez
      // solo uno se lleva el turno. Y solo quien se lo lleva crea el apunte.
      //
      // Si algo fallara después, el gasto no se crearía y se vería enseguida.
      // Es el lado seguro: mejor que falte y se note, a que se duplique y no.
      const pendientes = []
      for (const r of candidatos) {
        const { data: ganado } = await supabase
          .from('apuntes_recurrentes')
          .update({ ultimo_generado: mesActual })
          .eq('id', r.id)
          .or(`ultimo_generado.is.null,ultimo_generado.neq.${mesActual}`)
          .select('id')
        if (ganado?.length) pendientes.push(r)
      }
      if (!pendientes.length) return

      // SE RELLENAN TODOS LOS MESES QUE FALTEN, no solo el actual.
      //
      // Antes se creaba únicamente el apunte del mes en curso. Si nadie abría
      // la app durante un mes entero --un viaje largo, un móvil roto-- el
      // alquiler de ese mes no se creaba NUNCA: al volver se saltaba y la
      // cuenta de los dos quedaba descuadrada por 1.400 € sin que nada lo
      // avisara. Era el fallo más silencioso que tenía la app.
      //
      // Dos cuidados, sin los cuales el remedio sería peor que la enfermedad:
      //
      //  · Un gasto fijo recién creado no tiene "último mes generado". Ahí no
      //    se rellena hacia atrás o crearía apuntes desde el principio de los
      //    tiempos: se queda solo con el mes actual, como hasta ahora.
      //  · TOPE_MESES pone un límite por si alguna fila trae una fecha vieja.
      //    Mejor quedarse corto que inundar la cuenta de apuntes inventados.
      const inserts = []
      for (const r of pendientes) {
        // El cálculo vive en lib/fechas.js para poder probarlo solo.
        for (const m of mesesQueFaltan(r.ultimo_generado, mesActual)) {
          const [anio, mes] = m.split('-')
          // El día se recorta mes a mes: un fijo del día 31 cae en el 28 o el
          // 29 en febrero, según el año.
          const diasEnMes = new Date(parseInt(anio), parseInt(mes), 0).getDate()
          const dia = Math.min(r.dia_mes || 1, diasEnMes)
          inserts.push({
            fecha: `${m}-${String(dia).padStart(2, '0')}`,
            importe: r.importe,
            tipo: r.tipo,
            categoria: r.categoria,
            subcategoria: r.subcategoria || null,
            establecimiento: r.establecimiento || null,
            descripcion: r.descripcion || null,
            medio_pago: r.medio_pago || null,
            quien: 'Auto',
          })
        }
      }

      await supabase.from('transacciones').insert(inserts)
      await cargarTransacciones()
      // Se dice cuántos, porque al volver de un viaje pueden salir varios de
      // golpe y la deuda dar un salto: si no se avisa, parece un error.
      mostrarToast(`🔄 ${inserts.length} apunte${inserts.length > 1 ? 's' : ''} fijo${inserts.length > 1 ? 's' : ''} generado${inserts.length > 1 ? 's' : ''}`)
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

  function onGuardado({ fotoFallida } = {}) {
    setVista('lista')
    cargarTransacciones()
    // Si la foto no subió, el gasto SÍ se ha guardado: eso es lo importante y
    // se dice primero. Pero no se calla lo otro, que antes pasaba: creías que
    // tenías el ticket guardado y no lo tenías.
    mostrarToast(fotoFallida
      ? '⚠️ Apunte guardado, pero la foto no se ha podido subir'
      : '✅ Apunte guardado')
  }

  // El reparto puesto en Ajustes, para saber qué parte de cada gasto común
  // es tuya. Si no llegan las categorías, miParte devuelve el importe entero
  // y la portada se comporta como antes.
  const [categoriasReparto, setCategoriasReparto] = useState([])
  useEffect(() => { cargarCategorias().then(setCategoriasReparto) }, [])
  const miParte = useMemo(() => construirReparto(categoriasReparto), [categoriasReparto])

  // La cuenta de los dos, del MISMO cálculo que usa Informes (lib/deuda.js).
  // No es una copia: es la misma función.
  // Con el mismo cierre que usa Informes: si no, las dos pantallas dirían
  // cosas distintas sobre el mismo dinero.
  const deuda = useMemo(
    () => calcularDeuda(transacciones, cuentas, miParte, ultimoCierre?.created_at || null),
    [transacciones, cuentas, miParte, ultimoCierre]
  )

  // Balance del mes actual, visto desde quien está mirando.
  const balanceMes = useMemo(() => {
    const mesActual = mesDeHoy()
    // Las liquidaciones (un pago de uno al otro) no son un gasto: ese dinero
    // cambia de bolsillo, no se gasta. Si contaran aquí, la portada diría que
    // habéis gastado de más.
    const delMes = transacciones.filter(t => t.fecha.startsWith(mesActual) && !t.liquidacion_a)
    // De un gasto de los dos solo cuenta tu parte. Si contara entero, a quien
    // no paga el alquiler le salían sus ingresos menos los 1.400 completos.
    const yo = nombreDe(usuario)
    const ingresos = delMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + miParte(t, yo), 0)
    const gastos = delMes.filter(t => t.tipo === 'gasto').reduce((s, t) => s + miParte(t, yo), 0)
    return { ingresos, gastos, balance: ingresos - gastos }
  }, [transacciones, usuario, miParte])

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
    setAbrirInformesEn(null)   // navegando a mano, Informes abre donde siempre
    setVista(nuevaVista)
    if (nuevaVista !== 'ajustes') cargarEventoActivo()
  }

  // El botón de "+" se cuela entre el primero y el segundo, así que Balance
  // queda a la derecha del "+", que es donde lo pidió Antonio.
  const navItems = [
    { id: 'lista', emoji: '🧾', label: 'Lista' },
    { id: 'balance', emoji: '⚖️', label: 'Balance' },
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
            {/* Aquí estaba "Salir", pegado al botón de ocultar cifras. Se ha
                ido a Ajustes: ocultar se pulsa todos los días y salir de la
                cuenta, nunca, y un dedazo entre los dos te dejaba fuera de la
                app teniendo que escribir el correo y la contraseña otra vez. */}
            <div className="flex flex-col items-end gap-1.5">
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
              {ocultar(mostrarCifras, `${balanceMes.balance >= 0 ? '+' : ''}${euros(balanceMes.balance)} €`)}
            </p>
          </div>

          {/* Chips ingresos / gastos */}
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 bg-white/8 rounded-xl px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-xs text-emerald-300 font-semibold">↑ {ocultar(mostrarCifras, `${euros(balanceMes.ingresos)} €`)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/8 rounded-xl px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              <span className="text-xs text-red-300 font-semibold">↓ {ocultar(mostrarCifras, `${euros(balanceMes.gastos)} €`)}</span>
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

      {avisoEscaner && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="text-lg mt-0.5">📸</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">El escáner va con el modelo de reserva</p>
            <p className="text-xs text-amber-600 mt-0.5">
              El principal ha dejado de responder. Los tickets se siguen leyendo, pero conviene
              actualizarlo antes de que la reserva también se retire. Avisad a Toni.
            </p>
          </div>
          <button onClick={() => setAvisoEscaner(false)} className="text-amber-400 text-sm font-bold shrink-0">✕</button>
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
              usuario={usuario}
              cuentas={cuentas}
            />
          </>
        )}
        {mostrarFormulario && (
          <div>
            {/* Cabecera baja a propósito: en esta pantalla lo que hace falta es
                sitio para los campos, no un título grande. */}
            <div className="bg-[#0d1b2a] px-5 pt-5 pb-3 -mx-4 -mt-4 mb-3">
              <h1 className="text-base font-bold text-white">
                {transaccionEditar ? 'Editar apunte' : 'Nuevo apunte'}
              </h1>
            </div>
            <FormTransaccion
              usuario={usuario}
              transaccionEditar={transaccionEditar}
              eventoActivo={eventoActivo}
              onGuardado={info => {
                setTransaccionEditar(null)
                setTransaccionDetalle(null)
                onGuardado(info)
              }}
              onCancelar={() => {
                setTransaccionEditar(null)
                setVista('lista')
              }}
              onEliminar={async t => {
                await borrarApunte(supabase, t)
                setTransaccionEditar(null)
                setTransaccionDetalle(null)
                setVista('lista')
                cargarTransacciones()
              }}
            />
          </div>
        )}
        {/* Balance e Informes son el mismo componente enseñando partes
            distintas: comparten el cálculo de la deuda, las cuentas y el
            reparto, y separarlos en dos archivos obligaría a pasarse quince
            cosas de uno a otro. */}
        {vista === 'balance' && !mostrarFormulario && (
          <Informes transacciones={transacciones} mostrarCifras={mostrarCifras} onCambio={cargarTransacciones} onCopiaDescargada={marcarCopiaHecha} abrirEn={abrirInformesEn} seccion="balance" />
        )}
        {vista === 'informes' && !mostrarFormulario && (
          <Informes transacciones={transacciones} mostrarCifras={mostrarCifras} onCambio={cargarTransacciones} onCopiaDescargada={marcarCopiaHecha} abrirEn={abrirInformesEn} seccion="informes"
            onSaldar={() => { setAbrirInformesEn({ saldar: true }); setVista('balance') }} />
        )}
        {vista === 'ajustes' && !mostrarFormulario && (
          <Ajustes usuario={usuario} transacciones={transacciones} onVerDetalleEvento={ev => setEventoDetalle(ev)} mostrarCifras={mostrarCifras} onCerrarSesion={cerrarSesion} />
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
                    {ocultar(mostrarCifras, `${euros0(gastoEvento)} € gastado de ${euros0(Number(eventoActivo.presupuesto))} €`)}
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
                {gastoEvento > 0 ? ocultar(mostrarCifras, `${euros(gastoEvento)} € gastado`) : 'Sin presupuesto definido'}
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
      {/* Resumen del mes que acaba de cerrarse. Sale una vez, la primera que
          se abre la app en el mes nuevo, que es cuando tiene sentido mirar
          atrás y, si hace falta, saldar. */}
      {mostrarResumenMes && resumenMes && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cerrarResumenMes} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl animate-fade-in">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Se ha cerrado el mes</p>
            <h2 className="text-lg font-bold text-gray-900 text-center capitalize mb-3">{resumenMes.nombre}</h2>

            <div className="flex justify-center mb-3">
              <button type="button" onClick={() => setVerCifrasResumen(v => !v)}
                className="text-xs font-semibold text-white bg-emerald-500 rounded-xl px-3 py-1.5">
                {verCifrasResumen ? '🙈 Ocultar importes' : '👁️ Ver importes'}
              </button>
            </div>

            <div className="bg-red-50 rounded-2xl px-4 py-3 text-center mb-3">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Gastasteis entre los dos</p>
              <p className="text-2xl font-bold text-red-500 mt-0.5">
                {ocultar(verCifrasResumen, `${euros(resumenMes.total)} €`)}
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 mb-5">
              {resumenMes.puesto.map(([quien, cuanto]) => (
                <div key={quien} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-sm text-gray-500">Puso {quien}</span>
                  <span className="text-sm font-bold text-gray-800">
                    {ocultar(verCifrasResumen, `${euros(cuanto)} €`)}
                  </span>
                </div>
              ))}
            </div>

            {/* La cuenta de los dos sale del mismo cálculo que Informes
                (lib/deuda.js), no de una copia. Si están en paz no se enseña
                el botón de saldar: no habría nada que saldar. */}
            {deuda.importe >= 0.01 ? (
              <>
                <div className="bg-[#0d1b2a] rounded-2xl px-4 py-3 text-center mb-4">
                  {/* Lo de arriba es de este mes; esto NO. La deuda se cuenta
                      desde el primer día, así que hay que decirlo o parece que
                      las tres cifras hablan del mismo periodo. La misma
                      coletilla que lleva la tarjeta de Informes. */}
                  <p className="text-[10px] font-bold text-[#8fa6c9] uppercase tracking-widest">La cuenta de los dos</p>
                  <p className="text-[10px] text-[#8fa6c9] mb-1">
                    {ultimoCierre
                      ? `Desde el cierre del ${new Date(ultimoCierre.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long' })}`
                      : 'En total, desde el principio'}
                  </p>
                  <p className="text-base font-bold text-white mt-1 leading-snug">
                    {deuda.deudor} le debe {ocultar(verCifrasResumen, `${euros(deuda.importe)} €`)} a {deuda.acreedor}
                  </p>
                </div>
                <button
                  onClick={() => { cerrarResumenMes(); setAbrirInformesEn({ saldar: true }); setVista('balance') }}
                  className="w-full py-3.5 bg-teal-600 text-white font-bold rounded-2xl text-sm mb-2.5">
                  🤝 Saldar cuentas
                </button>
              </>
            ) : (
              <div className="bg-[#0d1b2a] rounded-2xl px-4 py-3 text-center mb-4">
                <p className="text-base font-bold text-white">Estáis en paz</p>
              </div>
            )}

            {/* La copia del mes se ofrece aquí, que es cuando toca: el mes
                acaba de cerrarse. Así no hacen falta dos ventanas seguidas. */}
            <button
              onClick={() => { cerrarResumenMes(); setAbrirInformesEn({ vista: 'historico' }); setVista('informes') }}
              className="w-full py-3.5 bg-[#0d1b2a] text-white font-bold rounded-2xl text-sm mb-2.5">
              📥 Descargar la copia
            </button>
            <button onClick={cerrarResumenMes} className="w-full py-3 text-gray-400 font-medium text-sm">
              Ahora no
            </button>
          </div>
        </div>
      )}

      {mostrarRecordatorioCopia && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={posponerRecordatorio} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl animate-fade-in">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            {/* A partir de dos meses el aviso cambia de tono. No hay copias
                automáticas a propósito (una copia entera dejaría ver los gastos
                personales del otro), así que esto es lo único que hay entre
                vosotros y perder la contabilidad. */}
            <div className="text-4xl text-center mb-3">{mesesSinCopia >= 2 ? '⚠️' : '💾'}</div>
            <h2 className={`text-lg font-bold text-center mb-1 ${mesesSinCopia >= 2 ? 'text-red-600' : 'text-gray-900'}`}>
              {mesesSinCopia >= 2 ? 'Lleváis sin copia de seguridad' : 'Copia de seguridad'}
            </h2>
            <p className={`text-sm text-center mb-6 ${mesesSinCopia >= 2 ? 'text-gray-700' : 'text-gray-500'}`}>
              {mesesSinCopia >= 99
                ? <>Todavía no habéis descargado ninguna copia. Si algo le pasara al servidor, <b>no habría forma de recuperar nada</b>.</>
                : mesesSinCopia >= 2
                  ? <>Han pasado <b>{mesesSinCopia} meses</b> desde la última. Si algo le pasara al servidor, se perdería todo lo apuntado desde entonces.</>
                  : <>Descarga tus datos una vez al mes para tenerlos a salvo si algo falla con el servidor.</>}
            </p>
            <button
              onClick={() => { setMostrarRecordatorioCopia(false); setAbrirInformesEn({ vista: 'historico' }); setVista('informes') }}
              className={`w-full py-3.5 text-white font-bold rounded-2xl text-sm mb-3 ${mesesSinCopia >= 2 ? 'bg-red-600' : 'bg-[#0d1b2a]'}`}>
              📥 Ir a Informes y descargar
            </button>
            <button
              onClick={posponerRecordatorio}
              className="w-full py-3 text-gray-400 font-medium text-sm">
              {mesesSinCopia >= 2 ? 'Ahora no puedo' : 'Recordar la próxima vez que entre'}
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
            await borrarApunte(supabase, t)
            setTransaccionDetalle(null)
            cargarTransacciones()
          }}
        />
      )}
    </div>
  )
}
