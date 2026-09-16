import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  // La pantalla de contraseña nueva se llega desde el enlace del correo, y en
  // ese momento todavía no hay sesión: si no se deja pasar, el enlace acaba
  // rebotando a /login y no hay forma de recuperar la contraseña.
  // Es lo ÚNICO que cambia aquí: la regla de abajo, la que echa a /login a
  // quien no ha entrado, se queda igual para todo lo demás.
  const esRecuperarClave = request.nextUrl.pathname.startsWith('/nueva-clave')

  if (!user && !isLoginPage && !esRecuperarClave) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
