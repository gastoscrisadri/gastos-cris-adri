'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cargarCategorias } from '@/lib/categorias'
import { NOMBRES } from '@/lib/identidad'

function EditorReparto({ item, esSub, onGuardar, onQuitar }) {
  // Se monta al abrir el desplegable, así que el valor de partida es el
  // guardado. Se escribe en su propio estado, no en la base de datos.
  const [texto, setTexto] = useState(() =>
    item.porcentaje_primero != null ? String(item.porcentaje_primero).replace('.', ',') : '50')
  const [guardado, setGuardado] = useState(false)

  // Vale con coma o con punto: aquí se escribe con coma.
  const num = parseFloat(String(texto).replace(',', '.'))
  const valido = !isNaN(num) && num >= 0 && num <= 100
  const cambiado = !valido || item.porcentaje_primero == null || Math.abs(num - item.porcentaje_primero) > 0.00005

  async function guardar() {
    if (!valido) return
    await onGuardar(num)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  const corto = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 4 })

  return (
    <div className={esSub ? 'w-full mt-2 pt-2 border-t border-[var(--linea-2)] space-y-2' : 'space-y-2'}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--tinta-3)] shrink-0">{NOMBRES[0]} paga el</span>
        <input type="text" inputMode="decimal" value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); guardar() } }}
          className={`w-20 px-2 py-1 border rounded-lg text-sm text-center ${valido ? 'border-[var(--linea)]' : 'border-[#5A2C3C] bg-[#3A2230]'}`} />
        <span className="text-xs text-[var(--tinta-3)]">%</span>
        <button type="button" onClick={guardar} disabled={!valido || !cambiado}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--dinero)] text-[var(--dinero-tinta)] disabled:bg-[var(--superficie-4)] disabled:text-[var(--tinta-4)]">
          Guardar
        </button>
        {guardado && <span className="text-xs font-semibold text-[var(--dinero)]">Guardado ✓</span>}
      </div>
      <p className="text-xs text-[var(--tinta-4)]">
        {valido
          ? `A ${NOMBRES[1]} le toca el ${corto(100 - num)} %. Se puede escribir con coma: 66,6667`
          : 'Pon un número entre 0 y 100.'}
      </p>
      {item.porcentaje_primero != null && (
        <button type="button" onClick={onQuitar} className="text-xs text-[var(--tinta-4)] underline">
          {esSub ? 'como la categoría' : 'Volver a medias'}
        </button>
      )}
    </div>
  )
}

export default function GestionCategorias() {
  const [categorias, setCategorias] = useState([])
  const [vistaFiltro, setVistaFiltro] = useState('gasto')
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [nuevaSubcategoria, setNuevaSubcategoria] = useState({ nombre: '', padreId: null })
  const [repartoAbierto, setRepartoAbierto] = useState(null)

  // 33,3333 se enseña como "33,3" para que quepa; el valor guardado no cambia.
  const corto = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 1 })
  const [editando, setEditando] = useState(null)
  const [nombreEdicion, setNombreEdicion] = useState('')
  const [abiertos, setAbiertos] = useState(new Set())
  const [error, setError] = useState('')
  const supabase = createClient()

  async function recargar() {
    const data = await cargarCategorias()
    setCategorias(data)
  }

  useEffect(() => { recargar() }, [])

  const principales = categorias.filter(c => c.tipo === vistaFiltro && !c.padre_id)

  function subcategoriasDe(padreId) {
    return categorias.filter(c => c.padre_id === padreId)
  }

  function toggleAbierto(id) {
    setAbiertos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function agregarCategoria() {
    if (!nuevaCategoria.trim()) return
    const maxOrden = Math.max(0, ...principales.map(c => c.orden))
    const { error } = await supabase.from('categorias').insert({
      nombre: nuevaCategoria.trim(),
      tipo: vistaFiltro,
      orden: maxOrden + 1,
    })
    if (!error) { setNuevaCategoria(''); recargar() }
    else setError('Error al crear categoría')
  }

  async function agregarSubcategoria(padreId) {
    if (!nuevaSubcategoria.nombre.trim()) return
    const { error } = await supabase.from('categorias').insert({
      nombre: nuevaSubcategoria.nombre.trim(),
      tipo: vistaFiltro,
      padre_id: padreId,
      orden: 0,
    })
    if (!error) { setNuevaSubcategoria({ nombre: '', padreId: null }); recargar() }
    else setError('Error al crear subcategoría')
  }

  // Reparto de una categoría entre los dos. Vacío = a medias.
  async function cambiarReparto(cat, porcentaje) {
    await supabase.from('categorias').update({ porcentaje_primero: porcentaje }).eq('id', cat.id)
    recargar()
  }

  async function guardarEdicion(id) {
    if (!nombreEdicion.trim()) return
    await supabase.from('categorias').update({ nombre: nombreEdicion.trim() }).eq('id', id)
    setEditando(null)
    recargar()
  }

  // Quitar una categoría o subcategoría sin poder estropear el historial:
  // si nunca se ha usado se borra de verdad; si tiene apuntes solo se oculta,
  // para que esos apuntes conserven el nombre que tenían.
  async function quitar(cat) {
    const esPrincipal = !cat.padre_id
    const hijas = esPrincipal ? subcategoriasDe(cat.id) : []

    const nombres = [cat.nombre, ...hijas.map(h => h.nombre)]
    const contar = campo => supabase
      .from('transacciones')
      .select('id', { count: 'exact', head: true })
      .in(campo, nombres)

    const [comoCategoria, comoSubcategoria] = await Promise.all([
      contar('categoria'),
      contar('subcategoria'),
    ])

    // Si la consulta falla, damos por hecho que sí se ha usado: así nunca
    // se borra por error algo que tenía apuntes detrás.
    if (comoCategoria.error || comoSubcategoria.error) {
      window.alert('No he podido comprobar si esta categoría está en uso. Inténtalo de nuevo en un momento.')
      return
    }

    const usados = (comoCategoria.count || 0) + (comoSubcategoria.count || 0)
    const aviso = usados > 0
      ? `"${cat.nombre}" se ha usado en ${usados} apunte${usados === 1 ? '' : 's'}.\n\n` +
        'Se quitará de las listas al crear apuntes nuevos, pero los apuntes ya guardados no cambian. ¿Seguimos?'
      : hijas.length > 0
        ? `Se borrará "${cat.nombre}" y sus ${hijas.length} subcategorías. No se ha usado en ningún apunte. ¿Seguimos?`
        : `Se borrará "${cat.nombre}". No se ha usado en ningún apunte. ¿Seguimos?`

    if (!window.confirm(aviso)) return

    if (usados > 0) {
      const ids = [cat.id, ...hijas.map(h => h.id)]
      await supabase.from('categorias').update({ activa: false }).in('id', ids)
    } else {
      // El borrado en cascada de la base de datos se lleva también las hijas
      await supabase.from('categorias').delete().eq('id', cat.id)
    }
    recargar()
  }

  return (
    <div className="pb-24 space-y-4">
      {/* Filtro tipo */}
      <div className="flex rounded-2xl overflow-hidden border border-[var(--linea)]">
        <button onClick={() => setVistaFiltro('gasto')}
          className={`flex-1 py-2.5 text-sm font-semibold ${vistaFiltro === 'gasto' ? 'bg-red-500 text-white' : 'bg-[var(--superficie)] text-[var(--tinta-4)]'}`}>
          Gastos
        </button>
        <button onClick={() => setVistaFiltro('ingreso')}
          className={`flex-1 py-2.5 text-sm font-semibold ${vistaFiltro === 'ingreso' ? 'bg-emerald-500 text-white' : 'bg-[var(--superficie)] text-[var(--tinta-4)]'}`}>
          Ingresos
        </button>
      </div>

      {error && <p className="text-[var(--gasto)] text-sm bg-[#3A2230] rounded-xl p-3">{error}</p>}

      {/* Lista de categorías */}
      <div className="space-y-2">
        {principales.map(cat => {
          const subs = subcategoriasDe(cat.id)
          const estaAbierto = abiertos.has(cat.id)

          return (
            <div key={cat.id} className="bg-[var(--superficie)] rounded-2xl border border-[var(--linea-2)] shadow-sm overflow-hidden">
              {/* Categoría principal */}
              <div className="flex items-center gap-2 px-4 py-3">
                {editando === cat.id ? (
                  <>
                    <input autoFocus value={nombreEdicion} onChange={e => setNombreEdicion(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && guardarEdicion(cat.id)}
                      className="flex-1 px-3 py-1.5 border border-[var(--info-linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--acento)]" />
                    <button onClick={() => guardarEdicion(cat.id)} className="text-[var(--acento)] text-sm font-semibold">Guardar</button>
                    <button onClick={() => setEditando(null)} className="text-[var(--tinta-4)] text-sm">✕</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-semibold text-[var(--tinta)] text-sm">{cat.nombre}</span>
                    <button onClick={() => { setEditando(cat.id); setNombreEdicion(cat.nombre) }}
                      className="text-xs text-[var(--tinta-5)] hover:text-[var(--acento)] px-1.5 py-1">✏️</button>
                    <button onClick={() => quitar(cat)} aria-label={`Quitar ${cat.nombre}`}
                      className="text-xs text-[var(--tinta-5)] hover:text-[var(--gasto)] px-1.5 py-1">🗑️</button>
                    <button onClick={() => setRepartoAbierto(repartoAbierto === cat.id ? null : cat.id)}
                      title="Cómo se reparte entre los dos"
                      className={`text-[10px] px-1.5 py-1 rounded-lg font-semibold ${cat.porcentaje_primero != null ? 'text-[var(--dinero)] bg-[var(--comun-fondo)]' : 'text-[var(--tinta-5)] hover:text-[var(--dinero)]'}`}>
                      {cat.porcentaje_primero != null ? `${corto(cat.porcentaje_primero)}/${corto(100 - cat.porcentaje_primero)}` : '50/50'}
                    </button>
                    {/* Siempre visible, aunque no haya subcategorías: si no,
                        una categoría nueva nunca podría recibir la primera. */}
                    <button onClick={() => toggleAbierto(cat.id)}
                      className="text-xs text-[var(--tinta-4)] font-semibold px-2 py-1 rounded-lg bg-[var(--superficie-2)] hover:bg-[var(--superficie-3)] flex items-center gap-1">
                      {subs.length > 0 ? subs.length : '+'} {estaAbierto ? '▲' : '▼'}
                    </button>
                  </>
                )}
              </div>

              {repartoAbierto === cat.id && (
                <div className="px-4 py-3 bg-[var(--comun-fondo)]/60 border-t border-[var(--comun)] space-y-2">
                  <p className="text-xs text-[var(--tinta-3)]">
                    Cómo se reparte <b>{cat.nombre}</b> entre los dos. Afecta a «La cuenta de los dos» de Informes.
                  </p>
                  <EditorReparto item={cat}
                    onGuardar={v => cambiarReparto(cat, v)}
                    onQuitar={() => cambiarReparto(cat, null)} />
                </div>
              )}

              {/* Subcategorías (desplegables) */}
              {estaAbierto && (
                <>
                  {subs.map(sub => (
                    <div key={sub.id} className="flex items-center flex-wrap gap-2 px-4 py-2 bg-[var(--superficie-2)] border-t border-[var(--linea-2)]">
                      <span className="text-[var(--tinta-5)] text-xs">↳</span>
                      {editando === sub.id ? (
                        <>
                          <input autoFocus value={nombreEdicion} onChange={e => setNombreEdicion(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && guardarEdicion(sub.id)}
                            className="flex-1 px-3 py-1 border border-[var(--info-linea)] rounded-xl text-sm focus:outline-none" />
                          <button onClick={() => guardarEdicion(sub.id)} className="text-[var(--acento)] text-xs font-semibold">Guardar</button>
                          <button onClick={() => setEditando(null)} className="text-[var(--tinta-4)] text-xs">✕</button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-[var(--tinta-3)]">{sub.nombre}</span>
                          <button onClick={() => { setEditando(sub.id); setNombreEdicion(sub.nombre) }}
                            className="text-xs text-[var(--tinta-5)] hover:text-[var(--acento)]">✏️</button>
                          <button onClick={() => quitar(sub)} aria-label={`Quitar ${sub.nombre}`}
                            className="text-xs text-[var(--tinta-5)] hover:text-[var(--gasto)] px-1">🗑️</button>
                          <button onClick={() => setRepartoAbierto(repartoAbierto === sub.id ? null : sub.id)}
                            title="Cómo se reparte entre los dos"
                            className={`text-[10px] px-1.5 py-0.5 rounded-lg font-semibold ${sub.porcentaje_primero != null ? 'text-[var(--dinero)] bg-[var(--comun-fondo)]' : 'text-[var(--tinta-5)] hover:text-[var(--dinero)]'}`}>
                            {sub.porcentaje_primero != null ? `${corto(sub.porcentaje_primero)}/${corto(100 - sub.porcentaje_primero)}` : '—'}
                          </button>
                        </>
                      )}
                      {repartoAbierto === sub.id && (
                        <EditorReparto item={sub} esSub
                          onGuardar={v => cambiarReparto(sub, v)}
                          onQuitar={() => cambiarReparto(sub, null)} />
                      )}
                    </div>
                  ))}

                  {/* Añadir subcategoría */}
                  {nuevaSubcategoria.padreId === cat.id ? (
                    <div className="flex gap-2 px-4 py-2 bg-[var(--info-fondo)] border-t border-[var(--info-linea)]">
                      <input autoFocus value={nuevaSubcategoria.nombre}
                        onChange={e => setNuevaSubcategoria({ nombre: e.target.value, padreId: cat.id })}
                        onKeyDown={e => e.key === 'Enter' && agregarSubcategoria(cat.id)}
                        placeholder="Nombre de subcategoría..."
                        className="flex-1 px-3 py-1.5 border border-[var(--info-linea)] rounded-xl text-sm focus:outline-none" />
                      <button onClick={() => agregarSubcategoria(cat.id)}
                        className="text-[var(--acento)] text-sm font-semibold px-2">Añadir</button>
                      <button onClick={() => setNuevaSubcategoria({ nombre: '', padreId: null })}
                        className="text-[var(--tinta-4)] text-sm px-1">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setNuevaSubcategoria({ nombre: '', padreId: cat.id })}
                      className="w-full text-xs text-[var(--tinta-4)] hover:text-[var(--acento)] py-2 border-t border-[var(--linea-2)] flex items-center justify-center gap-1">
                      <span>+</span> Añadir subcategoría
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Nueva categoría principal */}
      <div className="bg-[var(--superficie)] rounded-2xl border border-[var(--linea)] p-4 space-y-2">
        <p className="text-xs font-semibold text-[var(--tinta-4)] uppercase tracking-wide">Nueva categoría</p>
        <div className="flex gap-2">
          <input value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregarCategoria()}
            placeholder="Nombre de la categoría..."
            className="flex-1 px-4 py-2.5 border border-[var(--linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--acento)]" />
          <button onClick={agregarCategoria}
            className="px-4 py-2.5 bg-[var(--acento)] text-[var(--acento-tinta)] rounded-xl font-semibold text-sm shadow-sm">
            Añadir
          </button>
        </div>
      </div>
    </div>
  )
}
