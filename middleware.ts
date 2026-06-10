import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  // Auth is active only once AUTH_SECRET and AUTH_USERS are configured,
  // so the app keeps working before the env vars are set up.
  if (!process.env.AUTH_SECRET || !process.env.AUTH_USERS) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(token);

  if (pathname === '/login') {
    return user
      ? NextResponse.redirect(new URL('/', req.url))
      : NextResponse.next();
  }

  if (user) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: [
    // Protect everything except auth endpoints, Next.js internals, and PWA assets
    '/((?!api/auth/login|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.svg|icon-512.svg).*)',
  ],
};
