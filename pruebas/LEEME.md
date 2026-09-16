# Pruebas de las cuentas

Comprueban con números que la lógica del dinero da lo que debe. No sustituyen
a probar la app en el móvil: comprueban los cálculos, no las pantallas.

Se ejecutan desde la raíz del proyecto:

    node pruebas/cuentas.mjs

Si algo sale mal, imprime qué esperaba y qué ha salido, y termina con error.

Las cifras de referencia son las que Antonio verificó a mano en el móvil:
el alquiler del 09/09 (466,67 €), la ronda completa del 14/09 (356,67 €) y
el saldado (0,00 €). Si alguna de esas cambia, algo se ha roto.
