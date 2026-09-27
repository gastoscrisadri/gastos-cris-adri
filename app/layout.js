import './globals.css'

export const metadata = {
  title: 'Gastos Cris y Adri',
  description: 'Control de gastos e ingresos',
  manifest: '/manifest.json',
  // El icono de la pantalla de inicio es un JPG y no un PNG, así que a
  // veces iOS no lo coge del manifest y hay que dárselo aparte, aquí.
  icons: { apple: '/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    // "black-translucent" deja ver DETRÁS del reloj el mismo azul oscuro de
    // la app, en vez del blanco de antes: es lo que hacía que se viera un
    // destello claro un instante al abrir.
    statusBarStyle: 'black-translucent',
    title: 'Gastos Cris y Adri',
  },
  formatDetection: { telephone: false },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // El azul de fondo de la propia app, no el azul de la piel de antes. Es lo
  // que ve el móvil MIENTRAS carga la página, antes de que llegue el CSS: si
  // no coincide, hay un parpadeo del color viejo al nuevo.
  themeColor: '#171A2E',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-[var(--fondo)] min-h-screen">
        {children}
      </body>
    </html>
  )
}
