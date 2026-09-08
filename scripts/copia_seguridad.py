#!/usr/bin/env python3
"""Copia de seguridad de la app de gastos de Cris y Adri.

QUÉ HACE
    Descarga TODO lo que hay en Supabase y lo guarda en el ordenador:
    los apuntes, las categorías, las cuentas, los eventos, los gastos fijos
    y las fotos de los tickets.

CÓMO SE USA
    1. Abre la aplicación "Terminal" (está en Aplicaciones > Utilidades,
       o búscala con la lupa escribiendo "Terminal").
    2. Escribe esto y pulsa Enter:

           python3 ~/Downloads/copia_seguridad.py

       (si guardaste el archivo en otro sitio, cambia la ruta)
    3. Te pedirá la dirección del proyecto y la clave secreta. Se copian
       del panel de Supabase, en Project Settings > API Keys:
         - la dirección es la "Project URL"
         - la clave es la SECRETA (sb_secret_...), no la publicable

DÓNDE LO GUARDA
    En ~/Copias Gastos Cris y Adri/ (en tu carpeta personal)
      <fecha>/datos/*.json   las tablas completas
      <fecha>/Copia_...xlsx  lo mismo en Excel, para poder leerlo
      fotos/                 las fotos, compartidas entre copias

    Cada copia va en su propia carpeta por fecha, así que se acumulan y
    nunca se pisa una copia anterior.

IMPORTANTE
    La clave secreta da acceso completo a vuestros datos. No la compartáis
    con nadie ni la guardéis en el repositorio de GitHub, que es público.
    Este script no la guarda en ningún sitio: la pide cada vez.
"""
import json, os, sys, datetime, getpass, urllib.request, urllib.error

# Fuera de Documentos a proposito: macOS protege esa carpeta y la tarea
# automatica no puede escribir alli.
DESTINO = os.path.expanduser("~/Copias Gastos Cris y Adri")

# Las cinco tablas de esta app. Si algún día se añade otra, ponerla aquí.
TABLAS = ["transacciones", "categorias", "cuentas", "eventos", "apuntes_recurrentes"]


def credenciales():
    """Del .env.local si existe (para quien tenga el repo), y si no, preguntando."""
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ruta_env = os.path.join(raiz, ".env.local")
    if os.path.exists(ruta_env):
        env = {}
        with open(ruta_env) as f:
            for linea in f:
                if "=" in linea and not linea.strip().startswith("#"):
                    k, v = linea.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
        url = next((v for k, v in env.items() if "SUPABASE_URL" in k), None)
        key = next((v for k, v in env.items() if "SERVICE_ROLE" in k or "SECRET" in k), None)
        if url and key:
            print("Usando los datos de .env.local\n")
            return url.rstrip("/"), key

    # Del Llavero de macOS, que es donde los deja el instalador de la copia
    # automática. Así puede ejecutarse sola, sin nadie delante y sin dejar la
    # clave escrita en ningún archivo.
    del_llavero = leer_llavero()
    if del_llavero:
        print("Usando los datos guardados en el Llavero\n")
        return del_llavero

    if not sys.stdin.isatty():
        print("No hay datos guardados y no hay nadie para escribirlos.")
        print("Ejecuta primero: bash scripts/instalar_copia_automatica.sh")
        sys.exit(1)

    print("Hacen falta dos datos del panel de Supabase (Project Settings > API Keys).\n")
    url = input("Dirección del proyecto (https://....supabase.co): ").strip().rstrip("/")
    key = getpass.getpass("Clave SECRETA (sb_secret_... — no se verá al escribirla): ").strip()
    print()
    if not url.startswith("http") or not key:
        print("Faltan datos. Vuelve a intentarlo.")
        sys.exit(1)
    comprobar_clave(key)
    return url, key


SERVICIO_LLAVERO = "gastos-cris-adri-copia"


def leer_llavero():
    """La dirección y la clave guardadas en el Llavero, o None si no están."""
    import subprocess
    def buscar(cuenta):
        try:
            r = subprocess.run(
                ["security", "find-generic-password", "-s", SERVICIO_LLAVERO,
                 "-a", cuenta, "-w"],
                capture_output=True, text=True, timeout=15)
            return r.stdout.strip() if r.returncode == 0 else None
        except Exception:
            return None
    url, key = buscar("url"), buscar("clave")
    return (url.rstrip("/"), key) if url and key else None


def comprobar_clave(key):
    """Con la clave publicable no da error: devuelve cero filas porque las
    reglas de seguridad se lo impiden. Es decir, saldría una copia VACÍA que
    parecería correcta. Por eso se rechaza antes de empezar."""
    if key.startswith("sb_publishable_") or key.startswith("sb_anon_"):
        print("Esa es la clave PUBLICABLE, no sirve para la copia de seguridad:")
        print("no da error, pero descargaría una copia vacía.")
        print("Coge la de la sección 'Secret keys', la que empieza por sb_secret_")
        sys.exit(1)
    es_secreta = key.startswith("sb_secret_")
    es_jwt_servicio = key.startswith("eyJ") and "service_role" in _cuerpo_jwt(key)
    if not (es_secreta or es_jwt_servicio):
        print("Esa clave no parece la secreta (debería empezar por sb_secret_).")
        if input("¿Seguir de todas formas? (s/n): ").strip().lower() != "s":
            sys.exit(1)


def _cuerpo_jwt(token):
    """El contenido legible de un token clásico, para ver si es de servicio."""
    import base64
    try:
        trozo = token.split(".")[1]
        trozo += "=" * (-len(trozo) % 4)
        return base64.urlsafe_b64decode(trozo).decode("utf-8", "ignore")
    except Exception:
        return ""


def pedir(url, key, ruta, metodo="GET", cuerpo=None, timeout=60):
    req = urllib.request.Request(url + ruta, method=metodo,
                                 data=json.dumps(cuerpo).encode() if cuerpo else None)
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    if cuerpo:
        req.add_header("content-type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def main():
    url, key = credenciales()
    hoy = datetime.date.today().isoformat()
    carpeta = os.path.join(DESTINO, hoy)
    os.makedirs(os.path.join(carpeta, "datos"), exist_ok=True)
    fotos_dir = os.path.join(DESTINO, "fotos")
    os.makedirs(fotos_dir, exist_ok=True)

    print(f"Copia de seguridad -> {carpeta}\n")

    # 1. Las tablas
    for t in TABLAS:
        try:
            datos = json.loads(pedir(url, key, f"/rest/v1/{t}?select=*"))
        except urllib.error.HTTPError as e:
            print(f"  !! ERROR en la tabla {t}: {e.code} {e.reason}")
            if e.code in (401, 403):
                print("     La clave no es la correcta: hace falta la SECRETA, no la publicable.")
            sys.exit(1)
        except Exception as e:
            print(f"  !! ERROR en la tabla {t}: {e}")
            sys.exit(1)
        with open(os.path.join(carpeta, "datos", f"{t}.json"), "w") as f:
            json.dump(datos, f, ensure_ascii=False, indent=1)
        print(f"  {t:<22} {len(datos):>5} registros")
        # Las categorías y las cuentas nunca están vacías: si salen a cero es
        # que la clave no tiene permiso, aunque no haya dado ningún error.
        if t in ("categorias", "cuentas") and len(datos) == 0:
            print(f"\n  !! La tabla {t} ha salido VACÍA, y eso no puede ser.")
            print("     Seguramente la clave no es la secreta. La copia NO es válida.")
            sys.exit(1)

    # 2. Las fotos que aún no estén copiadas.
    #    Se bajan por la ruta autenticada, no por la pública: así sigue
    #    funcionando cuando el almacén pase a ser privado.
    lista = json.loads(pedir(url, key, "/storage/v1/object/list/documentos", "POST",
                             {"limit": 1000, "prefix": ""}))
    nuevas, fallidas = 0, []
    for obj in lista:
        nombre = obj["name"]
        destino = os.path.join(fotos_dir, nombre)
        if os.path.exists(destino):
            continue
        try:
            contenido = pedir(url, key, f"/storage/v1/object/documentos/{nombre}", timeout=120)
            with open(destino, "wb") as f:
                f.write(contenido)
            nuevas += 1
        except Exception as e:
            fallidas.append(nombre)
            print(f"  !! No se pudo bajar la foto {nombre}: {e}")
    print(f"\n  Fotos en Supabase: {len(lista)}   nuevas descargadas: {nuevas}   "
          f"total guardadas: {len(os.listdir(fotos_dir))}")

    # 3. El mismo contenido en Excel, para poder leerlo sin ser informático
    try:
        import openpyxl
        from openpyxl.styles import Font
        wb = openpyxl.Workbook(); wb.remove(wb.active)
        for t in TABLAS:
            d = json.load(open(os.path.join(carpeta, "datos", f"{t}.json")))
            if not d:
                continue
            ws = wb.create_sheet(t[:31]); cols = list(d[0].keys()); ws.append(cols)
            for c in ws[1]:
                c.font = Font(bold=True)
            for r in d:
                ws.append([json.dumps(r[c], ensure_ascii=False) if isinstance(r.get(c), (dict, list))
                           else r.get(c) for c in cols])
            for i, c in enumerate(cols, 1):
                ancho = max([len(str(c))] + [len(str(r.get(c) or "")) for r in d])
                ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = min(max(ancho + 2, 10), 45)
            ws.freeze_panes = "A2"; ws.sheet_view.zoomScale = 60
        wb.save(os.path.join(carpeta, f"Copia_Gastos_{hoy}.xlsx"))
        print(f"  Excel creado: Copia_Gastos_{hoy}.xlsx")
    except ImportError:
        print("  (Sin Excel: no está instalado openpyxl. Los datos están completos en los .json)")

    # 4. Comprobación final: que no falte ninguna foto de las que usan los apuntes
    tr = json.load(open(os.path.join(carpeta, "datos", "transacciones.json")))
    con_foto = [r["imagen_url"].split("/documentos/")[-1].split("?")[0]
                for r in tr if r.get("imagen_url")]
    faltan = [n for n in con_foto if not os.path.exists(os.path.join(fotos_dir, n))]
    print(f"\n  COMPROBACION: {len(tr)} apuntes, {len(con_foto)} con foto, "
          f"{len(faltan)} fotos sin copia")
    if faltan:
        print(f"  >>> OJO, faltan estas fotos: {faltan[:5]}")
        sys.exit(1)
    print("  >>> COPIA CORRECTA")


if __name__ == "__main__":
    main()
