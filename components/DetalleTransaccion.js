'use client'

import { useState, useEffect } from 'react'
import { ocultar, euros } from '@/lib/cifras'
import { createClient } from '@/lib/supabase/client'
import { urlFirmada } from '@/lib/fotos'
import FormTransaccion from './FormTransaccion'

export default function DetalleTransaccion({ transaccion: t, onCerrar, onEliminar, onGuardado, mostrarCifras }) {
  const [confirmando, setConfirmando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [eventos, setEventos] = useState([])
  const [eventoId, setEventoId] = useState(t?.evento_id || null)
  const [mostrarSelectorEvento, setMostrarSelectorEvento] = useState(false)
  const [guardandoEvento, setGuardandoEvento] = useState(false)
  const [eliminandoFoto, setEliminandoFoto] = useState(false)
  const [imagenUrl, setImagenUrl] = useState(t?.imagen_url || null)
  // Dirección con la que se pinta la imagen: la firmada si se consigue, y si
  // no la propia imagenUrl (ver lib/fotos.js). Nunca se queda en blanco.
  // imagenUrl sigue siendo la guardada en la base de datos, que es la que usa
  // el borrado para saber qué archivo quitar.
  const [imagenVer, setImagenVer] = useState(t?.imagen_url || null)
  const supabase = createClient()

  useEffect(() => {
    let cancelado = false
    if (!imagenUrl) { setImagenVer(null); return }
    setImagenVer(imagenUrl)
    urlFirmada(supabase, imagenUrl).then(u => { if (!cancelado) setImagenVer(u) })
    return () => { cancelado = true }
  }, [imagenUrl])

  useEffect(() => {
    supabase.from('eventos').select('id, nombre').eq('archivado', false).order('activo', { ascending: false }).then(({ data }) => {
      if (data) setEventos(data)
    })
  }, [])

  async function eliminarFoto() {
    setEliminandoFoto(true)
    const nombreArchivo = imagenUrl.split('/documentos/').pop()
    await supabase.storage.from('documentos').remove([nombreArchivo])
    await supabase.from('transacciones').update({ imagen_url: null }).eq('id', t.id)
    setImagenUrl(null)
    setEliminandoFoto(false)
    onGuardado?.()
  }

  async function guardarEvento(nuevoEventoId) {
    setGuardandoEvento(true)
    await supabase.from('transacciones').update({ evento_id: nuevoEventoId }).eq('id', t.id)
    setEventoId(nuevoEventoId)
    setMostrarSelectorEvento(false)
    setGuardandoEvento(false)
    onGuardado?.()
  }

  if (!t) return null

  // Modo edición en el mismo overlay
  if (editando) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--superficie)]">
        <div className="bg-[var(--superficie)] px-4 pt-10 pb-5">
          <button onClick={() => setEditando(false)}
            className="text-white/60 text-sm mb-3 flex items-center gap-1">
            ← Volver al detalle
          </button>
          <h1 className="text-xl font-bold text-white">Editar apunte</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <FormTransaccion
            transaccionEditar={t}
            onGuardado={() => { setEditando(false); onGuardado?.() }}
            onCancelar={() => setEditando(false)}
            onEliminar={tx => onEliminar?.(tx)}
          />
        </div>
      </div>
    )
  }

  const importe = Number(t.importe)
  const esDevolucion = t.tipo === 'gasto' && importe < 0
  const esGastoNormal = t.tipo === 'gasto' && importe >= 0
  const colorImporte = esGastoNormal ? 'text-[var(--gasto)]' : 'text-[var(--ingreso)]'
  const signo = esGastoNormal ? '-' : '+'

  const [anio, mesNum, dia] = t.fecha.split('-')
  const fechaLegible = new Date(t.fecha + 'T12:00:00').toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--superficie)]">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-[var(--linea-2)]">
        <button
          onClick={onCerrar}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--superficie-3)] text-[var(--tinta-3)] text-lg font-bold"
        >
          ←
        </button>
        <h2 className="text-lg font-bold text-[var(--tinta)] flex-1">Detalle</h2>
        {!confirmando ? (
          <>
            <button onClick={() => setEditando(true)}
              className="px-3 py-2 bg-[var(--acento)] text-[var(--acento-tinta)] text-sm font-semibold rounded-xl">
              Editar
            </button>
            <button onClick={() => setConfirmando(true)}
              className="px-3 py-2 bg-[#3A2230] text-[var(--gasto)] text-sm font-semibold rounded-xl">
              Eliminar
            </button>
          </>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-[var(--tinta-3)]">¿Seguro?</span>
            <button onClick={() => onEliminar?.(t)}
              className="px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl">
              Sí, borrar
            </button>
            <button onClick={() => setConfirmando(false)}
              className="px-3 py-2 bg-[var(--superficie-3)] text-[var(--tinta-3)] text-sm font-semibold rounded-xl">
              No
            </button>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 pb-12 space-y-4 pt-4">

        {/* Importe grande */}
        <div className="text-center py-4">
          {esDevolucion && (
            <p className="text-xs font-semibold text-[var(--ingreso)] uppercase tracking-wide mb-1">Devolución o cobro</p>
          )}
          <p className={`text-5xl font-bold ${colorImporte}`}>
            {ocultar(mostrarCifras, `${signo}${euros(Math.abs(importe))} €`)}
          </p>
          <p className="text-sm text-[var(--tinta-4)] mt-2 capitalize">{fechaLegible}</p>
        </div>

        {/* Datos */}
        <div className="bg-[var(--superficie-2)] rounded-2xl divide-y divide-[var(--linea-2)]">
          {t.establecimiento && (
            <Fila label="Establecimiento" valor={t.establecimiento} />
          )}
          <Fila label="Categoría" valor={t.categoria} />
          {t.subcategoria && <Fila label="Subcategoría" valor={t.subcategoria} />}
          <Fila
            label="Tipo"
            valor={esDevolucion ? 'Devolución o cobro' : t.tipo === 'gasto' ? 'Gasto' : 'Ingreso'}
          />
          {t.medio_pago && <Fila label="Medio de pago" valor={t.medio_pago} />}
          {/* De quién es el gasto. Se dice siempre, también cuando es común:
              si solo se marcara lo personal no se sabría si lo demás es de
              los dos o es que falta el dato. */}
          <Fila
            label="De quién es"
            valor={t.liquidacion_a
              ? `Ajuste de cuentas · pago a ${t.liquidacion_a}`
              : t.a_cargo_de
                ? `Gasto de ${t.a_cargo_de} · lo pagó el otro, por eso lo veis los dos`
                : t.comun === false ? 'Personal, solo lo ves tú' : 'De los dos'}
          />
          {t.quien && <Fila label="Registrado por" valor={t.quien} />}
          {t.descripcion && <Fila label="Notas" valor={t.descripcion} />}
        </div>

        {/* Evento */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide">Evento</p>
            <button
              onClick={() => setMostrarSelectorEvento(v => !v)}
              className="text-xs text-[var(--acento)] font-semibold">
              {eventoId ? 'Cambiar' : '+ Asignar'}
            </button>
          </div>
          {eventoId ? (
            <div className="flex items-center justify-between bg-[var(--aviso-fondo)] border border-[var(--aviso-linea)] rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span>🎯</span>
                <span className="text-sm font-semibold text-[var(--aviso)]">
                  {eventos.find(e => e.id === eventoId)?.nombre || 'Evento'}
                </span>
              </div>
              <button onClick={() => guardarEvento(null)} disabled={guardandoEvento}
                className="text-orange-400 text-xs font-bold px-2">✕</button>
            </div>
          ) : (
            <p className="text-sm text-[var(--tinta-4)] px-1">Sin evento asignado</p>
          )}

          {mostrarSelectorEvento && (
            <div className="mt-2 bg-[var(--superficie)] border border-[var(--linea)] rounded-xl overflow-hidden shadow-sm">
              {eventos.length === 0 ? (
                <p className="text-sm text-[var(--tinta-4)] p-3 text-center">No hay eventos disponibles</p>
              ) : (
                eventos.map((ev, idx) => (
                  <button key={ev.id} onClick={() => guardarEvento(ev.id)} disabled={guardandoEvento}
                    className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between ${idx > 0 ? 'border-t border-[var(--linea-3)]' : ''} ${eventoId === ev.id ? 'text-[var(--aviso)] bg-[var(--aviso-fondo)]' : 'text-[var(--tinta)]'}`}>
                    <span>{ev.nombre}</span>
                    {eventoId === ev.id && <span className="text-orange-500 text-xs">✓ Actual</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Foto del ticket */}
        {imagenUrl && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide">Foto del documento</p>
              <button
                onClick={eliminarFoto}
                disabled={eliminandoFoto}
                className="text-xs text-[var(--gasto)] font-semibold disabled:opacity-40">
                {eliminandoFoto ? 'Eliminando…' : 'Eliminar foto'}
              </button>
            </div>
            <a href={imagenVer} target="_blank" rel="noopener noreferrer">
              <img
                src={imagenVer}
                alt="Documento"
                className="w-full rounded-2xl border border-[var(--linea-2)] shadow-sm object-contain max-h-96"
              />
              <p className="text-xs text-[var(--acento)] text-center mt-1">Toca para ver a tamaño completo</p>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function Fila({ label, valor }) {
  return (
    <div className="flex justify-between items-start px-4 py-3 gap-4">
      <span className="text-sm text-[var(--tinta-4)] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[var(--tinta)] text-right">{valor}</span>
    </div>
  )
}
