/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },

  // On local machines where workspace directory contains special chars ('#'), disable NFT tracing.
  // On Vercel CI/CD (process.env.VERCEL), standard tracing is active.
  outputFileTracing: Boolean(process.env.VERCEL),

  experimental: {
    serverComponentsExternalPackages: ['firebase-admin', 'firebase-admin/auth'],
  },
}

module.exports = nextConfig


