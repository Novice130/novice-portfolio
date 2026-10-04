import type { Metadata } from 'next';
import Section from '@/components/Section';
import WorkArchive from '@/components/WorkArchive';

export const metadata: Metadata = {
  title: 'Work',
  description:
    'Deployments, platforms, and products — schools, education, and software. One ledger row per project.',
};

export default function Work() {
  return (
    <Section rail="01 / ARCHIVE">
      <h1>
        <em>Work.</em>
      </h1>
      <WorkArchive />
    </Section>
  );
}
