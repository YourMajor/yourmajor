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
};

export default nextConfig;
