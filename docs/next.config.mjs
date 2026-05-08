import { createMDX } from 'fumadocs-mdx/next'

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  serverExternalPackages: [
    '@takumi-rs/core',
    '@takumi-rs/image-response',
    'typescript',
    'twoslash',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      ...['.md', '.mdx'].map((ext) => ({
        source: `/docs/:path*${ext}`,
        destination: '/llms.md/docs/:path*',
      })),
      {
        source: '/a/script.js',
        destination: 'https://cloud.umami.is/script.js',
      },
      {
        source: '/api/send',
        destination: 'https://cloud.umami.is/api/send',
      },
    ]
  },
}

const withMDX = createMDX()

export default withMDX(config)
