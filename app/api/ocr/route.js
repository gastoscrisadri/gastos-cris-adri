import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Reintentos cuando Gemini está saturado.
//
// Gemini responde 503 "high demand" de vez en cuando. Antes eso se devolvía a
// la primera y la foto se perdía. Un 503 es pasajero: reintentar arregla la
// mayoría.
//
// EL PRESUPUESTO DE TIEMPO MANDA. Vercel corta la función a los 60 s, pero el
// móvil se rinde antes, a los 55 (ver FormTransaccion). Así que el límite real
// son 55 y aquí nos quedamos en 50, para devolver un error limpio en vez de
// que nos corten a media respuesta.
//
// Medido el 25/09/2026 contra la API de verdad:
//   principal (3.1-flash-lite) .... 3,3 / 7,9 / 3,5 s
//   reserva   (3.5-flash-lite) .... 14,9 / 23,2 / 23,6 s
// La reserva es TRES VECES más lenta, así que no caben cuatro llamadas. Por
// eso el tiempo de cada una no va fijo: se calcula con lo que queda, y si no
// llega para la reserva, no se lanza.
const MODELO_PRINCIPAL = 'gemini-3.1-flash-lite'
const MODELO_RESERVA = 'gemini-3.5-flash-lite'   // comprobado que existe con esta clave
const PRESUPUESTO_MS = 50_000
const TOPE_PRINCIPAL_MS = 12_000   // el principal contesta en 3-8 s; 12 es de sobra
const TOPE_RESERVA_MS = 30_000     // la reserva necesita más de 20: probando, 20 la cortaba
const MINIMO_RESERVA_MS = 22_000   // con menos de esto no merece la pena ni empezarla
const ESPERA_ENTRE_INTENTOS_MS = 2_000

const esperar = ms => new Promise(r => setTimeout(r, ms))

// Una llamada a Gemini con su propio límite de tiempo. "Tarda demasiado" se
// trata igual que un 503: para quien espera con el móvil en la mano es lo
// mismo, y pide la misma reacción.
async function llamarAGemini(modelo, cuerpo, tope) {
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), tope)
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: control.signal,
      }
    )
    return { ok: r.ok, status: r.status, respuesta: r }
  } catch (e) {
    // Abortado por el reloj, o la red falló
    return { ok: false, status: e.name === 'AbortError' ? 'timeout' : 'red', respuesta: null }
  } finally {
    clearTimeout(reloj)
  }
}

// Merece la pena volver a intentarlo CON EL MISMO modelo: está saturado, con
// la cuota apretada, o ha tardado de más. Todo eso se arregla esperando.
const merecereintento = status =>
  status === 503 || status === 429 || status === 'timeout' || status === 'red'

// Merece la pena probar con el modelo de RESERVA. Además de lo anterior, el
// 404: significa que Google ha retirado el modelo principal. Insistir con él
// no sirve de nada, pero la reserva es justo lo que hace falta. Sabemos que
// ese día llegará: los modelos de Gemini se retiran cada pocos años.
const merecereserva = status => merecereintento(status) || status === 404

// El prompt se construye con las categorías DE VERDAD, leídas de la base de
// datos en cada llamada.
//
// Antes iban escritas a mano aquí, y eran las de la app familiar de la que
// salió esta: "Cultura", "Vehículos", "Autopistas", "Loterias"... Ninguna
// existe en la app de Cris y Adri, así que Gemini contestaba una categoría
// que el formulario no podía seleccionar y se quedaba en blanco. En TODOS
// los tickets, no de vez en cuando.
//
// Leerlas de la base de datos también evita que se vuelva a desincronizar el
// día que ellos añadan o renombren una categoría desde Ajustes.
function construirPrompt(categoriasGasto, categoriasIngreso) {
  const lista = ns => ns.map(n => `"${n}"`).join(', ')
  return `Eres un asistente experto en contabilidad doméstica española. Analiza esta imagen de un documento financiero (ticket de compra, factura, nómina, recibo, etc.) y extrae los datos siguientes en formato JSON estricto, sin texto adicional:

{
  "tipo": "gasto" | "ingreso",
  "importe": número decimal (ej: 45.30) o null,
  "fecha": "YYYY-MM-DD" o null,
  "establecimiento": "nombre del establecimiento o pagador" o null,
  "categoria": EXACTAMENTE una de estas categorías, copiada tal cual, según el tipo:
    - Si es gasto: ${lista(categoriasGasto)}
    - Si es ingreso: ${lista(categoriasIngreso)}
  "confianza_categoria": "alta" | "baja",
  "descripcion": breve descripción de 1-5 palabras o null
}

Reglas importantes:
- El importe debe ser el TOTAL del documento (busca "total", "total a pagar", "importe total", "liquido", "neto a percibir")
- Para la fecha usa el formato YYYY-MM-DD
- La categoría tiene que ser una de la lista, escrita igual. Si ninguna encaja, pon null y "confianza_categoria": "baja"
- Si no estás seguro de la categoría, usa "confianza_categoria": "baja"
- Si no puedes leer algún campo, pon null
- Responde SOLO con el JSON, sin texto antes ni después, sin bloques de código markdown`
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY no configurada')
    return NextResponse.json(
      { error: 'OCR no configurado', diagnostico: 'falta-clave-gemini' },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('imagen')
    if (!file) return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    const base64 = buffer.toString('base64')
    let mimeType = file.type || 'image/jpeg'
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      mimeType = 'image/jpeg'
    }

    // Las categorías principales de verdad. Si la consulta fallara, se pide
    // sin lista: el modelo devolverá null y el usuario la elige a mano, que es
    // mejor que sugerirle una categoría que no existe.
    const { data: cats } = await supabase
      .from('categorias')
      .select('nombre, tipo, padre_id, activa, orden')
      .is('padre_id', null)
      .order('orden')
    const principales = (cats || []).filter(c => c.activa !== false)
    const categoriasGasto = principales.filter(c => c.tipo === 'gasto').map(c => c.nombre)
    const categoriasIngreso = principales.filter(c => c.tipo === 'ingreso').map(c => c.nombre)
    const prompt = construirPrompt(categoriasGasto, categoriasIngreso)

    const cuerpo = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    }

    const arranque = Date.now()
    const queda = () => PRESUPUESTO_MS - (Date.now() - arranque)

    // Hasta dos intentos con el modelo principal. Solo se reintenta lo que
    // tiene arreglo esperando: saturación, agobio de cuota, o que tarde
    // demasiado. Una clave mal puesta o una petición inválida se devuelven a
    // la primera, que reintentarlas no arregla nada.
    let intento = await llamarAGemini(MODELO_PRINCIPAL, cuerpo, Math.min(TOPE_PRINCIPAL_MS, queda()))
    let modeloUsado = MODELO_PRINCIPAL

    // Un solo reintento al principal, y solo si después sigue quedando tiempo
    // para la reserva: insistir aquí vale menos que probar el otro modelo, que
    // tiene su propio cupo.
    if (!intento.ok && merecereintento(intento.status) &&
        queda() > ESPERA_ENTRE_INTENTOS_MS + TOPE_PRINCIPAL_MS + MINIMO_RESERVA_MS) {
      await esperar(ESPERA_ENTRE_INTENTOS_MS)
      intento = await llamarAGemini(MODELO_PRINCIPAL, cuerpo, Math.min(TOPE_PRINCIPAL_MS, queda()))
    }

    // Si el principal sigue sin poder, una vez con el de reserva. Es otro
    // modelo con su propio cupo: uno puede estar saturado y el otro no.
    if (!intento.ok && merecereserva(intento.status) && queda() >= MINIMO_RESERVA_MS) {
      console.error('Gemini principal no disponible — probando con la reserva')
      intento = await llamarAGemini(MODELO_RESERVA, cuerpo, Math.min(TOPE_RESERVA_MS, queda()))
      modeloUsado = MODELO_RESERVA
    }

    const geminiResponse = intento.respuesta

    // Nunca registrar el contenido de los tickets: los registros de Vercel
    // son visibles para los colaboradores del proyecto. Solo el hecho del fallo.
    if (!intento.ok) {
      console.error('Error de Gemini — status:', intento.status, '· modelo:', modeloUsado)
      return NextResponse.json(
        { error: 'Error procesando imagen', diagnostico: `gemini-${intento.status}` },
        { status: 422 }
      )
    }

    const geminiData = await geminiResponse.json()
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!content) {
      const motivo = geminiData.candidates?.[0]?.finishReason || 'sin-candidatos'
      return NextResponse.json(
        { error: 'Sin respuesta del modelo', diagnostico: `vacio-${motivo}` },
        { status: 422 }
      )
    }

    const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let resultado
    try {
      resultado = JSON.parse(jsonStr)
    } catch {
      console.error('El modelo devolvió un JSON inválido')
      return NextResponse.json(
        { error: 'No se pudo parsear la respuesta', diagnostico: 'json-invalido' },
        { status: 422 }
      )
    }

    // Cinturón: aunque se le diga que elija de la lista, el modelo puede
    // inventarse una categoría. Si no está en la lista de verdad, se descarta
    // y que la elija la persona. Mejor una casilla vacía que una mal puesta.
    if (resultado?.categoria) {
      const validas = resultado.tipo === 'ingreso' ? categoriasIngreso : categoriasGasto
      if (validas.length && !validas.includes(resultado.categoria)) {
        resultado.categoria = null
        resultado.confianza_categoria = 'baja'
      }
    }

    return NextResponse.json(resultado)

  } catch (e) {
    console.error('Error OCR:', e.message)
    return NextResponse.json(
      { error: 'No se pudo procesar la imagen', diagnostico: `excepcion-${e.name || 'desconocida'}` },
      { status: 422 }
    )
  }
}
