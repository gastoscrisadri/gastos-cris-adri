import { createClient } from '@/lib/supabase/client'

// Si la tabla aún no tiene las columnas nuevas, o falla la consulta,
// la app sigue funcionando con estos medios de pago de siempre.
export const CUENTAS_RESPALDO = [
  { nombre: 'Efectivo Cris', emoji: '💵', persona: 'Cris' },
  { nombre: 'Efectivo Adri', emoji: '💵', persona: 'Adri' },
  { nombre: 'Tarjeta Cris', emoji: '💳', persona: 'Cris' },
  { nombre: 'Tarjeta Adri', emoji: '💳', persona: 'Adri' },
  { nombre: 'Bizum', emoji: '📱', persona: 'Común' },
  { nombre: 'Banco', emoji: '🏦', persona: 'Común' },
  { nombre: 'Transferencia', emoji: '🏦', persona: 'Común' },
  { nombre: 'Tarjeta roja', emoji: '💳', persona: 'Común' },
]

export async function cargarCuentas() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cuentas')
    .select('*')
    .order('orden')
    .order('nombre')

  if (error || !data || data.length === 0) return CUENTAS_RESPALDO

  // Devolvemos también las ocultas: sus apuntes antiguos siguen necesitando
  // saber de quién era el dinero. Quien monta listas para elegir usa
  // soloActivas() para no ofrecerlas.
  // Las columnas nuevas pueden no existir todavía: rellenamos por si acaso,
  // así la app nunca se queda sin medios de pago.
  return data.map(c => ({
    ...c,
    emoji: c.emoji || '💳',
    persona: c.persona || 'Común',
  }))
}

export function soloActivas(cuentas) {
  return (cuentas || []).filter(c => c.activa !== false)
}

// De quién es el dinero de un medio de pago, según lo que diga su cuenta.
export function personaDeMedioPago(medioPago, cuentas) {
  if (!medioPago) return 'Sin asignar'
  const cuenta = (cuentas || []).find(c => c.nombre === medioPago)
  return cuenta?.persona || 'Común'
}

// El efectivo y la tarjeta de quien registra van primero, luego lo común,
// y al final lo del otro. Si el móvil no está configurado, se deja el orden tal cual.
export function ordenarPara(quien, cuentas) {
  const lista = soloActivas(cuentas)
  if (!quien) return lista

  const peso = c => {
    if (c.persona === quien) return 0
    if (c.persona === 'Común') return 1
    return 2
  }
  return [...lista].sort((a, b) => peso(a) - peso(b))
}
