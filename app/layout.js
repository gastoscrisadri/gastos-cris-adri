import './globals.css'

export const metadata = {
  title: 'Gastos Cris y Adri',
  description: 'Control de gastos e ingresos',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Gastos Cris y Adri',
  },
  formatDetection: { telephone: false },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#20243D',
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
