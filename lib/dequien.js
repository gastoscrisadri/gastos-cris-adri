// De quién es un gasto, quién carga con él y quién puede verlo.
//
// La regla, tal como la fijó Antonio el 26/09/2026:
//
//     "Ves todo, MENOS lo que es del otro Y lo paga el otro."
//
// O sea que lo único privado de verdad es lo que no te toca por ningún lado:
// ni es tuyo ni has puesto el dinero. En cuanto el otro paga algo tuyo, o tú
// pagas algo suyo, los dos lo veis — si no, se le podría cargar dinero a
// alguien sin que pudiera ver de qué.
//
// Vive aquí y no dentro del formulario porque decide tres cosas que luego usa
// media app: quién ve el apunte, quién carga con él y si entra en la cuenta de
// los dos. Una regla de dinero escrita dentro de una pantalla acaba
// divergiendo de su gemela; en este proyecto ya ha pasado cinco veces.

import { NOMBRES } from '@/lib/identidad'

/**
 * Qué se guarda en la base de datos, a partir de lo marcado en el formulario.
 *
 * @param deQuien       'dos' | 'mio' | 'otro'
 * @param quien         quién registra el apunte ('Cris' | 'Adri')
 * @param duenoDelMedio de quién es la tarjeta o cuenta con la que se paga
 *                      ('Cris' | 'Adri' | 'Común' | 'Sin asignar')
 * @param tipo          'gasto' | 'ingreso'
 * @returns { comun, a_cargo_de, duenoDelGasto }
 *          duenoDelGasto es a nombre de quién hay que guardarlo cuando es
 *          privado; null cuando lo ven los dos.
 */
export function comunYCargo(deQuien, quien, duenoDelMedio, tipo = 'gasto') {
  // Un ingreso es siempre de quien lo cobra: ni se pregunta ni se reparte.
  if (tipo === 'ingreso') return { comun: false, a_cargo_de: null, duenoDelGasto: quien }

  const elOtro = NOMBRES.find(n => n !== quien) || null
  const quienPaga = NOMBRES.includes(duenoDelMedio) ? duenoDelMedio : null

  // De quién es el gasto. null = de los dos.
  const dueno = deQuien === 'dos' ? null : (deQuien === 'mio' ? quien : elOtro)

  // Privado de verdad: es de uno Y lo paga esa misma persona. Si lo paga el
  // otro, o sale de una cuenta común, hay dinero de por medio que no es suyo
  // y el apunte deja de ser privado.
  const esPrivado = !!dueno && quienPaga === dueno

  return {
    comun: !esPrivado,
    // Solo se marca a cargo de alguien cuando además lo ven los dos: es lo que
    // hace que la cuenta sepa que ese gasto no se reparte, sino que es de uno.
    a_cargo_de: esPrivado || deQuien === 'dos' ? null : dueno,
    duenoDelGasto: esPrivado ? dueno : null,
  }
}

/** ¿Solo lo verá su dueño? */
export function esGastoPrivado(deQuien, quien, duenoDelMedio) {
  return !!comunYCargo(deQuien, quien, duenoDelMedio).duenoDelGasto
}
