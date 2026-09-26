// Quién es quién: el nombre ("Cris", "Adri") y el identificador de su cuenta.
//
// Hace falta para una sola cosa, pero importante: guardar un gasto privado a
// nombre de SU DUEÑO cuando lo teclea el otro. Si Cris apunta un gasto de Adri
// pagado por Adri, ese apunte tiene que quedar a nombre de Adri — si no, Adri
// no lo vería y Cris sí, justo al revés de lo que toca.
//
// La tabla se rellena sola: cada uno se apunta la primera vez que abre la app.
// Nadie tiene que copiar identificadores a mano.

import { createClient } from '@/lib/supabase/client'

/**
 * Apunta a quien ha entrado, si aún no estaba. Se llama al abrir la app.
 * Si falla no pasa nada: se reintentará la próxima vez, y mientras tanto la
 * app se comporta como antes (ver idDe).
 */
export async function apuntarme(usuario, nombre) {
  if (!usuario?.id || !nombre) return
  try {
    await createClient()
      .from('personas')
      .upsert({ nombre, user_id: usuario.id }, { onConflict: 'nombre' })
  } catch {
    // Silencio a propósito: no vale la pena molestar por esto.
  }
}

/** Todas las personas apuntadas. Devuelve [] si algo falla. */
export async function cargarPersonas() {
  try {
    const { data } = await createClient().from('personas').select('nombre, user_id')
    return data || []
  } catch {
    return []
  }
}

/**
 * El identificador de una persona por su nombre, o null si todavía no se ha
 * apuntado. Quien llame a esto tiene que apañárselas con el null: es lo que
 * pasa mientras el otro no haya abierto la app ni una vez.
 */
export function idDe(personas, nombre) {
  return (personas || []).find(p => p.nombre === nombre)?.user_id || null
}
