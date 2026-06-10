import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import SwRegister from '@/components/SwRegister';

export const metadata: Metadata = {
  title: 'Briefly',
  description: 'The world\'s news in 60 words — AI summaries, briefings & translation from 21 global sources',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Briefly',
  },
  icons: {
    icon: '/icon-192.svg',
    apple: '/icon-192.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#030712',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en">
      <body className="antialiased">
        {children}
        <SwRegister />
        <Analytics />
      </body>
    </html>
  );

  // Only mount Clerk once its publishable key is configured, so the app
  // still builds and runs before auth env vars are added in Vercel.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return body;
  }

  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: { colorPrimary: '#2563eb', colorBackground: '#030712' },
      }}
    >
      {body}
    </ClerkProvider>
  );
}
