import type { Metadata } from 'next';
import { Newsreader, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

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
  title: 'Novice — Collected works',
  description:
    'A gallery of the websites, platforms and tools Novice has built — with Apache Tandoori, open-source remote management for school labs, at the centre.',
  openGraph: {
    siteName: 'Novice',
    type: 'website',
  },
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
