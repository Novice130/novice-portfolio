import type { Metadata } from 'next';
import { Newsreader, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ScrollFx from '@/components/ScrollFx';
import SectionNav from '@/components/SectionNav';

const display = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const body = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://learnnovice.com'),
  title: {
    default: 'Novice — Managed IT and platforms for schools',
    template: '%s — Novice',
  },
  description:
    'We design, document, and maintain the technology a school runs on — networks, devices, filtering, backups, and the platforms on top of them.',
  openGraph: {
    siteName: 'Novice',
    type: 'website',
  },
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Novice Digital Solutions',
    url: 'https://learnnovice.com',
    description:
      'Managed IT, content filtering, device management, and platforms for private and faith-based schools, plus custom software.',
    areaServed: 'United States',
    address: { '@type': 'PostalAddress', addressRegion: 'WY', addressCountry: 'US' },
    email: 'syedamer@learnnovice.com',
  };

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <ScrollFx />
        <SectionNav />
      </body>
    </html>
  );
}
