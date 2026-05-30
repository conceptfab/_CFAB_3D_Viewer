import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';

// Ścieżki chronione — brak cookie → redirect /login.
const PROTECTED_PATHS = ['/', '/editor', '/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sprawdź czy ścieżka jest chroniona (exact match lub prefix dla /api/admin/*)
  const isProtected =
    PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/api/admin/');

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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
};
