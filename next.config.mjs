import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true, 
   skipWaiting: true,       // ← activate new SW immediately
  clientsClaim: true,      // ← claim all tabs immediately  
    disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // API calls - NetworkFirst with larger cache
    {
      urlPattern: /^https?.*\/api\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'apiCache',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Dashboard pages - StaleWhileRevalidate for better UX
    {
      urlPattern: /^https?.*\/dashboard\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'dashboardCache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
      },
    },
    // Static assets
    {
      urlPattern: /^https?.*\.(js|css|woff2?)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'staticAssets',
        expiration: {
          maxEntries: 300,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    // Images
    {
      urlPattern: /^https?.*\.(png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'imageCache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    // Catch-all for other requests
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
  publicExcludes: ['!noprecache/**'],
  buildExcludes: [
    /\.map$/,
    /hot-update\.(js|json)$/,
    /react-refresh\/runtime\.js/,
    /^manifest_.+\.js$/,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    formats: ['image/webp', 'image/avif'],
  },
};

export default withPWA(nextConfig);
