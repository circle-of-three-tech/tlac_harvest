// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fec449",
  colorScheme: "light",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "The Harvest",
  description: "Lead tracking for the harvest",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "The Harvest",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "The Harvest",
    description: "Lead tracking and management for church outreach",
    type: "website",
    url: "https://harvest.example.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* PWA Splash Screens for iOS */}
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
        {/* PWA Status Bar */}
        <meta name="apple-mobile-web-app-status-bar-style" content="white-content" />
      </head>
      <body className="grain-overlay antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
