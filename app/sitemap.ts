import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const base = 'https://learnnovice.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '',
    '/schools/',
    '/work/',
    '/work/abraar-academy/',
    '/about/',
    '/trust/',
    '/contact/',
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'monthly',
    priority: path === '/schools/' ? 1 : 0.7,
  }));
}
