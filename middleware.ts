import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/cookie-name';

// Ścieżki chronione — brak cookie → redirect /login.
const PROTECTED_PATHS = ['/', '/editor', '/admin', '/gallery', '/studio'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Etap D: Framing override dla /embed/* ────────────────────────────────
  // next.config.ts sends X-Frame-Options: SAMEORIGIN + CSP frame-ancestors 'self'
  // for all routes EXCEPT /embed/*. Middleware runs after and can override headers.
  // For /embed/* we remove X-Frame-Options and allow cross-origin framing.
  // /s/* and everything else keep the restrictive defaults from next.config.ts.
  if (pathname.startsWith('/embed/')) {
    const response = NextResponse.next();
    // Remove legacy header — browsers honour whichever is more restrictive.
    response.headers.delete('X-Frame-Options');
    // Allow embedding from any origin.
    response.headers.set('Content-Security-Policy', "frame-ancestors *");
    return response;
  }

  // ── Istniejąca logika sesji (Etap A) ─────────────────────────────────────
  // /s/[token] is NOT in PROTECTED_PATHS and not matched below → public.
  // /embed/[token] is handled above → public (already returned).

  // Sprawdź czy ścieżka jest chroniona (exact match lub prefix dla /api/admin/*)
  const isProtected =
    PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/api/scenes') ||
    pathname.startsWith('/api/studio') ||
    pathname.startsWith('/api/blob/');

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!sessionCookie) {
    // API routes → 401 (nie redirect)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Uruchom middleware dla tras chronionych (wyklucz _next/static, _next/image, favicon)
  // /embed/* added so the framing override fires for those routes too.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
};
