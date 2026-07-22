import Link from 'next/link';
import Section from '@/components/Section';
import FounderCard from '@/components/FounderCard';
import AssetLedger from '@/components/AssetLedger';
import { projects } from '@/data/projects';

export default function Home() {
  return (
    <>
      {/* § Hero — 01 / OVERVIEW */}
      <Section rail="01 / OVERVIEW">
        <div
          className="grid-12"
          style={{ alignItems: 'center', minHeight: 'min(88vh, 760px)' }}
        >
          <div className="col-7">
            <h1 className="hero-fade">
              The engineering team your school doesn&rsquo;t have to <em>hire.</em>
            </h1>
            <p className="lead hero-fade hero-fade-1" style={{ marginTop: 24 }}>
              We design, document, and maintain the technology a school runs on —
              networks, devices, filtering, backups, and the platforms on top of
              them. Built so it doesn&rsquo;t break, rather than staffed to wait
              until it does.
            </p>
            <div className="btn-row hero-fade hero-fade-2">
              <Link href="/schools" className="btn btn--primary">
                See the school offer →
              </Link>
              <Link href="/work" className="btn btn--secondary">
                Everything else we build
              </Link>
            </div>
          </div>
          <div className="col-5">
            <AssetLedger compact title="UNDER MANAGEMENT" meta="ABRAAR ACADEMY" />
          </div>
        </div>
      </Section>

      {/* § Router — 02 / START HERE */}
      <Section rail="02 / START HERE" stripe>
        <div className="grid-12" data-reveal-group>
          <Link href="/schools" className="card col-6" data-reveal>
            <h3>I run a school</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Managed IT, filtering, devices, parent portals, and platforms. →
            </p>
          </Link>
          <Link href="/contact" className="card col-6" data-reveal>
            <h3>I need software built</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              SaaS, internal tools, and business platforms outside education. →
            </p>
          </Link>
        </div>
      </Section>

      {/* § What we do — 03 / SERVICES */}
      <Section rail="03 / SERVICES">
        <h2>
          What we <em>do.</em>
        </h2>
        <div className="grid-12" style={{ marginTop: 48 }} data-reveal-group>
          <div className="card col-4" data-reveal>
            <h3>School infrastructure</h3>
            <p className="small">
              Networks, devices, filtering, backups, and the accounts that hold
              it together — designed once, documented, and maintained.
            </p>
            <ul className="chips">
              <li className="chip">Google Workspace</li>
              <li className="chip">ChromeOS</li>
              <li className="chip">Active Directory</li>
              <li className="chip">Filtering</li>
            </ul>
          </div>
          <div className="card col-4" data-reveal>
            <h3>School platforms</h3>
            <p className="small">
              Parent and student portals, learning tools, simulations, and Quran
              and Tajweed apps — built for how a school actually runs.
            </p>
            <ul className="chips">
              <li className="chip">Portals</li>
              <li className="chip">LMS</li>
              <li className="chip">PWA</li>
            </ul>
          </div>
          <div className="card col-4" data-reveal>
            <h3>Custom software</h3>
            <p className="small">
              SaaS, internal tools, and business platforms for teams outside
              education.
            </p>
            <ul className="chips">
              <li className="chip">Next.js</li>
              <li className="chip">Docker</li>
              <li className="chip">Postgres</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* § Proof — 04 / WORK */}
      <Section rail="04 / WORK">
        <h2>
          <em>Work.</em>
        </h2>
        <div className="ledger" style={{ marginTop: 32 }} data-reveal-group>
          {projects.map((p) => {
            const inner = (
              <>
                <span className="tag">{p.tag}</span>
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span className="small muted">{p.category}</span>
                <span className="small">{p.outcome}</span>
              </>
            );
            const cols = {
              gridTemplateColumns: 'minmax(72px, auto) 1.2fr 1fr 1.4fr',
            };
            if (!p.href) {
              return (
                <div key={p.tag} className="ledger-row" style={cols} data-reveal>
                  {inner}
                </div>
              );
            }
            return p.external ? (
              <a
                key={p.tag}
                href={p.href}
                target="_blank"
                rel="noopener"
                className="ledger-row"
                style={cols}
                data-reveal
              >
                {inner}
              </a>
            ) : (
              <Link
                key={p.tag}
                href={p.href}
                className="ledger-row"
                style={cols}
                data-reveal
              >
                {inner}
              </Link>
            );
          })}
        </div>
        <div className="btn-row">
          <Link href="/work" className="btn btn--quiet">
            See all work →
          </Link>
        </div>
      </Section>

      {/* § Who's behind it — 05 / WHO */}
      <Section rail="05 / WHO" stripe>
        <div className="grid-12" style={{ alignItems: 'center' }}>
          <div className="col-4">
            <FounderCard />
          </div>
          <div className="col-7">
            <h2>
              A teacher who runs the <em>systems.</em>
            </h2>
            <p>
              I teach at a school and I run its infrastructure. That&rsquo;s an
              unusual combination, and it&rsquo;s the reason this works:
              I&rsquo;ve sat in the classroom the technology is supposed to
              serve, and I&rsquo;ve been the person called when it stops
              working.
            </p>
            <div className="btn-row">
              <Link href="/about" className="btn btn--quiet">
                More about Novice →
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* § Closing CTA */}
      <section className="section center">
        <div className="container">
          <h2>Start with a conversation, not a contract.</h2>
          <p className="lead" style={{ marginTop: 16 }}>
            Twenty minutes. We&rsquo;ll look at what you have and send you a
            written summary of what we find. No charge, no obligation.
          </p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link href="/contact" className="btn btn--primary">
              Book a call →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
