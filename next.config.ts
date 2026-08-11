import type { NextConfig } from "next";

// Pin the Supabase Storage host to *this project's* ref rather than the
// wildcard *.supabase.co. The wildcard let the Next image optimizer proxy and
// cache images from anyone else's Supabase project through our domain.
// Derived from the env var because dev and prod are two separate projects.
function supabaseImageHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return '*.supabase.co' // build-time env-less contexts (Preview collection)
  try {
    return new URL(url).hostname
  } catch {
    return '*.supabase.co'
  }
}

const nextConfig: NextConfig = {
  // Pin the workspace root. A stray package-lock.json in the user's home dir made
  // Turbopack infer C:\Users\Beast as the root and then fail to resolve next itself.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
    proxyClientMaxBodySize: '20mb',
  },
  images: {
    remotePatterns: [
      // Supabase Storage public URLs (tournament photos, logos, headers, avatars)
      { protocol: 'https', hostname: supabaseImageHost(), pathname: '/storage/v1/object/**' },
      // OAuth provider avatar CDNs used by Supabase Auth metadata
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      // Stock golf course imagery used on tournament hub cards
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      // App-wide baseline. The Content-Security-Policy is *not* here: it needs
      // a per-request nonce, so it is built in src/lib/csp.ts and set by
      // src/proxy.ts. X-Frame-Options stays as the CSP-2 fallback for
      // frame-ancestors, and nosniff matters most given the public buckets.
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
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
