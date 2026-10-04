import { centerpiece as c } from '@/data/gallery';

const cracks = [
  'M285 95 L250 70 L205 62 L140 20 L120 0',
  'M285 95 L300 60 L296 30 L310 0',
  'M285 95 L325 80 L360 52 L400 40',
  'M285 95 L330 110 L370 108 L400 125',
  'M285 95 L310 135 L335 190 L330 250 L350 320',
  'M285 95 L275 140 L250 185 L255 250 L230 320',
  'M285 95 L240 110 L190 140 L120 150 L60 200 L0 215',
  'M285 95 L245 92 L180 95 L90 70 L0 80',
];

const fractures = [
  'M190 140 L170 190 L175 240',
  'M335 190 L370 215 L400 210',
  'M205 62 L190 30',
  'M262 78 L268 112 L290 122 L312 108 L314 84 L298 70 L270 68 Z',
  'M232 62 L226 108 L246 142',
  'M300 150 L338 132 L352 100',
  'M318 48 L345 66',
];

const hole = '272,84 281,80 290,74 296,86 304,90 297,99 301,110 288,106 280,113 276,102 266,97';

export default function Vitrine() {
  return (
    <a className="vitrine" href={c.href} target="_blank" rel="noopener">
      <span className="v-beam" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={`mote mote-${i}`} />
        ))}
      </span>

      <span className="v-case">
        <span className="v-art">
          <span className="v-screen">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image} alt="Apache Tandoori monitoring view: five lab computers on one screen" />
          </span>
          <span className="v-stand" aria-hidden="true" />
        </span>

        <svg className="v-glass" viewBox="0 0 400 320" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="v-sheen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--glass-hi)" />
              <stop offset="0.35" stopColor="var(--glass-lo)" />
              <stop offset="0.6" stopColor="var(--glass-hi)" />
              <stop offset="1" stopColor="var(--glass-lo)" />
            </linearGradient>
            <mask id="v-hole">
              <rect width="400" height="320" fill="#fff" />
              <polygon points={hole} fill="#000" />
            </mask>
          </defs>
          <rect width="400" height="320" fill="url(#v-sheen)" mask="url(#v-hole)" />
          <polygon className="v-hole-edge" points={hole} />
          {cracks.map((d) => (
            <path key={d} className="crack" d={d} pathLength={1} vectorEffect="non-scaling-stroke" />
          ))}
          {fractures.map((d) => (
            <path key={d} className="crack crack--fine" d={d} pathLength={1} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        <i className="shard shard--a" aria-hidden="true" />
        <i className="shard shard--b" aria-hidden="true" />
      </span>

      <span className="v-plinth">
        <i className="shard shard--c" aria-hidden="true" />
        <i className="shard shard--d" aria-hidden="true" />
        <span className="v-plaque">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.logo} alt="" width={56} height={56} />
          <span>
            <span className="label-no">{c.no} · Centrepiece</span>
            <span className="v-title">{c.title}</span>
            <span className="label-meta">{c.medium}</span>
          </span>
        </span>
        <span className="v-blurb">{c.blurb}</span>
        <span className="v-cta">
          <i className="v-led" aria-hidden="true" />
          Please touch — view.learnnovice.com →
        </span>
      </span>

      <span className="v-floor" aria-hidden="true">
        <i className="shard shard--e" />
        <i className="shard shard--f" />
        <svg className="v-rope" viewBox="0 0 400 70" preserveAspectRatio="xMidYMax meet">
          <path className="rope" d="M40 22 Q200 78 360 22" />
          <g className="post">
            <rect x="36" y="14" width="8" height="46" rx="2" />
            <circle cx="40" cy="12" r="7" />
            <ellipse cx="40" cy="62" rx="16" ry="5" />
          </g>
          <g className="post">
            <rect x="356" y="14" width="8" height="46" rx="2" />
            <circle cx="360" cy="12" r="7" />
            <ellipse cx="360" cy="62" rx="16" ry="5" />
          </g>
        </svg>
        <svg className="v-bench" viewBox="0 0 400 70" preserveAspectRatio="xMidYMax meet">
          <rect x="90" y="26" width="220" height="12" rx="2" />
          <rect x="104" y="38" width="8" height="26" />
          <rect x="288" y="38" width="8" height="26" />
          <path d="M112 50 H288" />
        </svg>
      </span>
    </a>
  );
}
