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
