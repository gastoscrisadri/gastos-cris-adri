// OCR local con Tesseract.js — funciona en el navegador sin ninguna API externa

export async function reconocerDocumento(imageFile) {
  // Convertir a base64 para que sea accesible desde el Web Worker
  const base64 = await fileToBase64(imageFile)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa+eng', 1, { logger: () => {} })
  const { data: { text } } = await worker.recognize(base64)
  await worker.terminate()
  return parsearTexto(text)
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result) // incluye el prefijo data:image/...
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function parsearTexto(texto) {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const textoLower = texto.toLowerCase()

  const esIngreso = /n[oó]mina|salario|haberes|n[eé]ta.*pagar|transferencia.*recib/i.test(texto)
  const tipo = esIngreso ? 'ingreso' : 'gasto'

  const importe = extraerImporte(lineas)
  const fecha = extraerFecha(texto)
  const establecimiento = extraerEstablecimiento(lineas)
  const { categoria, confianza_categoria } = detectarCategoria(textoLower, tipo)

  return { tipo, importe, fecha, establecimiento, categoria, confianza_categoria, descripcion: null }
}

function extraerImporte(lineas) {
  const patronesTotal = ['total compra', 'total a pagar', 'importe total', 'importe a pagar', 'total', 'a pagar', 'subtotal', 'suma', 'neto', 'liquido']
  for (const patron of patronesTotal) {
    const linea = lineas.find(l => l.toLowerCase().includes(patron))
    if (linea) {
      const num = extraerNumero(linea)
      if (num && num > 0) return num
    }
  }
  const numeros = lineas.map(extraerNumero).filter(n => n && n > 0 && n < 99999)
  if (numeros.length) return Math.max(...numeros)
  return null
}

function extraerNumero(linea) {
  // Acepta: 12,50 | 12.50 | 12,5 | €12.50 | 12,50€
  const match = linea.match(/(\d{1,5})[,.](\d{1,2})\s*€?/) || linea.match(/€\s*(\d{1,5})[,.](\d{1,2})/)
  if (match) return parseFloat(match[1] + '.' + match[2].padEnd(2, '0'))
  return null
}

const MESES = { ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, oct:10, nov:11, dic:12 }

function extraerFecha(texto) {
  // Formato con mes en texto: 07/abr/26, 7-ene-2024, etc.
  const matchTexto = texto.match(/(\d{1,2})[\/\-\.]([a-záéíóú]{3})[\/\-\.](\d{2,4})/i)
  if (matchTexto) {
    const dia = matchTexto[1].padStart(2, '0')
    const mes = MESES[matchTexto[2].toLowerCase().slice(0, 3)]
    const anio = matchTexto[3].length === 2 ? '20' + matchTexto[3] : matchTexto[3]
    if (mes) return `${anio}-${String(mes).padStart(2,'0')}-${dia}`
  }
  // Formato numérico: 07/04/2026, 07-04-26
  const match = texto.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
  if (!match) return null
  const dia = match[1].padStart(2, '0')
  const mes = match[2].padStart(2, '0')
  const anio = match[3].length === 2 ? '20' + match[3] : match[3]
  const d = new Date(`${anio}-${mes}-${dia}`)
  if (!isNaN(d) && d.getFullYear() >= 2020 && parseInt(mes) <= 12) {
    return `${anio}-${mes}-${dia}`
  }
  return null
}

function extraerEstablecimiento(lineas) {
  // Busca en las primeras 6 líneas una que parezca nombre de establecimiento
  return lineas.slice(0, 6).find(l =>
    l.length >= 3 &&
    /[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}/.test(l) &&
    !/^(total|iva|fecha|ticket|factura|cif|nif|tfno|tel|www|http|\d+[\.,]\d+)$/i.test(l.trim())
  ) || null
}

function detectarCategoria(textoLower, tipo) {
  if (tipo === 'ingreso') {
    if (/n[oó]mina|salario|haberes/.test(textoLower)) return { categoria: 'Nómina', confianza_categoria: 'alta' }
    if (/ayuda|subsidio|prestaci[oó]n|subvenci[oó]n/.test(textoLower)) return { categoria: 'Ayudas y subsidios', confianza_categoria: 'alta' }
    return { categoria: 'Otros ingresos', confianza_categoria: 'baja' }
  }

  const mapa = [
    { nombre: 'Alimentación', palabras: ['mercadona', 'lidl', 'dia ', 'aldi', 'carrefour', 'eroski', 'consum', 'ahorramas', 'supermercado', 'alcampo', 'spar ', 'fruteria', 'panaderia', 'carniceria', 'pescaderia', 'verduleria', 'colmado'] },
    { nombre: 'Ocio y restaurantes', palabras: ['restaurante', ' bar ', 'cafeteria', 'cafè', 'cafe ', 'pizza', 'burguer', 'burger', 'sushi', 'heladeria', ' cine', 'teatro', 'hotel', 'mcdonalds', 'kfc', 'telepizza', 'dominos', 'cerveceria', 'mesón', 'meson', 'tasca', 'taberna'] },
    { nombre: 'Transporte', palabras: ['repsol', 'cepsa', ' bp ', 'shell', 'galp', 'gasolina', 'parking', 'aparcamiento', 'metro', 'renfe', ' taxi', 'uber', 'cabify', 'blablacar', 'autopista', 'peaje', 'gasolinera', 'combustible'] },
    { nombre: 'Salud', palabras: ['farmacia', 'medico', 'hospital', 'clinica', 'dentista', 'optica', 'parafarmacia', 'sanitas', 'adeslas', 'mapfre salud', 'quiron', 'consulta'] },
    { nombre: 'Hogar', palabras: ['ikea', 'leroy merlin', 'leroy', 'bricodepot', 'bauhaus', 'aki ', 'comunidad', 'fontanero', 'electricista', 'ferreteria', 'zara home', 'el corte ingles', 'corte ingles'] },
    { nombre: 'Ropa y calzado', palabras: ['zara', 'h&m', 'mango', 'bershka', 'pull&bear', 'primark', 'nike', 'adidas', 'footlocker', 'decathlon', 'springfield', 'stradivarius', 'massimo dutti', 'cortefiel', 'confecci'] },
    { nombre: 'Suministros', palabras: ['iberdrola', 'endesa', 'naturgy', 'gas natural', 'telefonica', 'movistar', 'vodafone', 'orange', 'masmovil', 'jazztel', 'canal de isabel', 'aqualia', 'aguas de'] },
    { nombre: 'Suscripciones', palabras: ['netflix', 'spotify', 'amazon prime', 'apple', 'google one', 'hbo', 'disney', 'gimnasio', 'gym ', 'amazon.es'] },
    { nombre: 'Educación', palabras: ['colegio', 'academia', 'universidad', 'libreria', 'papeleria', 'fnac', 'curso', 'escuela'] },
    { nombre: 'Mascotas', palabras: ['veterinario', 'veterinaria', 'kiwoko', 'maxizoo', 'animalis', 'tienda animal'] },
    { nombre: 'Cuidado personal', palabras: ['peluqueria', 'peluquería', 'barberia', 'estetica', 'spa ', 'belleza', 'perfumeria', 'mercadona cosm', 'watsons', 'druni'] },
  ]

  for (const cat of mapa) {
    if (cat.palabras.some(p => textoLower.includes(p))) {
      return { categoria: cat.nombre, confianza_categoria: 'alta' }
    }
  }

  return { categoria: 'Otros gastos', confianza_categoria: 'baja' }
}
