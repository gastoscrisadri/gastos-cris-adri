# Copia de seguridad de la app de gastos

Supabase, en el plan gratuito, **no hace copias automáticas**. La única copia
que existe es la que hagáis vosotros con esto.

Las copias se guardan en **tu carpeta personal → Copias Gastos Cris y Adri**, una carpeta
por fecha, con los apuntes, las categorías, las cuentas, las fotos de los tickets
y un Excel para poder leerlo todo.

---

## Opción recomendada: que se haga sola

Se configura **una sola vez** y a partir de ahí se hace sola el día 1 de cada
mes. Si el Mac está apagado a esa hora, se hace al encenderlo.

1. Descargad los **dos** archivos y dejadlos juntos en la misma carpeta
   (por ejemplo, en Descargas):
   - `copia_seguridad.py`
   - `instalar_copia_automatica.sh`

2. Abrid la aplicación **Terminal** (está en Aplicaciones → Utilidades, o
   buscadla con la lupa escribiendo "Terminal").

3. Escribid esto y pulsad Enter:

   ```
   bash ~/Downloads/instalar_copia_automatica.sh
   ```

4. Os pedirá dos datos del panel de Supabase, en **Project Settings → API Keys**:
   - la **Project URL**
   - la clave de **Secret keys**, la que empieza por `sb_secret_`

   La clave no se ve mientras se escribe. Se guarda en el **Llavero** de macOS,
   que es donde el sistema guarda las contraseñas, y no queda escrita en ningún
   archivo.

5. Hará una copia de prueba ahí mismo. Si sale bien, queda programada. Si falla,
   no programa nada y borra los datos guardados, para que lo intentéis de nuevo.

Para dejar de hacerlas solas, en la Terminal:

```
launchctl unload ~/Library/LaunchAgents/com.gastoscrisadri.copia.plist
```

---

## Opción sencilla: hacer una copia a mano

Si preferís no programar nada, o queréis una copia puntual antes de tocar algo:

```
python3 ~/Downloads/copia_seguridad.py
```

Pedirá la dirección y la clave cada vez. Si ya hicisteis la instalación de
arriba, no las pedirá: las coge del Llavero.

---

## Cosas que conviene saber

- **La clave secreta da acceso completo a vuestros datos.** No la compartáis con
  nadie ni la peguéis en GitHub, que en este proyecto es público.
- Si os equivocáis y ponéis la clave **publicable** en vez de la secreta, el
  script lo detecta y no continúa. Antes no era así: descargaba una copia vacía
  y decía que todo había ido bien.
- Al terminar os dice cuántos apuntes y cuántas fotos ha guardado. Si alguna
  foto no se pudiera descargar, os avisa y da error.
