import { createClient } from '@/lib/supabase/client'

// Constantes para el prompt de OCR (server-side)
export const CATEGORIAS_GASTO = [
  'Hogar', 'Suministros', 'Alimentación', 'Transporte', 'Salud',
  'Educación', 'Ropa y calzado', 'Ocio y restaurantes', 'Suscripciones',
  'Cuidado personal', 'Mascotas', 'Regalos', 'Impuestos y tasas', 'Otros gastos',
]

export const CATEGORIAS_INGRESO = [
  'Nómina', 'Ayudas y subsidios', 'Venta de objetos', 'Otros ingresos',
]

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
