import { createServerClient, type NextRequest } from '@supabase/ssr'
import { NextResponse } from 'next/server'

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

  // This line REFRESHES the session so you don't get "Session Expired"
  await supabase.auth.getUser()

  return response
}


 // middleware.ts
export const config = {
  matcher: [
    /* * This covers /dashboard/Settings/payments and any other 
     * case variations in your folder structure.
     */
    '/dashboard/:path*', 
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}