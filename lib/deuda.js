// La cuenta de los dos: quién debe a quién y cuánto.
//
// Es el cálculo más delicado de la app y el que más veces se ha verificado
// contra números reales. Vive aquí, en un solo sitio, porque lo necesitan dos
// pantallas: Informes, que lo enseña, y la portada, que resume el mes cerrado.
// Cada vez que una regla de dinero se ha copiado a mano en dos pantallas, ha
// acabado arreglándose en una y quedándose mal en la otra.
//
// Es una función pura: se le dan los apuntes, las cuentas y la regla de
// reparto (lib/reparto.js), y devuelve el resultado. No sabe nada de React.

import { NOMBRES } from '@/lib/identidad'
import { personaDeMedioPago } from '@/lib/cuentas'
import { esLiquidacion } from '@/lib/apuntes'

export function calcularDeuda(transacciones, cuentas, miParte) {
  const comunes = transacciones.filter(t => t.tipo === 'gasto' && t.comun !== false && !esLiquidacion(t))
  const totalComun = comunes.reduce((s, t) => s + Number(t.importe), 0)
  const puesto = {}
  for (const n of NOMBRES) puesto[n] = 0
  let comunSinAsignar = 0
  comunes.forEach(t => {
    const quien = personaDeMedioPago(t.medio_pago, cuentas)
    if (puesto[quien] === undefined) { comunSinAsignar += Number(t.importe); return }
    puesto[quien] += Number(t.importe)
  })
  // Lo pagado con dinero común no lo ha puesto ninguno de los dos, así que
  // no genera deuda: se descuenta del total a repartir.
  //
  // Cuánto le toca a cada uno. La regla (a medias, el porcentaje de la
  // categoría o de la subcategoría, y los gastos a cargo de uno solo) vive
  // en lib/reparto.js, que es la MISMA que usan la portada y "Lo mío".
  // Aquí había una segunda copia de esa regla: esa duplicación fue la causa
  // de que un arreglo entrara en una pantalla y no en la gemela.
  const [uno, otro] = NOMBRES
  const toca = { [uno]: 0, [otro]: 0 }
  comunes.forEach(t => {
    if (personaDeMedioPago(t.medio_pago, cuentas) === 'Común') return  // no lo puso nadie
    toca[uno] += miParte(t, uno)
    toca[otro] += miParte(t, otro)
  })
  const aRepartir = totalComun - comunSinAsignar
  const tocaCadaUno = aRepartir / 2

  // Lo pagado en gastos se guarda aparte de los ajustes por liquidaciones:
  // mezclarlos en una sola cifra daba números que no se entienden (un
  // "ha puesto" en negativo, por ejemplo).
  const pagado = { ...puesto }
  const ajuste = {}
  for (const n of NOMBRES) ajuste[n] = 0
  transacciones.filter(esLiquidacion).forEach(t => {
    const importe = Number(t.importe)
    const paga = t.quien
    const cobra = t.liquidacion_a
    if (ajuste[paga] !== undefined) ajuste[paga] += importe
    if (ajuste[cobra] !== undefined) ajuste[cobra] -= importe
  })
  for (const n of NOMBRES) puesto[n] = pagado[n] + ajuste[n]

  // Cuánto ha puesto cada uno de más (o de menos) respecto a lo que le tocaba
  const saldo = (puesto[uno] - toca[uno]) - (puesto[otro] - toca[otro])
  return {
    totalComun, comunSinAsignar, aRepartir, tocaCadaUno, puesto, pagado, ajuste, toca,
    acreedor: saldo > 0 ? uno : otro,
    deudor: saldo > 0 ? otro : uno,
    // La deuda es la mitad de la diferencia entre lo que ha puesto cada uno.
    importe: Math.abs(saldo) / 2,
  }
}
