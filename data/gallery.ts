export type FrameStyle = 'gilt' | 'walnut' | 'brass';

export type Piece = {
  no: string; // catalogue number
  id: string;
  title: string;
  year?: string;
  medium: string;
  blurb: string;
  image: string;
  href: string;
  external?: boolean;
  status: 'live' | 'restoration';
  frame: FrameStyle;
  tilt: number; // degrees, dark room only
};

export const centerpiece = {
  no: 'NV-00',
  title: 'Apache Tandoori',
  medium: 'Open source · Remote management',
  blurb:
    'Every screen in a school lab, watched and controlled from one browser tab. Case broken by the artist — open source, yours to take.',
  image: '/gallery/apache-tandoori.jpg',
  logo: '/gallery/tandoori-logo.png',
  href: 'https://view.learnnovice.com',
};

export const pieces: Piece[] = [
  {
    no: 'NV-01',
    id: 'abraar-academy',
    title: 'Abraar Academy',
    year: '2025',
    medium: 'School infrastructure · Case study',
    blurb: 'Rebuilt after the provider left.',
    image: '/gallery/abraar-academy.jpg',
    href: '/school/work/abraar-academy/',
    status: 'live',
    frame: 'gilt',
    tilt: -0.6,
  },
  {
    no: 'NV-02',
    id: 'citcd',
    title: 'CITCD',
    year: '2025',
    medium: 'Institution · Website',
    blurb: 'Site and systems for the operator.',
    image: '/gallery/citcd.jpg',
    href: '/CITCD-website/',
    external: true,
    status: 'live',
    frame: 'walnut',
    tilt: 0.5,
  },
  {
    no: 'NV-03',
    id: 'build-imara',
    title: 'Build Imara',
    year: '2025',
    medium: 'Enterprise · Platform',
    blurb: 'Operations platform, shipped.',
    image: '/gallery/build-imara.jpg',
    href: 'https://buildimara.com',
    external: true,
    status: 'live',
    frame: 'brass',
    tilt: 0.4,
  },
  {
    no: 'NV-04',
    id: 'at-tayyibun',
    title: 'At-Tayyibun',
    year: '2026',
    medium: 'Community · Product',
    blurb: 'Matching platform.',
    image: '/gallery/at-tayyibun.jpg',
    href: 'https://attayyibun.com',
    external: true,
    status: 'restoration',
    frame: 'gilt',
    tilt: -0.4,
  },
  {
    no: 'NV-05',
    id: 'phet-remaster',
    title: 'PhET Remaster',
    year: '2025',
    medium: 'Education · Simulations',
    blurb: 'Independent remaster.',
    image: '/gallery/phet-remaster.jpg',
    href: '/phet-simulations/',
    external: true,
    status: 'live',
    frame: 'walnut',
    tilt: 0.7,
  },
  {
    no: 'NV-06',
    id: 'student-assessment',
    title: 'Student Assessment',
    year: '2025',
    medium: 'Schools · Tool',
    blurb: 'Assessment form, in use.',
    image: '/gallery/student-assessment.jpg',
    href: '/student-assessment/',
    external: true,
    status: 'live',
    frame: 'brass',
    tilt: -0.5,
  },
  {
    no: 'NV-07',
    id: 'cpts-companion',
    title: 'CPTS Companion',
    year: '2025',
    medium: 'Labs · Security',
    blurb: 'Study companion, live.',
    image: '/gallery/cpts-companion.jpg',
    href: 'https://cpts.learnnovice.com',
    external: true,
    status: 'live',
    frame: 'gilt',
    tilt: 0.3,
  },
  {
    no: 'NV-08',
    id: 'modest-ummah',
    title: 'Modest Ummah',
    medium: 'Website',
    blurb: 'Temporarily off the wall.',
    image: '/gallery/modest-ummah.jpg',
    href: 'https://modestummah.com',
    external: true,
    status: 'restoration',
    frame: 'walnut',
    tilt: -0.7,
  },
  {
    no: 'NV-09',
    id: 'word-to-presentation',
    title: 'Word → Presentation',
    medium: 'Tool · Converter',
    blurb: 'Documents in, slide decks out.',
    image: '/gallery/word-to-presentation.jpg',
    href: '/citcd/',
    external: true,
    status: 'live',
    frame: 'brass',
    tilt: 0.5,
  },
];
