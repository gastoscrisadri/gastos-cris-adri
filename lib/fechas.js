// La fecha de HOY según el reloj del móvil, no según el de Londres.
//
// `new Date().toISOString()` devuelve la fecha en horario UTC. En España vamos
// una o dos horas por delante, así que entre medianoche y las 01:00 (o las
// 02:00 en verano) el UTC todavía va por el día anterior: un gasto apuntado a
// las 00:30 se guardaba con la fecha de ayer. Y si era la madrugada del día 1,
// caía en el mes anterior, que puede estar ya saldado.
//
// Justo son las horas de una cena o unas cañas, así que pasa de verdad.

/** Hoy en formato YYYY-MM-DD, con la fecha del propio móvil. */
export function hoy() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** El mes de hoy, YYYY-MM. */
export function mesDeHoy() {
  return hoy().slice(0, 7)
}

/**
 * Meses enteros entre dos meses en formato YYYY-MM.
 * Si no hay mes de partida (nunca se ha hecho copia) devuelve un número alto,
 * para que el aviso salga ya en su versión seria.
 */
export function mesesEntre(desde, hasta) {
  if (!desde) return 99
  const [a1, m1] = desde.split('-').map(Number)
  const [a2, m2] = hasta.split('-').map(Number)
  if (!a1 || !m1 || !a2 || !m2) return 99
  return (a2 - a1) * 12 + (m2 - m1)
}

/**
 * Los meses que le faltan por generar a un gasto fijo, del más viejo al
 * actual. Devuelve ['AAAA-MM', ...].
 *
 * Vive aquí y no dentro de la pantalla porque de esto salen los alquileres:
 * si se salta un mes, la cuenta de los dos queda descuadrada por 1.400 € sin
 * que nada lo avise. Aquí se puede probar sola, y hay pruebas que lo hacen.
 *
 * Sin último mes generado (un gasto fijo recién creado) devuelve solo el mes
 * actual: rellenar hacia atrás crearía apuntes desde el principio de los
 * tiempos. El tope es la otra red: mejor quedarse corto que inundar la cuenta.
 */
export function mesesQueFaltan(ultimoGenerado, mesActual, tope = 12) {
  const siguiente = m => {
    const [a, n] = m.split('-').map(Number)
    return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, '0')}`
  }
  if (!ultimoGenerado || ultimoGenerado >= mesActual) return [mesActual]
  const meses = []
  let m = siguiente(ultimoGenerado)
  while (m <= mesActual && meses.length < tope) {
    meses.push(m)
    m = siguiente(m)
  }
  return meses.length ? meses : [mesActual]
}
