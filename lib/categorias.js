import { createClient } from '@/lib/supabase/client'

// Aquí había dos listas de categorías escritas a mano, con el comentario
// "para el prompt de OCR". No las usaba nadie, y encima no coincidían ni con
// las de la base de datos ni con las que el OCR le pasaba a Gemini: tres
// listas distintas en la misma app. Ahora hay una sola, la de la base de
// datos, y el OCR la lee de ahí.

export async function cargarCategorias() {
  const supabase = createClient()
  const { data } = await supabase
    .from('categorias')
    .select('*')
    .eq('activa', true)
    .order('orden')
  return data || []
}

export function principalesPorTipo(categorias, tipo) {
  return categorias.filter(c => c.tipo === tipo && !c.padre_id)
}

export function subcategoriasDeCategoria(categorias, padreId) {
  return categorias.filter(c => c.padre_id === padreId)
}
