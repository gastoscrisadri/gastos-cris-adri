// Direcciones firmadas para las fotos de tickets.
//
// El almacén "documentos" es público: cualquiera con la dirección puede ver
// la foto sin haber entrado en la app, y en una captura del banco puede salir
// un número de cuenta. Estas direcciones se guardan en
// `transacciones.imagen_url` y se siguen guardando tal cual porque identifican
// el archivo, pero aquí se convierten, en el momento de enseñarlas, en una
// dirección firmada que caduca en una hora y solo funciona para quien ha
// entrado en la app.
//
// Si algo falla al firmar, se devuelve la dirección original: mientras el
// almacén siga siendo público la app funciona igual que antes, así que este
// cambio no puede romper nada por sí solo. Cerrar el almacén es un paso
// aparte, que se hace después de comprobar que esto funciona.

const CADUCIDAD = 60 * 60 // una hora

/** Saca el nombre del archivo de una dirección guardada. */
export function nombreArchivo(url) {
  if (!url) return null
  const trozo = url.split('/documentos/').pop()
  if (!trozo || trozo === url) return null
  return decodeURIComponent(trozo.split('?')[0])
}

/**
 * Devuelve una dirección firmada para ver la foto.
 * Ante cualquier problema devuelve la original, nunca null.
 */
export async function urlFirmada(supabase, url) {
  const nombre = nombreArchivo(url)
  if (!nombre) return url
  try {
    const { data, error } = await supabase.storage
      .from('documentos')
      .createSignedUrl(nombre, CADUCIDAD)
    return error ? url : (data?.signedUrl || url)
  } catch {
    return url
  }
}

/**
 * Borra un apunte Y su foto.
 *
 * Existe porque el borrado estaba escrito a mano en dos sitios y ninguno de
 * los dos tocaba el almacén: la foto se quedaba allí para siempre, sin apunte
 * al que pertenecer y sin forma de verla ni de borrarla desde la app. El
 * 26/09/2026 había 7 ficheros guardados para 1 solo apunte con foto.
 *
 * Importa más de lo que parece: el plan gratuito da 1 GB, y las fotos de
 * ticket pesan medio mega. Basura acumulada durante años llena ese hueco y
 * llega el día en que no se puede guardar una foto nueva.
 *
 * Orden a propósito: primero la foto, después el apunte. Si fallara el
 * borrado de la foto, el apunte se borra igual y como mucho queda una
 * huérfana --exactamente lo de antes, nunca peor. Al revés, un fallo dejaría
 * un apunte apuntando a una foto que ya no existe, que se ve como un hueco
 * roto en la pantalla.
 */
export async function borrarApunte(supabase, t) {
  const nombre = nombreArchivo(t?.imagen_url)
  if (nombre) {
    try {
      await supabase.storage.from('documentos').remove([nombre])
    } catch {
      // Da igual: se sigue y se borra el apunte.
    }
  }
  return supabase.from('transacciones').delete().eq('id', t.id)
}
