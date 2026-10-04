import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ScrollFx from '@/components/ScrollFx';
import SectionNav from '@/components/SectionNav';

export const metadata: Metadata = {
  title: {
    default: 'Novice — Managed IT and platforms for schools',
    template: '%s — Novice',
  },
  description:
    'We design, document, and maintain the technology a school runs on — networks, devices, filtering, backups, and the platforms on top of them.',
};

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Novice Digital Solutions',
    url: 'https://learnnovice.com/school/',
    description:
      'Managed IT, content filtering, device management, and platforms for private and faith-based schools, plus custom software.',
    areaServed: 'United States',
    email: 'syedamer@learnnovice.com',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />
      <main id="main">{children}</main>
      <Footer />
      <ScrollFx />
      <SectionNav />
    </>
  );
}
