import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EU News AI',
  description: 'Live EU and French news analysis powered by Claude',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
