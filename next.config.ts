import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
    proxyClientMaxBodySize: '20mb',
  },
  images: {
    remotePatterns: [
      // Supabase Storage public URLs (tournament photos, logos, headers, avatars)
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
      // OAuth provider avatar CDNs used by Supabase Auth metadata
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      // Stock golf course imagery used on tournament hub cards
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      // Service worker: must not be cached by browsers / CDNs, and must be served
      // as JS with a tight CSP so it can never load third-party code.
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
};

export default nextConfig;
