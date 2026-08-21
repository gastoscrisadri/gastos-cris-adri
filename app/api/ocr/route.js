import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const PROMPT = `Eres un asistente experto en contabilidad familiar española. Analiza esta imagen de un documento financiero (ticket de compra, factura, nómina, recibo, etc.) y extrae los datos siguientes en formato JSON estricto, sin texto adicional:

{
  "tipo": "gasto" | "ingreso",
  "importe": número decimal (ej: 45.30) o null,
  "fecha": "YYYY-MM-DD" o null,
  "establecimiento": "nombre del establecimiento o pagador" o null,
  "categoria": una de estas categorías según el tipo:
    - Si es gasto: "Alimentación", "Transporte", "Cultura", "Ropa", "Belleza", "Gastos Cris", "Salud", "Hogar", "Vehículos", "Ocio", "Loterias", "Suministros", "Gastos Adri", "Regalos", "Autopistas", "Gastos varios o compensaciones", "Inversión"
    - Si es ingreso: "Efectivo mensual", "Salario", "Varios", "Primer asiento", "Bizum recibido", "Tarjeta roja"
  "confianza_categoria": "alta" | "baja",
  "descripcion": breve descripción de 1-5 palabras o null
}

Reglas importantes:
- El importe debe ser el TOTAL del documento (busca "total", "total a pagar", "importe total", "liquido", "neto a percibir")
- Para la fecha usa el formato YYYY-MM-DD
- Si no estás seguro de la categoría, usa "confianza_categoria": "baja"
- Si no puedes leer algún campo, pon null
- Responde SOLO con el JSON, sin texto antes ni después, sin bloques de código markdown`

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY no configurada')
    return NextResponse.json({ error: 'OCR no configurado' }, { status: 500 })
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

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    )

    // Nunca registrar el contenido de los tickets: los registros de Vercel
    // son visibles para los colaboradores del proyecto. Solo el hecho del fallo.
    if (!geminiResponse.ok) {
      console.error('Error de Gemini — status:', geminiResponse.status)
      return NextResponse.json({ error: 'Error procesando imagen' }, { status: 422 })
    }

    const geminiData = await geminiResponse.json()
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!content) {
      return NextResponse.json({ error: 'Sin respuesta del modelo' }, { status: 422 })
    }

    const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let resultado
    try {
      resultado = JSON.parse(jsonStr)
    } catch {
      console.error('El modelo devolvió un JSON inválido')
      return NextResponse.json({ error: 'No se pudo parsear la respuesta' }, { status: 422 })
    }

    return NextResponse.json(resultado)

  } catch (e) {
    console.error('Error OCR:', e.message)
    return NextResponse.json({ error: 'No se pudo procesar la imagen' }, { status: 422 })
  }
}
