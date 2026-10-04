import type { Metadata } from 'next';
import Frame from '@/components/gallery/Frame';
import Vitrine from '@/components/gallery/Vitrine';
import LightSwitch from '@/components/gallery/LightSwitch';
import { centerpiece, pieces } from '@/data/gallery';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { images: ['/gallery/og.jpg'] },
};

export default function GalleryPage() {
  return (
    <>
      <header className="g-head">
        <a href="/" className="g-mark">
          Novice <span>Gallery</span>
        </a>
        <LightSwitch />
      </header>

      <main id="main">
        <section className="g-intro">
          <h1>
            Collected <em>works</em>
          </h1>
          <p className="g-walltext">
            Nine sites hang on these walls. One sits in the middle of the room with its case
            smashed open — because it is open source, and yours to take.
          </p>
        </section>

        <section className="g-wall" aria-label="The works">
          <Vitrine />
          {pieces.map((p) => (
            <Frame key={p.id} piece={p} />
          ))}
          <a className="door" href="/school/">
            <span className="door-sign">Room 2</span>
            <span className="door-arch">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gallery/novice-schools.jpg" alt="" loading="lazy" />
            </span>
            <span className="plate">
              <span className="label-title">Novice Schools</span>
              <span className="label-meta">Managed IT and platforms for schools →</span>
            </span>
          </a>
        </section>

        <section className="g-catalogue" aria-labelledby="catalogue-h">
          <h2 id="catalogue-h">Catalogue</h2>
          <ol>
            <li>
              <span className="label-no">{centerpiece.no}</span>
              <a href={centerpiece.href} target="_blank" rel="noopener">
                {centerpiece.title}
              </a>
              <span className="cat-meta">{centerpiece.medium}</span>
            </li>
            {pieces.map((p) => (
              <li key={p.id}>
                <span className="label-no">{p.no}</span>
                <a href={p.href} {...(p.href.startsWith('http') && { target: '_blank', rel: 'noopener' })}>
                  {p.title}
                </a>
                <span className="cat-meta">
                  {p.year ? `${p.year} · ` : ''}
                  {p.medium}
                  {p.status === 'restoration' ? ' · Under restoration' : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="g-foot">
        <a href="/school/">Room 2 — Novice Schools →</a>
        <a href="https://github.com/Novice130" target="_blank" rel="noopener">
          GitHub
        </a>
        <a href="mailto:syedamer@learnnovice.com">syedamer@learnnovice.com</a>
      </footer>
    </>
  );
}
