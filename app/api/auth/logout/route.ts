import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, SESSION_COOKIE, clearSessionCookieOptions } from '@/lib/auth/session';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await destroySession(token);
  }

  const res = NextResponse.json(null, { status: 204 });
  res.cookies.set(clearSessionCookieOptions());
  return res;
}
