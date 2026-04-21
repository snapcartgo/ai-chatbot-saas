import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const response = NextResponse.next();

  // --- 1. DYNAMIC IFRAME SECURITY (The SaaS Fix) ---
  // If we are on a chat route, we need to allow the parent site to frame us.
  if (pathname.startsWith('/chat')) {
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const url = new URL(referer);
        const origin = `${url.protocol}//${url.host}`;
        
        // This allows the specific client site (e.g., artistonboard.space) to embed the bot.
        // It also allows the bot to work when opened directly ('self').
        response.headers.set(
          'Content-Security-Policy',
          `frame-ancestors 'self' ${origin};`
        );
      } catch (e) {
        // Fallback for direct links or malformed referers
        response.headers.set('Content-Security-Policy', "frame-ancestors 'self';");
      }
    }
  }

  // --- 2. PAYMENT ROUTES ---
  if (
    pathname.startsWith('/payment-success') ||
    pathname.startsWith('/payment-failure') ||
    pathname.startsWith('/payu')
  ) {
    return response; 
  }

  // --- 3. REFERRAL LOGIC ---
  const refCode = searchParams.get('ref');
  if (refCode) {
    response.cookies.set('referral_code', refCode, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
      // Hint: Use 'lax' or 'none' for cross-site cookie reliability
      sameSite: 'lax', 
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/chat/:path*',      // Added this so the security logic runs on chat pages
    '/payment-success',
    '/payment-failure',
    '/payu/:path*',
  ],
};