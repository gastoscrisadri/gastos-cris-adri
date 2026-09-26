# Genera Manual_Gastos_Cris_Adri.pdf, el manual para Cris y Adri.
#
# Se ejecuta desde la raíz del proyecto:
#     python3 scripts/generar_manual.py
#
# El PDF sale en la raíz y NO se sube al repositorio (está en .gitignore, y el
# repositorio es público). Este generador sí se guarda, para poder actualizar
# el manual sin reescribirlo entero.
#
# Necesita reportlab:  pip3 install reportlab
# -*- coding: utf-8 -*-

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, PageBreak)

AZUL = colors.HexColor('#0d1b2a')
VERDE = colors.HexColor('#0f766e')
MORADO = colors.HexColor('#7c3aed')
AMBAR = colors.HexColor('#b45309')
GRIS = colors.HexColor('#6b7280')
GRISCLARO = colors.HexColor('#d1d5db')
FONDO = colors.HexColor('#f9fafb')

TITULO = ParagraphStyle('T', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=AZUL, spaceAfter=3)
SUBTIT = ParagraphStyle('ST', fontName='Helvetica', fontSize=10, leading=14, textColor=GRIS, spaceAfter=14)
H2 = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=AZUL, spaceBefore=14, spaceAfter=5)
H3 = ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=10.5, leading=13, textColor=AZUL, spaceBefore=9, spaceAfter=3)
P = ParagraphStyle('P', fontName='Helvetica', fontSize=9.4, leading=13.5, textColor=colors.black, spaceAfter=6)
LI = ParagraphStyle('LI', fontName='Helvetica', fontSize=9.4, leading=13.5, textColor=colors.black,
                    leftIndent=11, bulletIndent=2, spaceAfter=3)
NOTA = ParagraphStyle('N', fontName='Helvetica', fontSize=9, leading=12.5, textColor=colors.black)


def caja(contenido, color_borde, color_fondo):
    t = Table([[contenido]], colWidths=[167 * mm])
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.2, color_borde),
        ('BACKGROUND', (0, 0), (-1, -1), color_fondo),
        ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return KeepTogether([t, Spacer(1, 7)])


def aviso(texto):
    return caja(Paragraph(texto, NOTA), colors.HexColor('#fbbf24'), colors.HexColor('#fffbeb'))


def truco(texto):
    return caja(Paragraph(texto, NOTA), colors.HexColor('#5eead4'), colors.HexColor('#f0fdfa'))


def punto(texto):
    return Paragraph(texto, LI, bulletText='·')


h = []

# ------------------------------------------------------------------ PORTADA
h += [Spacer(1, 30 * mm)]
h += [Paragraph('Gastos de Cris y Adri', TITULO)]
h += [Paragraph('Cómo funciona vuestra app. Cuatro páginas, y os podéis saltar las dos últimas '
                'hasta que haga falta.', SUBTIT)]

h += [Spacer(1, 6)]
h += [Paragraph('Lo esencial, en cinco líneas', H2)]
h += [punto('La app se abre directamente en <b>Nuevo apunte</b>, que es lo que más vais a hacer.')]
h += [punto('Cada gasto es <b>de los dos</b>, <b>solo tuyo</b> o <b>del otro</b> (cuando pagas algo '
            'que es suyo, o él paga algo tuyo). Hay que elegirlo, no viene marcado.')]
h += [punto('<b>Nadie ve los gastos personales del otro.</b> Ni en la lista, ni en los totales.')]
h += [punto('La app lleva la cuenta de <b>quién le debe cuánto a quién</b>, y sabe que el alquiler '
            'no va a medias.')]
h += [punto('Cuando os pongáis al día, <b>se salda y se cierra</b>, y la cuenta empieza de cero.')]

h += [Spacer(1, 10)]
h += [truco('<b>Si algo se ve raro, cerrad la app del todo y volved a abrirla.</b> No basta con salir '
            'a la pantalla de inicio: hay que deslizar hacia arriba y quitarla de las apps abiertas. '
            'El iPhone se guarda la versión anterior y a veces sigue usándola aunque ya haya una '
            'nueva. La mitad de las cosas raras se arreglan así.')]

h += [PageBreak()]

# ------------------------------------------------------- APUNTAR UN GASTO
h += [Paragraph('1. Apuntar un gasto', H2)]

h += [Paragraph('Lo único obligatorio es el <b>importe</b>, la <b>categoría</b>, el <b>medio de pago</b> '
                'y decir <b>de quién es</b>. La fecha viene puesta, vuestro nombre también, y la tarjeta '
                'que usáis normalmente ya viene marcada.', P)]

h += [Paragraph('La tecla para pasar de casilla', H3)]
h += [Paragraph('Para saltar a la casilla siguiente se usa <b>la tecla del teclado que marca una '
                'flecha</b>: la de abajo a la derecha, al lado de la barra espaciadora.', P)]
h += [aviso('<b>No uséis el ✓ que sale en la barra de encima del teclado.</b> Ese solo cierra el '
            'teclado y no os lleva a ninguna parte. Es la primera cosa con la que todo el mundo se '
            'pelea.')]

h += [Paragraph('La foto del ticket', H3)]
h += [Paragraph('El botón verde de arriba abre la cámara. Al hacer la foto, la app lee el ticket y '
                'rellena sola el importe, la fecha y el establecimiento. Repasadlo siempre: acierta '
                'casi todo, pero no siempre.', P)]

h += [Paragraph('¿De quién es este gasto?', H3)]
h += [Paragraph('Es la última pregunta, justo encima de Guardar, y <b>no se puede guardar sin '
                'contestarla</b>. Viene sin marcar a propósito: si viniera marcada "De los dos", un '
                'descuido apuntaría como común algo que es de uno solo, y eso mueve las cuentas sin '
                'que nadie se entere.', P)]

datos = [
    ['De los dos', 'Lo veis los dos y se reparte entre los dos.'],
    ['Solo mío', 'Lo ves solo tú. No entra en la cuenta de los dos.'],
]
t = Table([[Paragraph('<b>' + a + '</b>', NOTA), Paragraph(b, NOTA)] for a, b in datos],
          colWidths=[32 * mm, 135 * mm])
t.setStyle(TableStyle([
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('LINEBELOW', (0, 0), (-1, -2), 0.5, GRISCLARO),
    ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 0),
]))
h += [t, Spacer(1, 8)]

h += [Paragraph('El tercer caso: lo tuyo, pagado por el otro', H3)]
h += [Paragraph('Si marcas <b>Solo mío</b> pero pagas con la tarjeta del otro, la app te avisa y hace '
                'dos cosas: el gasto sigue siendo tuyo entero, y queda apuntado que le debes ese '
                'dinero.', P)]
h += [aviso('<b>Ojo con esto:</b> pagar con la tarjeta del otro significa que el otro <b>va a ver ese '
            'gasto</b>, con su establecimiento y su categoría. Es lógico —lo ha pagado él—, pero si '
            'queréis que algo vuestro quede en privado, pagadlo con vuestra propia tarjeta.')]

h += [PageBreak()]

# ------------------------------------------------------- LA CUENTA DE LOS DOS
h += [Paragraph('2. La cuenta de los dos', H2)]

h += [Paragraph('Está en <b>Balance</b>, la pestaña de abajo. Es la tarjeta oscura que dice quién le debe '
                'cuánto a quién.', P)]

h += [Paragraph('De dónde sale ese número', H3)]
h += [Paragraph('La app mira <b>de quién es la tarjeta con la que se pagó</b>, no quién escribió el '
                'apunte. Si Adri hace la compra y la apunta Cris por la noche, eligiendo la tarjeta de '
                'Adri, la app sabe que el dinero lo puso Adri.', P)]
h += [Paragraph('Y no todo va a medias: el <b>alquiler está repartido según lo que decidisteis</b>, y '
                'cualquier categoría puede tener su propio porcentaje. Se cambia en '
                '<b>Ajustes → Categorías</b>, en el botoncito que hay a la derecha de cada una.', P)]

h += [Paragraph('Saldar', H3)]
h += [Paragraph('Cuando uno le paga al otro, se apunta con el botón <b>Ya le he pagado</b>. Se puede '
                'pagar todo o una parte.', P)]
h += [truco('Ese pago <b>no es un gasto</b>: ese dinero no se gasta, cambia de bolsillo. Por eso no '
            'sube el total del mes. Si alguna vez veis que sí sube, avisad, porque sería un fallo.')]

h += [Paragraph('Cerrar la cuenta', H3)]
h += [Paragraph('Cuando quedéis en paz aparece un botón verde: <b>Cerrar la cuenta y empezar de '
                'cero</b>. A partir de ahí la cuenta solo mira lo apuntado después, y la app dice '
                '"desde el cierre del 3 de octubre" en vez de arrastrar toda la historia.', P)]
h += [Paragraph('Solo se puede cerrar estando en paz, así que no se pierde dinero de nadie. Y si lo '
                'pulsáis sin querer, hay un <b>Deshacer el último cierre</b> justo debajo, en el '
                'Historial.', P)]

h += [Paragraph('El resumen del mes', H3)]
h += [Paragraph('El día 1, al abrir la app, sale una tarjeta con lo que gastasteis el mes anterior, '
                'cuánto puso cada uno y cómo está la cuenta, con los botones para saldar y para '
                'descargar la copia. Sale una sola vez al mes.', P)]

h += [PageBreak()]

# ------------------------------------------------------------- LO IMPORTANTE
h += [Paragraph('3. Dos cosas importantes', H2)]

h += [Paragraph('La copia de seguridad', H3)]
h += [aviso('<b>Esta copia es lo único que os protege. No hay ninguna otra.</b><br/>'
            'Vuestros gastos viven en un servidor gratuito. Ahí <b>nadie guarda una copia por '
            'vosotros</b>: ni el servidor, ni Antonio, ni nadie. Si ese servidor se estropea, se '
            'borra o se cierra, <b>se pierde todo lo que no esté en una copia vuestra</b>, y no hay '
            'forma de recuperarlo. Ni parcialmente, ni pagando, ni pidiéndolo. Nada.')]
h += [Paragraph('No es un descuido: una copia automática y completa tendría que llevar dentro los '
                'gastos personales de los dos, y eso es justo lo que la app evita. Por eso la copia '
                'la hace cada uno, a mano.', P)]
h += [Paragraph('<b>Dónde está:</b> en <b>Informes</b>, abajo del todo, el botón oscuro '
                '<b>«Comparar con otro mes y ver el año»</b>. Se abre y al final están los dos '
                'botones de descarga.', P)]
h += [punto('<b>Copia de los gastos de los dos</b> — <b>es la que vale como copia de seguridad.</b> No '
            'lleva nada personal de nadie, así que os la podéis pasar el uno al otro sin problema.')]
h += [punto('<b>Solo mis apuntes personales</b> — esa es tuya y de nadie más.')]
h += [Spacer(1, 4)]
h += [Paragraph('<b>Hacedla una vez al mes, los dos.</b> La app os lo recuerda, y si pasan dos meses '
                'sin hacerla el aviso se pone rojo. Hacedle caso el mismo día: es un minuto.', P)]
h += [Paragraph('<b>Y guardadla fuera del móvil.</b> Una copia que solo está en el teléfono no sirve '
                'de nada el día que se pierda el teléfono. Mandádsela por correo a vosotros mismos, '
                'o dejadla en Google Drive o iCloud. Con eso ya estáis a salvo.', P)]

h += [Paragraph('Si olvidáis la contraseña', H3)]
h += [Paragraph('En la pantalla de entrada hay un <b>He olvidado mi contraseña</b>. Pone tu correo, te '
                'llega un enlace y pones una nueva. <b>Mirad en la carpeta de spam</b>, que suele caer '
                'ahí.', P)]

h += [Spacer(1, 10)]
h += [Paragraph('4. Cosas que pasarán algún día', H2)]
h += [Paragraph('Nada de esto es un fallo. Son cosas normales de un servicio gratuito, y conviene que '
                'sepáis reconocerlas.', P)]

h += [Paragraph('La app no arranca al volver de un viaje', H3)]
h += [Paragraph('El servidor se apaga solo si nadie entra en <b>7 días</b>. Se vuelve a encender desde '
                'el panel de Supabase, con vuestra cuenta. <b>Truco:</b> si os vais más de una semana, '
                'con que uno abra la app un momento, no pasa.', P)]

h += [Paragraph('La foto del ticket deja de rellenar los campos', H3)]
h += [Paragraph('El lector que usa la app lo retirarán algún día, como pasa con todos. <b>No está '
                'roto, está caducado</b>: avisad y se cambia en cinco minutos.', P)]

h += [Paragraph('Aviso de que se llena el almacén de fotos', H3)]
h += [Paragraph('Caben unas 2.000 fotos de tickets, o sea dos o tres años. La app avisa mucho antes de '
                'llenarse. Entonces hay que decidir: pagar el plan o borrar las fotos de los años '
                'viejos. <b>Los apuntes se quedan siempre</b>, solo desaparecería la foto.', P)]

h += [Spacer(1, 14)]
h += [caja(Paragraph('<b>Y lo más importante:</b> si algo no os cuadra —un número raro, algo que '
                     'desaparece, una pantalla que no responde— <b>decidlo</b>. Casi todos los fallos '
                     'que se han arreglado estas semanas han salido usando la app, no revisando el '
                     'código. Vosotros la vais a usar todos los días; sois los que mejor la vais a '
                     'conocer.', NOTA), GRISCLARO, FONDO)]


def pie(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(GRISCLARO)
    canvas.drawString(20 * mm, 12 * mm, 'Gastos de Cris y Adri · manual')
    canvas.drawRightString(190 * mm, 12 * mm, 'Página %d' % doc.page)
    canvas.restoreState()


doc = BaseDocTemplate('Manual_Gastos_Cris_Adri.pdf', pagesize=A4,
                      leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                      title='Manual de Gastos de Cris y Adri')
doc.addPageTemplates([PageTemplate(
    id='p', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)], onPage=pie)])
doc.build(h)
print('Manual generado')
