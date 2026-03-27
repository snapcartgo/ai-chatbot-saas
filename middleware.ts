// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const response = NextResponse.next();

  // ✅ 1. Allow payment-related routes (VERY IMPORTANT)
  if (
    pathname.startsWith('/payment-success') ||
    pathname.startsWith('/payment-failure') ||
    pathname.startsWith('/payu')
  ) {
    return response; // allow without any restriction
  }

  // ✅ 2. Referral logic (your existing logic)
  const refCode = searchParams.get('ref');

  if (refCode) {
    response.cookies.set('referral_code', refCode, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/',                 // homepage
    '/payment-success',  // allow explicitly
    '/payment-failure',
    '/payu/:path*',      // any payu route
  ],
};