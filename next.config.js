/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    PNW_API_KEY: process.env.PNW_API_KEY,
  }
}

module.exports = nextConfig