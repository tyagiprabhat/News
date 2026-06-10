import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { Analytics } from '@vercel/analytics/react';
import { Inter, Fraunces, Archivo } from 'next/font/google';
import './globals.css';
import SwRegister from '@/components/SwRegister';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz'],
});
const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' });

// Set the saved theme before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('breve-theme')||'noir';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','noir');}})();`;

export const metadata: Metadata = {
  title: 'Brève',
  description: 'The world\'s news in 60 words — AI summaries, briefings & translation from 25 global sources',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Brève',
  },
  icons: {
    icon: '/icon-192.svg',
    apple: '/icon-192.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased font-body">
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
        variables: { colorPrimary: '#C9A227', colorBackground: '#0A0A0B' },
      }}
    >
      {body}
    </ClerkProvider>
  );
}
