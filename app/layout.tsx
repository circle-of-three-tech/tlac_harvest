// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  icons: {
    icon: "/favicon.ico",
  },
  title: "The Harvest",
  description: "Lead tracking for the harvest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="grain-overlay antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
  