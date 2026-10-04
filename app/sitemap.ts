import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const base = 'https://learnnovice.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '/',
    '/school/',
    '/school/managed-it/',
    '/school/work/',
    '/school/work/abraar-academy/',
    '/school/about/',
    '/school/trust/',
    '/school/contact/',
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'monthly',
    priority: path === '/' || path === '/school/managed-it/' ? 1 : 0.7,
  }));
}
