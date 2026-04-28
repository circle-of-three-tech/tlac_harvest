// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorkerUpdater } from './ServiceWorkerUpdater';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#fec449',
  colorScheme: 'light',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'TLAC Harvest',
  description: 'Lead tracking for the harvest',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
  // Note: appleWebApp.capable intentionally omitted — it generates the
  // deprecated <meta name="apple-mobile-web-app-capable"> tag. PWA install
  // behaviour is controlled by the manifest and the Viewport export instead.
  appleWebApp: {
    statusBarStyle: 'black-translucent',
    title: 'TLAC Harvest',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'TLAC Harvest',
    description: 'Lead tracking and management for church outreach',
    type: 'website',
    url: 'https://tlacharvest.com.ng',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Standard PWA capability meta (replaces deprecated apple-mobile-web-app-capable) */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS PWA splash screens */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-192x192.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-512x512.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
      </head>
      <body className="grain-overlay antialiased">
        <Providers>{children}</Providers>
        {/* Must be inside <body>, not after </html> */}
        <ServiceWorkerUpdater />
      </body>
    </html>
  );
}