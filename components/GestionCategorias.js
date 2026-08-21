'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cargarCategorias } from '@/lib/categorias'

export default function GestionCategorias() {
  const [categorias, setCategorias] = useState([])
  const [vistaFiltro, setVistaFiltro] = useState('gasto')
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [nuevaSubcategoria, setNuevaSubcategoria] = useState({ nombre: '', padreId: null })
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

  async function guardarEdicion(id) {
    if (!nombreEdicion.trim()) return
    await supabase.from('categorias').update({ nombre: nombreEdicion.trim() }).eq('id', id)
    setEditando(null)
    recargar()
  }

  return (
    <div className="pb-24 space-y-4">
      {/* Filtro tipo */}
      <div className="flex rounded-2xl overflow-hidden border border-gray-200">
        <button onClick={() => setVistaFiltro('gasto')}
          className={`flex-1 py-2.5 text-sm font-semibold ${vistaFiltro === 'gasto' ? 'bg-red-500 text-white' : 'bg-white text-gray-400'}`}>
          Gastos
        </button>
        <button onClick={() => setVistaFiltro('ingreso')}
          className={`flex-1 py-2.5 text-sm font-semibold ${vistaFiltro === 'ingreso' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-400'}`}>
          Ingresos
        </button>
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl p-3">{error}</p>}

      {/* Lista de categorías */}
      <div className="space-y-2">
        {principales.map(cat => {
          const subs = subcategoriasDe(cat.id)
          const estaAbierto = abiertos.has(cat.id)

          return (
            <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Categoría principal */}
              <div className="flex items-center gap-2 px-4 py-3">
                {editando === cat.id ? (
                  <>
                    <input autoFocus value={nombreEdicion} onChange={e => setNombreEdicion(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && guardarEdicion(cat.id)}
                      className="flex-1 px-3 py-1.5 border border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <button onClick={() => guardarEdicion(cat.id)} className="text-blue-600 text-sm font-semibold">Guardar</button>
                    <button onClick={() => setEditando(null)} className="text-gray-400 text-sm">✕</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-semibold text-gray-800 text-sm">{cat.nombre}</span>
                    <button onClick={() => { setEditando(cat.id); setNombreEdicion(cat.nombre) }}
                      className="text-xs text-gray-300 hover:text-blue-500 px-1.5 py-1">✏️</button>
                    {subs.length > 0 && (
                      <button onClick={() => toggleAbierto(cat.id)}
                        className="text-xs text-gray-400 font-semibold px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center gap-1">
                        {subs.length} {estaAbierto ? '▲' : '▼'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Subcategorías (desplegables) */}
              {estaAbierto && (
                <>
                  {subs.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100">
                      <span className="text-gray-300 text-xs">↳</span>
                      {editando === sub.id ? (
                        <>
                          <input autoFocus value={nombreEdicion} onChange={e => setNombreEdicion(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && guardarEdicion(sub.id)}
                            className="flex-1 px-3 py-1 border border-blue-300 rounded-xl text-sm focus:outline-none" />
                          <button onClick={() => guardarEdicion(sub.id)} className="text-blue-600 text-xs font-semibold">Guardar</button>
                          <button onClick={() => setEditando(null)} className="text-gray-400 text-xs">✕</button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-600">{sub.nombre}</span>
                          <button onClick={() => { setEditando(sub.id); setNombreEdicion(sub.nombre) }}
                            className="text-xs text-gray-300 hover:text-blue-500">✏️</button>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Añadir subcategoría */}
                  {nuevaSubcategoria.padreId === cat.id ? (
                    <div className="flex gap-2 px-4 py-2 bg-blue-50 border-t border-blue-100">
                      <input autoFocus value={nuevaSubcategoria.nombre}
                        onChange={e => setNuevaSubcategoria({ nombre: e.target.value, padreId: cat.id })}
                        onKeyDown={e => e.key === 'Enter' && agregarSubcategoria(cat.id)}
                        placeholder="Nombre de subcategoría..."
                        className="flex-1 px-3 py-1.5 border border-blue-200 rounded-xl text-sm focus:outline-none" />
                      <button onClick={() => agregarSubcategoria(cat.id)}
                        className="text-blue-600 text-sm font-semibold px-2">Añadir</button>
                      <button onClick={() => setNuevaSubcategoria({ nombre: '', padreId: null })}
                        className="text-gray-400 text-sm px-1">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setNuevaSubcategoria({ nombre: '', padreId: cat.id })}
                      className="w-full text-xs text-gray-400 hover:text-blue-500 py-2 border-t border-gray-100 flex items-center justify-center gap-1">
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
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nueva categoría</p>
        <div className="flex gap-2">
          <input value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregarCategoria()}
            placeholder="Nombre de la categoría..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={agregarCategoria}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm">
            Añadir
          </button>
        </div>
      </div>
    </div>
  )
}
