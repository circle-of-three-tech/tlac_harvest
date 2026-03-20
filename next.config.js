import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true, 
    skipWaiting: true,       // ← activate new SW immediately
  clientsClaim: true,      // ← claim all tabs immediately  
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
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
