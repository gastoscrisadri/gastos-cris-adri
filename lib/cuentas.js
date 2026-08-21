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

// Orden dentro de cada persona: tarjeta, bizum, efectivo, banco.
// Se deduce del nombre para que funcione sin configurar nada, pero si la
// cuenta tiene un "orden" propio (puesto a mano), ese manda.
const RANGO_POR_TIPO = [
  [/tarjeta/i, 1],
  [/bizum/i, 2],
  [/efectivo/i, 3],
  [/banco|caixa|cuenta/i, 4],
]

function rango(cuenta) {
  if (cuenta.orden) return cuenta.orden
  const encontrado = RANGO_POR_TIPO.find(([re]) => re.test(cuenta.nombre || ''))
  return encontrado ? encontrado[1] : 5
}

// Primero las cuentas de quien registra, luego las del otro, y al final las
// comunes. Si el móvil no está configurado, se deja el orden por tipo.
export function ordenarPara(quien, cuentas) {
  const lista = soloActivas(cuentas)

  const peso = c => {
    if (!quien) return c.persona === 'Común' ? 1 : 0
    if (c.persona === quien) return 0
    if (c.persona === 'Común') return 2
    return 1
  }

  return [...lista].sort((a, b) =>
    peso(a) - peso(b) ||
    rango(a) - rango(b) ||
    (a.nombre || '').localeCompare(b.nombre || '')
  )
}
