#!/bin/bash
# Deja programada la copia de seguridad de la app de gastos para que se haga
# sola el día 1 de cada mes, a las 10:00, en este Mac.
#
# Se ejecuta UNA SOLA VEZ. Después no hay que hacer nada más.
#
#     bash instalar_copia_automatica.sh
#
# Guarda la dirección y la clave en el Llavero de macOS, que es donde el
# sistema guarda las contraseñas. No quedan escritas en ningún archivo.

set -e

SERVICIO="gastos-cris-adri-copia"
ETIQUETA="com.gastoscrisadri.copia"
CARPETA_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# El script se copia fuera de Documentos: macOS protege esa carpeta y una
# tarea automatica no puede leer nada de ahi ("Operation not permitted").
APP="$HOME/Library/Application Support/gastos-cris-adri"
SCRIPT="$APP/copia_seguridad.py"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
REGISTRO="$HOME/Library/Logs/gastos-cris-adri-copia.log"

echo
echo "  Copia de seguridad automática — app de gastos de Cris y Adri"
echo "  ============================================================"
echo

if [ ! -f "$CARPETA_SCRIPT/copia_seguridad.py" ]; then
  echo "  No encuentro copia_seguridad.py. Los dos archivos tienen que estar"
  echo "  en la misma carpeta."
  exit 1
fi

mkdir -p "$APP"
cp "$CARPETA_SCRIPT/copia_seguridad.py" "$SCRIPT"

# ---------------------------------------------------------------- 1. Los datos
echo "  Hacen falta dos datos del panel de Supabase."
echo "  Están en: Project Settings > API Keys"
echo

read -r -p "  Dirección del proyecto (https://....supabase.co): " URL
URL="${URL%/}"

echo
echo "  Ahora la clave SECRETA (la de 'Secret keys', empieza por sb_secret_)."
echo "  No se verá mientras la escribes."
read -r -s -p "  Clave: " CLAVE
echo
echo

if [[ ! "$URL" =~ ^https?:// ]]; then
  echo "  Esa dirección no parece correcta. Vuelve a empezar."
  exit 1
fi
if [[ "$CLAVE" == sb_publishable_* ]]; then
  echo "  Esa es la clave PUBLICABLE y no sirve: haría una copia vacía."
  echo "  Coge la de 'Secret keys', que empieza por sb_secret_"
  exit 1
fi
if [ -z "$CLAVE" ]; then
  echo "  No has escrito ninguna clave."
  exit 1
fi

# ------------------------------------------------- 2. Guardarlos en el Llavero
security add-generic-password -U -s "$SERVICIO" -a "url"   -w "$URL"   >/dev/null
security add-generic-password -U -s "$SERVICIO" -a "clave" -w "$CLAVE" >/dev/null
echo "  ✓ Datos guardados en el Llavero"

# ------------------------------------------------------- 3. Probar que funciona
echo "  Probando que funciona..."
echo
if ! /usr/bin/python3 "$SCRIPT"; then
  echo
  echo "  La prueba ha fallado. No se ha programado nada."
  echo "  Revisa la clave y vuelve a ejecutar este instalador."
  security delete-generic-password -s "$SERVICIO" -a "url"   >/dev/null 2>&1 || true
  security delete-generic-password -s "$SERVICIO" -a "clave" >/dev/null 2>&1 || true
  exit 1
fi

# ------------------------------------------------------------ 4. Programarla
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLISTFIN
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>$SCRIPT</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Day</key><integer>1</integer>
    <key>Hour</key><integer>10</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>$REGISTRO</string>
  <key>StandardErrorPath</key><string>$REGISTRO</string>
</dict>
</plist>
PLISTFIN

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo
echo "  ============================================================"
echo "  ✓ LISTO"
echo
echo "  La copia se hará sola el día 1 de cada mes a las 10:00."
echo "  Si el Mac está apagado a esa hora, se hace al encenderlo."
echo
echo "  Las copias van a:"
echo "     Documentos > Copias Gastos Cris y Adri"
echo
echo "  Si alguna vez quieres hacer una a mano, ya no pedirá la clave:"
echo "     python3 $SCRIPT"
echo
echo "  Para dejar de hacerlas solas:"
echo "     launchctl unload $PLIST"
echo "  ============================================================"
echo
