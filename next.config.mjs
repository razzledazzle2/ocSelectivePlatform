/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Question-package ZIP imports (CSV + asset images) are sent as FormData to the
      // import server actions; the default 1 MB cap is too small for real asset batches.
      bodySizeLimit: '25mb',
    },
  },
}

export default nextConfig
