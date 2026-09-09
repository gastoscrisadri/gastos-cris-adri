// Tapar importes en pantallas compartidas (por si hay alguien cerca).
// Cada pantalla decide por su cuenta si mostrarlos, ver page.js.
export function ocultar(mostrar, contenido) {
  return mostrar ? contenido : '••••'
}

// Formato español para el dinero: punto de miles, coma de decimales.
// Lo hace el navegador, no reglas a mano: 1234.5 → "1.234,50".
// OJO: no usar en el CSV que se exporta. Ahí los miles con punto rompen
// la lectura en Excel/LibreOffice; ese sitio tiene su propio formato.
export function euros(n) {
  return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })
}

// La misma idea pero sin decimales, para las tablas apretadas.
export function euros0(n) {
  return Number(n).toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })
}
