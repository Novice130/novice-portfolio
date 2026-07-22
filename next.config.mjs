/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // Dev-only: next dev serves public/ by exact file path, so directory
  // roots like /citcd/ 404 locally. Static hosts resolve index.html
  // themselves, and `output: export` ignores rewrites at build time.
  ...(isDev && {
    rewrites: async () => [
      { source: '/citcd', destination: '/citcd/index.html' },
      { source: '/phet-simulations', destination: '/phet-simulations/index.html' },
      { source: '/student-assessment', destination: '/student-assessment/index.html' },
      { source: '/CITCD-website', destination: '/CITCD-website/index.html' },
    ],
  }),
};

export default nextConfig;
