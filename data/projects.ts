export type Project = {
  tag: string;
  name: string;
  category: string;
  filter: 'Schools' | 'Education' | 'Product' | 'Infrastructure';
  outcome: string;
  year: string;
  href?: string; // internal case study or live artifact
  external?: boolean;
};

export const projects: Project[] = [
  {
    tag: 'NV-01',
    name: 'Abraar Academy',
    category: 'Schools · Infrastructure',
    filter: 'Infrastructure',
    outcome: 'Rebuilt after the provider left',
    year: '2025',
    href: '/work/abraar-academy/',
  },
  {
    tag: 'NV-02',
    name: 'CITCD',
    category: 'Schools · Institution',
    filter: 'Schools',
    outcome: 'Site and systems for the operator',
    year: '2025',
    href: '/citcd/',
    external: true,
  },
  {
    tag: 'NV-03',
    name: 'Build Imara',
    category: 'Enterprise · Platform',
    filter: 'Product',
    outcome: 'Operations platform, shipped',
    year: '2025',
    href: 'https://buildimara.com',
    external: true,
  },
  {
    tag: 'NV-04',
    name: 'At-Tayyibun',
    category: 'Community · Product',
    filter: 'Product',
    outcome: 'Matching platform, live',
    year: '2026',
    href: 'https://attayyibun.com',
    external: true,
  },
  {
    tag: 'NV-05',
    name: 'PhET Remaster',
    category: 'Education · Simulations',
    filter: 'Education',
    outcome: 'Independent remaster',
    year: '2025',
    href: '/phet-simulations/',
    external: true,
  },
  {
    tag: 'NV-06',
    name: 'Student Assessment',
    category: 'Schools · Tool',
    filter: 'Schools',
    outcome: 'Assessment form, in use',
    year: '2025',
    href: '/student-assessment/',
    external: true,
  },
  {
    tag: 'NV-07',
    name: 'CPTS Companion',
    category: 'Labs · Security',
    filter: 'Education',
    outcome: 'Study companion, live',
    year: '2025',
    href: 'https://cpts.learnnovice.com',
    external: true,
  },
];
