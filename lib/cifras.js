// Tapar importes en pantallas compartidas (por si hay alguien cerca).
// Cada pantalla decide por su cuenta si mostrarlos, ver page.js.
export function ocultar(mostrar, contenido) {
  return mostrar ? contenido : '••••'
}
