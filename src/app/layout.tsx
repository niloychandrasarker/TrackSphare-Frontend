import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrackSphere',
  description: 'Consent-based location sharing and device management platform',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-950 text-gray-100 font-sans">
        {children}
      </body>
    </html>
  );
}
