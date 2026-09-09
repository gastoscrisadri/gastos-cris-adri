// Cuánto de un apunte es tuyo.
//
// Un gasto de los dos no cuenta entero para ninguno: cuenta la parte que le
// toca a cada uno según el reparto puesto en Ajustes (el alquiler al
// 33,3333/66,6667, por ejemplo). Sin esto, a quien no paga el alquiler le
// salían sus ingresos menos el alquiler ENTERO, y el número no significaba
// nada.
//
// Esto vive aquí y no dentro de una pantalla porque hace falta en varias: la
// portada, los informes y lo que venga. Cada vez que se ha copiado la regla a
// mano se ha olvidado en algún sitio.

import { NOMBRES } from '@/lib/identidad'

/**
 * Prepara el reparto a partir de las categorías cargadas de la base de datos.
 * Devuelve una función: dado un apunte y tu nombre, cuánto de ese apunte es
 * tuyo.
 *
 * - Lo personal cuenta entero: es solo tuyo.
 * - Lo de los dos se parte según el porcentaje de su categoría, y la
 *   subcategoría manda sobre su categoría.
 * - Sin porcentaje configurado, a medias.
 * - Sin saber quién eres, cuenta entero (la app se comporta como antes).
 */
export function construirReparto(categorias) {
  const porCategoria = {}
  const porSubcategoria = {}
  for (const c of categorias || []) {
    if (c.porcentaje_primero == null) continue
    if (c.padre_id) porSubcategoria[c.nombre] = c.porcentaje_primero
    else porCategoria[c.nombre] = c.porcentaje_primero
  }

  // El porcentaje que le corresponde al primero de NOMBRES, o null si va a medias.
  const porcentajeDelPrimero = t => {
    if (t.subcategoria && porSubcategoria[t.subcategoria] != null) return porSubcategoria[t.subcategoria]
    return porCategoria[t.categoria] ?? null
  }

  return function miParte(t, yo) {
    const importe = Number(t.importe)
    if (!yo) return importe
    if (t.comun === false) return importe
    const pct = porcentajeDelPrimero(t)
    if (pct == null) return importe / 2
    return yo === NOMBRES[0] ? importe * pct / 100 : importe * (100 - pct) / 100
  }
}
