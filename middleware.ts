// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refCode = searchParams.get('ref');

  const response = NextResponse.next();

  if (refCode) {
    // Save the code in a cookie for 30 days
    response.cookies.set('referral_code', refCode, {
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: ['/'], // Only runs on the homepage or landing page
};