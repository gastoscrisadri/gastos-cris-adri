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
