// Qué es cada apunte.
//
// Estas reglas contestan preguntas que se hacen en varias pantallas: ¿esto es
// un gasto de la casa?, ¿es un pago de uno al otro? Viven aquí y no dentro de
// una pantalla porque cada vez que una regla de dinero se ha copiado a mano en
// dos sitios, ha acabado arreglándose en uno y quedándose mal en el otro.

// Un pago de uno al otro para saldar cuentas. No es un gasto: ese dinero no
// se gasta, cambia de bolsillo. Ajusta quién ha puesto cuánto, pero nunca
// entra en "lo que hemos gastado este mes".
export const esLiquidacion = t => !!t.liquidacion_a

// Quitar los ajustes de cuentas de una lista. Todo lo que sume gastos o
// ingresos tiene que pasar por aquí. La excepción son los saldos de las
// cuentas, donde ese movimiento sí es real y sí cuenta.
export const sinAjustes = ts => ts.filter(t => !esLiquidacion(t))

// Un gasto DE LA CASA: lo ven los dos y además es de los dos. Un apunte con
// a_cargo_de lo ven los dos (lo pagó el otro) pero es de uno solo, así que no
// entra en las cifras de "lo que gastamos entre los dos". Ojo: el cálculo de
// la deuda sí lo incluye, porque ahí es donde tiene que generar la deuda.
export const esDeLaCasa = t => t.comun !== false && !t.a_cargo_de

// Para la copia de seguridad: todo lo que ven los dos, incluidos los apuntes
// a cargo de uno (los ven los dos porque el otro los pagó).
export const soloComunes = ts => ts.filter(t => t.comun !== false)

// Lo personal que ve este móvil es, por fuerza, del que mira: la regla de
// Supabase no deja ver lo personal del otro.
export const soloMios = ts => ts.filter(t => t.comun === false)

// Lo que enseña la pestaña Histórico. Los gastos, solo los de los dos: así
// "Gastos 2026" significa lo mismo en los dos móviles. Los ingresos se dejan
// todos: como son siempre de quien los cobra, son los tuyos.
export const soloConjunto = ts => ts.filter(t => t.tipo === 'ingreso' || esDeLaCasa(t))

// Lo gastado entre los dos en un mes (YYYY-MM). La misma cifra en los dos
// móviles: ni los personales de uno ni los que están a cargo de uno solo.
export function gastoDeLaCasaDelMes(transacciones, mes) {
  return (transacciones || [])
    .filter(t => t.fecha?.startsWith(mes) && t.tipo === 'gasto' && esDeLaCasa(t) && !esLiquidacion(t))
    .reduce((s, t) => s + Number(t.importe), 0)
}
