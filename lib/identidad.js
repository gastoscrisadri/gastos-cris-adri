// Quién eres en la app.
//
// Antes esto se guardaba solo en el móvil (localStorage "quienRegistra"): era
// una preferencia del teléfono, cambiable en dos toques. Eso valía mientras
// solo servía para rellenar un campo, pero no sirve para los gastos
// personales: si el nombre lo decide el móvil y no la cuenta con la que has
// entrado, cualquiera podría apuntar gastos como si fuera el otro.
//
// Ahora el nombre vive en la propia cuenta. El móvil se sigue usando como
// respaldo para que nada deje de funcionar mientras convivan las dos formas.

import { createClient } from '@/lib/supabase/client'

export const NOMBRES = ['Cris', 'Adri']

/** El nombre guardado en la cuenta; si no lo tiene, el del móvil. */
export function nombreDe(usuario) {
  const enCuenta = usuario?.user_metadata?.nombre
  if (enCuenta) return enCuenta
  if (typeof window !== 'undefined') return localStorage.getItem('quienRegistra') || ''
  return ''
}

/** ¿El nombre viene de la cuenta o todavía del móvil? */
export function nombreEsDeLaCuenta(usuario) {
  return !!usuario?.user_metadata?.nombre
}

/**
 * Guarda el nombre en la cuenta. Lo escribe también en el móvil: así, si la
 * conexión falla, la app sigue sabiendo quién eres como hasta ahora.
 * Devuelve true si quedó guardado en la cuenta.
 */
export async function guardarNombre(nombre) {
  if (typeof window !== 'undefined') localStorage.setItem('quienRegistra', nombre)
  try {
    const { error } = await createClient().auth.updateUser({ data: { nombre } })
    return !error
  } catch {
    return false
  }
}
