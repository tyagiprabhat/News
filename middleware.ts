import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes that don't require a signed-in user.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // If Clerk keys aren't configured yet, leave the app open so it keeps
  // working before the env vars are added in Vercel.
  if (!process.env.CLERK_SECRET_KEY) return NextResponse.next();

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets, run on everything else
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.svg|icon-512.svg).*)',
    // Always run on API routes
    '/(api|trpc)(.*)',
  ],
};
