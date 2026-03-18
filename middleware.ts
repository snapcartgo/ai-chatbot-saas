import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server' // Fixed this line

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // This refreshes the session token so you stay logged in
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}