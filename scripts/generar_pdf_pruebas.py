# Genera Pruebas_app_gastos.pdf, la lista de pruebas para pasar en el móvil.
#
# Se ejecuta desde la raíz del proyecto:
#     python3 scripts/generar_pdf_pruebas.py
#
# El PDF sale en la raíz y NO se sube al repositorio (está en .gitignore, y el
# repositorio es público). Este generador sí se guarda, para no tener que
# reescribir las 45 pruebas cada vez que haya que actualizar una.
#
# Marca hecho=True en las pruebas ya pasadas; critico=True pone el borde naranja.
#
# Necesita reportlab:  pip3 install reportlab

# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether)

AZUL = colors.HexColor('#0d1b2a'); NARANJA = colors.HexColor('#f97316')
GRIS = colors.HexColor('#6b7280'); GRISCLARO = colors.HexColor('#d1d5db')
VERDE = colors.HexColor('#0f766e')

H1 = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=17, leading=21, textColor=AZUL, spaceAfter=4)
INTRO = ParagraphStyle('I', fontName='Helvetica', fontSize=8.6, leading=12, textColor=GRIS, spaceAfter=10)
SEC = ParagraphStyle('S', fontName='Helvetica-Bold', fontSize=10.5, leading=13, textColor=AZUL, spaceBefore=9, spaceAfter=1)
SUB = ParagraphStyle('Su', fontName='Helvetica-Oblique', fontSize=8, leading=10, textColor=GRIS, spaceAfter=4)
PASO = ParagraphStyle('P', fontName='Helvetica', fontSize=8.6, leading=11.4, textColor=colors.black)
OK = ParagraphStyle('O', fontName='Helvetica-Bold', fontSize=8.4, leading=11, textColor=VERDE)
NOTA = ParagraphStyle('N', fontName='Helvetica-Oblique', fontSize=7.6, leading=9.6, textColor=GRIS)
FIN = ParagraphStyle('F', fontName='Helvetica', fontSize=8.4, leading=11.4, textColor=colors.black)

n = [0]
def paso(txt, esperado, nota=None, critico=False, hecho=False):
    n[0] += 1
    dentro = [Paragraph('<b>%d.</b> %s' % (n[0], txt), PASO), Spacer(1, 1.6),
              Paragraph('&rarr; %s' % esperado, OK)]
    if nota: dentro += [Spacer(1, 1.6), Paragraph(nota, NOTA)]
    marca = '☑' if hecho else '☐'
    color = VERDE if hecho else (NARANJA if critico else GRISCLARO)
    t = Table([[marca, dentro]], colWidths=[9*mm, 158*mm])
    t.setStyle(TableStyle([
        ('VALIGN',(0,0),(-1,-1),'TOP'), ('FONTNAME',(0,0),(0,0),'Helvetica'),
        ('FONTSIZE',(0,0),(0,0),12), ('TEXTCOLOR',(0,0),(0,0),color),
        ('LEFTPADDING',(0,0),(-1,-1),3), ('RIGHTPADDING',(0,0),(-1,-1),3),
        ('TOPPADDING',(0,0),(-1,-1),3.5), ('BOTTOMPADDING',(0,0),(-1,-1),3.5),
        ('LINEBEFORE',(0,0),(0,0),2.2, NARANJA if critico and not hecho else colors.white),
    ]))
    return [t, Spacer(1, 1.5)]

def seccion(t, s): return [Paragraph(t, SEC), Paragraph(s, SUB)]

h = [Paragraph('Qué probar antes de octubre', H1),
     Paragraph('Las pruebas con el <b>borde naranja</b> son las críticas: si fallan, hay que arreglarlo antes de que Cris y '
               'Adri empiecen con datos reales. Las que ya llevan la casilla marcada (☑) las pasaste el 14 de septiembre '
               'y no hace falta repetirlas — salvo las de la sección PRIMERO, que conviene rehacer porque después se ha '
               'tocado bastante. Dime solo las que fallen.', INTRO)]

h += seccion('PRIMERO · Que no se haya roto nada', 'Repetir estas: desde que las hiciste se han cambiado muchas cosas.')
h += paso('Entra en la app y mira la lista de gastos.', 'Se ven los apuntes de siempre, con sus importes.',
          'Si aparece vacía, avísame: sería cosa de las reglas de privacidad.')
h += paso('Haz una foto de un ticket y espera a que lo lea.', 'Rellena importe, fecha y establecimiento él solo.')
h += paso('Abre un gasto que tenga foto.', 'La foto se ve.')

h += seccion('SEGUNDO · Los gastos fijos ya no se repiten', 'Era el fallo del 8 de septiembre.')
h += paso('Cierra la app del todo, ábrela, y vuelve a cerrarla y abrirla.', 'El gasto fijo NO aparece dos veces más.', hecho=True)
h += paso('Busca en la lista el gasto fijo del día 3 (el alquiler).', 'Sale una sola vez este mes.', hecho=True)

h += seccion('TERCERO · Lo personal es de verdad personal', 'Con Cris en el iPhone y Adri en el Mac.')
h += paso('Con Cris: crea un gasto «Solo mío». Establecimiento: PRUEBA CRIS.', 'Cris lo ve, con la etiqueta «personal».', hecho=True)
h += paso('Con Adri: recarga y busca PRUEBA CRIS.', 'No aparece por ningún lado.', hecho=True)
h += paso('Con Adri: Informes, y mira el gasto conjunto del mes.', 'Ese importe NO está sumado.', hecho=True)
h += paso('Al revés: un gasto «Solo mío» de Adri, buscado con Cris.', 'Tampoco aparece.', hecho=True)
h += paso('Con cualquiera: crea un gasto «De los dos».', 'Lo ven los dos.', hecho=True)

h += seccion('CUARTO · La cuenta de los dos', 'Informes → pestaña NOSOTROS, la tarjeta oscura.')
h += paso('Mira quién debe a quién y cuánto ha puesto cada uno.', 'Los números cuadran con lo apuntado.', hecho=True)
h += paso('Comprueba que los gastos «Solo mío» no han movido esa cuenta.', 'Solo cuentan los «de los dos».', hecho=True)
h += paso('Cambia de mes arriba, en el selector.', 'La cuenta de los dos NO cambia: es acumulada, no del mes.',
          'El resto de la pantalla sí cambia. Esa tarjeta es la única que no se mueve.', hecho=True)

h += seccion('QUINTO · Saldar la cuenta', 'Que un pago entre vosotros ajuste sin inflar el gasto.')
h += paso('APUNTA ANTES el gasto conjunto del mes. Pulsa «Ya le he pagado», mete la mitad de la deuda y guarda.',
          'La deuda baja a la mitad y el gasto conjunto SIGUE SIENDO EL MISMO.', critico=True, hecho=True)
h += paso('Vuelve a la pantalla principal y mira el balance de la cabecera.', 'Tampoco ha subido por ese pago.', hecho=True)
h += paso('Busca ese pago en la lista de apuntes.', 'Sale con la etiqueta «ajuste de cuentas», y lo veis los dos.', hecho=True)

h += seccion('SEXTO · El reparto y las categorías', 'Los dos arreglos del 8 de septiembre en Ajustes.')
h += paso('Ajustes → Categorías → entra en Vivienda y añádele una subcategoría.', 'Deja añadirla.', hecho=True)
h += paso('Ponle a esa subcategoría un reparto distinto, tocando su botoncito.', 'Se guarda y la cuenta de los dos cambia.', hecho=True)

h += seccion('SÉPTIMO · Los ingresos', 'Un ingreso es siempre de quien lo cobra. Ni se reparte ni lo ve el otro.')
h += paso('Empieza un apunte y pulsa «Ingreso» arriba.', 'Los botones «De los dos / Solo mío» DESAPARECEN.')
h += paso('Guarda un ingreso y búscalo en la lista.', 'Sale con la etiqueta «personal».')
h += paso('Entra con la otra cuenta y busca ese ingreso.', 'No aparece por ningún lado.', critico=True)

h += seccion('OCTAVO · Informes, las tres pestañas', 'Informes se ha partido en Mes / Nosotros / Histórico.')
h += paso('Entra en Informes.',
          'De arriba abajo: el selector de mes con sus flechas; dos tarjetas, «Gasto conjunto del mes» (roja) y «La cuenta de los dos» (azul oscura); y debajo la barra azul con Mes · Nosotros · Histórico.')
h += paso('Pulsa las tres pestañas, una por una.', 'Ninguna sale en blanco ni da error.')
h += paso('Mira «Gasto conjunto del mes» con las dos cuentas.', 'Sale el MISMO número en los dos móviles.', critico=True)
h += paso('Informes → Mes, arriba del todo.',
          'Ya NO están las tarjetitas de «Saldo actual de cuentas». Ese dato sigue en Ajustes → Cuentas.')

h += seccion('NOVENO · El filtro De los dos / Lo mío', 'En la pestaña Mes, bajo «Qué gastos estás viendo».')
h += paso('Mira los botones y en cuál arranca.', 'Hay DOS, «De los dos» y «Lo mío», y arranca en «De los dos». El antiguo «Todo» ya no está.')
h += paso('Con «De los dos»: mira el alquiler en la lista de categorías.', 'Sale entero, 1.400,00 €.')
h += paso('Pulsa «Lo mío» con la cuenta de Cris.', 'El alquiler pasa a SU PARTE, unos 466,67 €.',
          'Debajo de los botones sale la línea que lo explica.', critico=True)
h += paso('Baja del todo, pasada la tarta y la lista de categorías.',
          'Está «Lo que te queda a ti este mes», con la explicación debajo. Se ve con los dos botones.')

h += seccion('DÉCIMO · Los números que estaban mal', 'Los fallos que encontraste tú usando la app.')
h += paso('Pantalla de inicio, con Cris: mira el balance de la cabecera.',
          'Sus ingresos menos SU PARTE de los gastos. Con nómina de 2.000 y alquiler de 1.400 al 33%, +1.533,33 €, no +600,00 €.', critico=True)
h += paso('Informes → Histórico → tarjeta «Gastos de los dos 2026».',
          'Solo los gastos de los dos. Con un alquiler de 1.400 y un ajuste de 466,67, debe poner 1.400,00 €.', critico=True)
h += paso('Busca el ajuste de cuentas en la lista, con las DOS cuentas.',
          'Al que pagó: «Le pagaste a …», en rojo. Al que cobró: «… te pagó», en VERDE y con +.', critico=True)

h += seccion('UNDÉCIMO · La tarjeta «Quién puso el dinero de los dos»', 'Informes → Nosotros. Tenía tres cosas mal.')
h += paso('Despliégala y suma a mano lo que veas en la lista.', 'La suma da EXACTAMENTE el total de arriba.',
          'Antes arriba ponía 1.510,00 y la lista sumaba 1.976,67.', critico=True)
h += paso('En esa lista, busca el ajuste de cuentas y los gastos personales.',
          'No está ninguno de los dos: esta tarjeta solo cuenta los gastos de los dos.')
h += paso('Comprueba que cuadra con la tarjeta de la deuda, justo encima.', 'Los dos hablan del mismo dinero.')

h += seccion('DUODÉCIMO · El reparto, ahora con botón', 'Ajustes → Categorías, el botoncito del porcentaje.')
h += paso('Ábrelo en una subcategoría y escribe 66,6667 con coma.',
          'Deja escribir la coma y los decimales, y hay un botón «Guardar».',
          'Antes la coma se borraba sola al teclearla: era imposible poner decimales.', critico=True)
h += paso('Dale a Guardar.', 'Sale «Guardado ✓» y debajo dice cuánto le toca al otro. Cierra, vuelve a abrir: sigue ahí.')
h += paso('Prueba a escribir 150, o letras, o dejarlo vacío.', 'La casilla se pone roja y el botón Guardar se apaga.')

h += seccion('DECIMOTERCERO · Detalles y exportación', 'Formato de las cifras, etiquetas y copias de seguridad.')
h += paso('Mira cualquier importe de cuatro cifras en la app.', 'Sale como 1.400,00 € : punto de miles y coma de decimales.')
h += paso('En la lista de apuntes, mira las etiquetas de cada línea.', 'TODOS dicen si son «de los dos», «personal» o «ajuste de cuentas».')
h += paso('Abre un apunte y baja hasta «De quién es».', 'Lo dice también ahí.')
h += paso('Abre un apunte nuevo y mira cuánto se ve sin hacer scroll.',
          'Se llega casi hasta el botón de guardar. Y hay un «Más detalles ▾» que abre las Notas.')
h += paso('Informes → Histórico → abajo. Pulsa «Copia de los gastos de los dos (Excel)» y abre el archivo.',
          'NO aparece ningún gasto personal, ni tuyo ni del otro.', critico=True)
h += paso('Pulsa «Solo mis apuntes personales (Excel)» y abre el archivo.', 'Salen solo los tuyos.')
h += paso('Abre los dos con LibreOffice y mira la columna del importe.',
          'Son .xlsx. Salen como 1.400,00 con punto de miles y DOS decimales siempre, aunque sean ,00. Y son números: selecciona la columna y abajo te da la suma.', critico=True)

CT = ParagraphStyle('CT', fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=AZUL, spaceAfter=4)
CP = ParagraphStyle('CP', fontName='Helvetica', fontSize=8.4, leading=11.4, textColor=colors.black, spaceAfter=5)
pend = [Paragraph('Lo que queda por hacer (esto es para mí, no hay que probarlo)', CT),
    Paragraph('<b>1. Unificar la regla del reparto.</b> El cálculo de la deuda tiene su propia copia, aparte de '
              'lib/reparto.js. Es el mismo tipo de duplicado que ya ha causado varios fallos: la regla estaba copiada en '
              'cada pantalla, se arregló en Informes y la portada se quedó mal. Cuando estas pruebas estén pasadas y la '
              'app estable, se unifica en un cambio pequeño y aislado.', CP),
    Paragraph('<b>2. El manual</b> para Cris y Adri. Tiene que explicar las flechas ⌃⌄ del teclado del iPhone para saltar '
              'de campo (el ✓ no sirve), y que nadie ve los gastos personales del otro.', CP),
    Paragraph('<b>3. El rediseño.</b> Las tres propuestas no convencieron, hay que dar otra vuelta.', CP),
    Paragraph('<b>4. Vaciar los datos de prueba</b> antes de octubre, y que cada uno cambie su contraseña.', CP)]
caja = Table([[pend]], colWidths=[167*mm])
caja.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.8,GRISCLARO), ('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#f9fafb')),
    ('LEFTPADDING',(0,0),(-1,-1),8), ('RIGHTPADDING',(0,0),(-1,-1),8),
    ('TOPPADDING',(0,0),(-1,-1),8), ('BOTTOMPADDING',(0,0),(-1,-1),6)]))

h += [Spacer(1,8), Paragraph('Cuando termines', SEC)]
h += [Paragraph('Con decirme cuáles fallan me vale — de las que van bien no hace falta que digas nada.', FIN), Spacer(1,3)]
h += [Paragraph('Y si te encuentras cualquier otra cosa rara, cuéntamela aunque no esté en la lista: '
                '<b>todos los fallos de estos días los has encontrado tú usando la app, no yo revisando el código.</b>', FIN)]
h += [Spacer(1,10), KeepTogether(caja)]

def pie(c, d):
    c.saveState(); c.setFont('Helvetica',7); c.setFillColor(GRISCLARO)
    c.drawString(20*mm, 12*mm, 'Gastos Cris y Adri · pruebas al 14 de septiembre de 2026')
    c.drawRightString(190*mm, 12*mm, 'Página %d' % d.page); c.restoreState()

doc = BaseDocTemplate('Pruebas_app_gastos.pdf', pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                      topMargin=16*mm, bottomMargin=18*mm, title='Pruebas app gastos Cris y Adri')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)], onPage=pie)])
doc.build(h)
print('PDF hecho con', n[0], 'pruebas')
