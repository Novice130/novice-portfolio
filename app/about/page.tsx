import type { Metadata } from 'next';
import Link from 'next/link';
import Section from '@/components/Section';
import FounderCard from '@/components/FounderCard';

export const metadata: Metadata = {
  title: 'About',
  description:
    'A teacher who runs the systems. Who Novice is, who’s behind it, where the team is, and how contracting works.',
};

const facts = [
  {
    label: 'WHAT NOVICE IS',
    detail:
      'A managed IT and software practice for private and faith-based schools, plus custom software for teams outside education.',
  },
  {
    label: "WHO'S BEHIND IT",
    detail:
      'Founder-led. Six years in the classroom, and the person who runs the school’s infrastructure — both at once.',
  },
  {
    label: 'WHERE THE TEAM IS',
    detail:
      'Engineering in Hyderabad, India. Named local partners for on-site work in covered US metros. Entity in Wyoming, USA.',
  },
  {
    label: 'HOW CONTRACTING WORKS',
    detail:
      'Written scope, flat monthly tiers, thirty days’ notice on any rate change, offboarding written into the contract.',
  },
  {
    label: "WHAT WE DON'T DO",
    detail:
      'We don’t hold credentials you don’t have, don’t claim certifications we don’t hold, and don’t sell hardware at a markup.',
  },
];

export default function About() {
  return (
    <>
      <Section rail="01 / ABOUT">
        <div className="grid-12" style={{ alignItems: 'center' }}>
          <div className="col-5">
            <FounderCard />
          </div>
          <div className="col-7">
            <h1>
              A teacher who runs the <em>systems.</em>
            </h1>
            <p className="lead" style={{ marginTop: 24 }}>
              Six years in the classroom — and the person who runs the
              school&rsquo;s IT. That combination is the whole point.
            </p>
            <p>
              Most IT providers have never taught a lesson. Most teachers have
              never rebuilt a domain. Having done both means the technology
              decisions start from what a classroom actually needs — and from
              knowing exactly who gets the call when it stops working, because
              it used to be me.
            </p>
          </div>
        </div>
      </Section>

      <Section rail="02 / THE RECORD" stripe>
        <h2>
          The <em>record.</em>
        </h2>
        <div className="ledger" style={{ marginTop: 32 }} data-reveal-group>
          {facts.map((f) => (
            <div
              key={f.label}
              className="ledger-row"
              style={{ gridTemplateColumns: 'minmax(160px, auto) 1fr' }}
              data-reveal
            >
              <span className="label">{f.label}</span>
              <span className="small">{f.detail}</span>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 24 }}>
          Founder-led, with named local partners for on-site work. If the rest
          of this site sounded bigger than that, it wasn&rsquo;t meant to.
        </p>
      </Section>

      <Section rail="03 / LABS">
        <h2>
          <em>Labs.</em>
        </h2>
        <p className="muted" style={{ marginTop: 16 }}>
          Side work that keeps the skills sharp.
        </p>
        <ul className="chips" style={{ marginTop: 16 }}>
          <li className="chip">
            <a href="https://cpts.learnnovice.com" target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'inherit' }}>
              CPTS Companion ↗
            </a>
          </li>
          <li className="chip">
            <a href="https://www.youtube.com/@learnnovice" target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'inherit' }}>
              YouTube ↗
            </a>
          </li>
          <li className="chip">Homelab</li>
        </ul>
        <div className="btn-row">
          <Link href="/contact" className="btn btn--primary">
            Talk to us →
          </Link>
        </div>
      </Section>
    </>
  );
}
