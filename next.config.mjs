// next.config.mjs
// This is the ONE next.config file — delete next.config.js if it still exists.

import withPWAInit from 'next-pwa';

// Injected by Vercel; falls back to build timestamp locally.
// Changing this value forces all existing service workers to update,
// clearing their precache and eliminating bad-precaching-response 404s
// that occur when a stale SW references build artifacts from a previous deploy.
const SW_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? String(Date.now());

const withPWA = withPWAInit({
  cacheId: SW_VERSION, // bump = all existing caches invalidated on next deploy
  dest: 'public',
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  // PWA is disabled in dev by default because the service worker conflicts
  // with Next.js HMR (you'd need to hard-refresh after every code change).
  // Set ENABLE_PWA_DEV=true to opt-in when you specifically need to test
  // PWA behaviour (install prompt, offline, push) against `next dev`.
  disable:
    process.env.NODE_ENV === 'development' && process.env.ENABLE_PWA_DEV !== 'true',

  runtimeCaching: [
    // ── API — GET only, NetworkFirst ──────────────────────────────────────────
    // POST/PATCH/DELETE must never be cached by the service worker.
    // next-pwa's urlPattern matches on URL only, not method, so we rely on
    // workbox's built-in behaviour: only GET requests are cache-eligible by
    // default in NetworkFirst / StaleWhileRevalidate strategies.
    {
      urlPattern: /^https?.*\/api\/.*/,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
        cacheableResponse: { statuses: [200] },
        networkTimeoutSeconds: 10,
      },
    },

    // ── Dashboard pages — StaleWhileRevalidate ────────────────────────────────
    {
      urlPattern: /^https?.*\/dashboard\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'dashboard-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
      },
    },

    // ── Static JS/CSS ─────────────────────────────────────────────────────────
    {
      urlPattern: /^https?.*\.(js|css|woff2?)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },

    // ── Images ────────────────────────────────────────────────────────────────
    {
      urlPattern: /^https?.*\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },

    // ── Catch-all for remaining navigation requests ────────────────────────────
    {
      urlPattern: /^https?.*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offline-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
  ],

  publicExcludes: ['!noprecache/**'],
  buildExcludes: [
    /\.map$/,
    /hot-update\.(js|json)$/,
    /react-refresh\/runtime\.js/,
    /^manifest_.+\.js$/,
    // Exclude Next.js internal build manifests from precaching.
    // These are deployment-specific and cause bad-precaching-response 404s
    // when a stale SW tries to fetch them after a new deploy.
    /app-build-manifest\.json$/,
    /build-manifest\.json$/,
    /react-loadable-manifest\.json$/,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  // Silence the Prisma edge runtime warning in Next.js 14
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
};

export default withPWA(nextConfig);