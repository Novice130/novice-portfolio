import type { Metadata } from 'next';
import Link from 'next/link';
import Section from '@/components/Section';
import AssetLedger from '@/components/AssetLedger';
import FAQ from '@/components/FAQ';
import SchoolsForm from '@/components/SchoolsForm';
import CalEmbed from '@/components/CalEmbed';

export const metadata: Metadata = {
  title: 'For Schools — Managed IT for private and faith-based schools',
  description:
    'Managed IT, content filtering, device management, and the platforms on top — for private and faith-based schools. Designed and documented so problems don’t start.',
};

const symptoms = [
  'The one person who knew the passwords left.',
  'Every teacher installs whatever they want.',
  'Nobody has checked whether the backups actually restore.',
  'The lab has been down since October.',
  'We don’t know how many devices we own.',
  'Filtering works on some machines and not others.',
];

const howRows = [
  {
    label: 'COVERAGE',
    detail:
      'Monday–Friday, 7am–3pm US Central. Requests acknowledged within 8 business hours — same day. Stated plainly because a promise we can’t keep is worse than a smaller one we can.',
  },
  {
    label: 'PROACTIVE',
    detail:
      'Patching, monitoring, backup verification, and policy review happen on a schedule, off-hours, without a ticket.',
  },
  {
    label: 'ON SITE',
    detail:
      'Chicago metro: a named local partner, dispatched within 5 business days. Elsewhere: we guide your staff through physical work remotely, and we say so before you sign.',
  },
  {
    label: 'ESCALATION',
    detail:
      'Hardware failures, vendor tickets, and anything needing a person in the building follow a written path you get a copy of on day one.',
  },
];

const faqItems = [
  {
    q: 'Your team is in India — what does that mean for us day to day?',
    a: 'It means your cost base is lower and most work happens off-hours, overnight for you. Coverage hours are stated in US Central, responses are in plain English, and on-site work in covered metros is done by named local partners. You always know who is doing what, and from where.',
  },
  {
    q: 'Who comes to the building when hardware fails?',
    a: 'In covered metros, a named local partner we dispatch — you’ll know who they are before you sign. Outside covered metros, we guide your staff through the physical steps remotely, and we tell you that limitation up front rather than after a failure.',
  },
  {
    q: 'We already have someone who handles IT. Can you work with them?',
    a: 'Yes, and it usually works well. We take the design, documentation, and off-hours maintenance; your person keeps the hands-on, in-building work. They end up with a documented system instead of a pile of undocumented habits.',
  },
  {
    q: 'What happens to our data, and can you sign our privacy agreement?',
    a: 'Your data stays in systems you hold administrator access to — we never hold credentials you don’t have. We’ll work through your data privacy agreement, including NDPA-format agreements, before anything is signed. Details are on our Trust page.',
  },
  {
    q: 'Can you manage our Google Workspace and Chromebooks, or do we need to change systems?',
    a: 'We manage what you already run. Google Workspace and ChromeOS are the most common stack we see, and we manage the admin console, org units, enrolment, policy, and account lifecycle directly. No migration required.',
  },
  {
    q: 'We’ve never paid for IT support. Why now?',
    a: 'Because the volunteer model works until it doesn’t — until the person who knew the passwords leaves, or the backup that was never tested fails. The findings call is free precisely so you can see what state you’re in before spending anything.',
  },
  {
    q: 'What if we want to leave?',
    a: 'You keep everything. You already hold administrator access to every system, documentation is delivered to you quarterly, and offboarding is written into the contract. Leaving should take an afternoon, not a negotiation.',
  },
  {
    q: 'Have your on-site people been checked to work around students?',
    a: 'On-site partners in covered metros complete background checks appropriate to working in schools before any dispatch, and we’ll share the specifics of that process during the findings call.',
  },
];

export default function Schools() {
  return (
    <>
      {/* 01 / SCHOOLS — hero */}
      <Section rail="01 / SCHOOLS">
        <h1 className="hero-fade">
          Someone should own the <em>technology.</em>
        </h1>
        <p className="lead hero-fade hero-fade-1" style={{ marginTop: 24 }}>
          Managed IT, content filtering, device management, and the platforms on
          top — for private and faith-based schools. Designed and documented so
          problems don&rsquo;t start, not staffed to wait until they do.
        </p>
        <div className="btn-row hero-fade hero-fade-2">
          <a href="#contact" className="btn btn--primary">
            Book a free findings call →
          </a>
          <a href="#ledger" className="btn btn--secondary">
            See a live deployment
          </a>
        </div>
      </Section>

      {/* 02 / THE PROBLEM */}
      <Section rail="02 / THE PROBLEM">
        <h2>
          What it looks like when <em>nobody</em> owns it
        </h2>
        <div className="ledger" style={{ marginTop: 32 }} data-reveal-group>
          {symptoms.map((s, i) => (
            <div
              key={s}
              className="ledger-row"
              style={{ gridTemplateColumns: 'minmax(40px, auto) 1fr' }}
              data-reveal
            >
              <span className="tag">{String(i + 1).padStart(2, '0')}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 24 }}>
          &ldquo;Most schools we talk to have never bought IT support.
          They&rsquo;ve had volunteers, parents, and a teacher who was good with
          computers. That works until it doesn&rsquo;t.&rdquo;
        </p>
      </Section>

      {/* 03 / YOUR STACK */}
      <Section rail="03 / YOUR STACK" stripe>
        <h2>
          We work with what you already <em>have.</em>
        </h2>
        <p className="lead" style={{ marginTop: 16 }}>
          Most schools we meet are already running Google Workspace and
          Chromebooks, a filter, and a student information system. We manage
          what&rsquo;s there before proposing anything new.
        </p>
        <div className="grid-12" style={{ marginTop: 48 }} data-reveal-group>
          <div className="card col-3" data-reveal>
            <h3 style={{ fontSize: '1.125rem' }}>Google Workspace &amp; ChromeOS</h3>
            <p className="small" style={{ marginBottom: 0 }}>
              Admin console, org units, enrolment, policy, licensing, and
              account lifecycle for staff and students.
            </p>
          </div>
          <div className="card col-3" data-reveal>
            <h3 style={{ fontSize: '1.125rem' }}>Filtering &amp; safety</h3>
            <p className="small" style={{ marginBottom: 0 }}>
              GoGuardian, Securly, Lightspeed, or DNS-level filtering —
              configured, tested per device, and reviewed.
            </p>
          </div>
          <div className="card col-3" data-reveal>
            <h3 style={{ fontSize: '1.125rem' }}>Student information systems</h3>
            <p className="small" style={{ marginBottom: 0 }}>
              FACTS, Gradelink, Blackbaud, and similar — integration, data
              hygiene, and parent access.
            </p>
          </div>
          <div className="card col-3" data-reveal>
            <h3 style={{ fontSize: '1.125rem' }}>On-premise, where it exists</h3>
            <p className="small" style={{ marginBottom: 0 }}>
              Windows Server, Active Directory, virtualisation, labs, and
              backup — for schools with servers on site.
            </p>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 24 }}>
          &ldquo;If you&rsquo;re on Microsoft 365 instead, that&rsquo;s fine
          too. The point is that we manage your school, not our preferred
          architecture.&rdquo;
        </p>
      </Section>

      {/* 04 / START HERE */}
      <Section rail="04 / START HERE">
        <h2>
          Start with a findings <em>call.</em>
        </h2>
        <div className="grid-12" style={{ marginTop: 48 }}>
          <div className="tier tier--recommended col-6">
            <div className="ribbon">Recommended first step</div>
            <h3>Free — Findings call</h3>
            <p className="small">
              Twenty minutes on a video call. We look at what you&rsquo;re
              running and what&rsquo;s exposed. You get a one-page written
              summary within two days, yours to keep whether or not you ever
              hire us.
            </p>
            <div style={{ marginTop: 'auto' }}>
              <a href="#contact" className="btn btn--primary">
                Book it →
              </a>
            </div>
          </div>
          <div className="tier col-6">
            <h3>Paid — Full audit</h3>
            <p className="small">
              One week. Every device, account, and system inventoried, with
              risks ranked and a costed plan. A written report your board can
              read. Fixed fee, no commitment to anything after it.
            </p>
            <div style={{ marginTop: 'auto' }}>
              <a href="#contact" className="btn btn--secondary">
                Ask about an audit →
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* 05 / HOW */}
      <Section rail="05 / HOW">
        <h2>
          How support actually <em>works.</em>
        </h2>
        <p className="lead" style={{ marginTop: 16 }}>
          We&rsquo;re not a helpdesk waiting for the phone to ring. Most of what
          we do happens before anything breaks — patching, monitoring, testing
          restores, reviewing policy. Here&rsquo;s exactly what that means in
          practice.
        </p>
        <div className="ledger" style={{ marginTop: 32 }} data-reveal-group>
          {howRows.map((r) => (
            <div
              key={r.label}
              className="ledger-row"
              style={{ gridTemplateColumns: 'minmax(120px, auto) 1fr' }}
              data-reveal
            >
              <span className="label">{r.label}</span>
              <span className="small">{r.detail}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 06 / THE LEDGER — full-bleed slate */}
      <section
        id="ledger"
        className="section"
        style={{ background: 'var(--slate)', paddingBlock: 96 }}
      >
        <div className="container">
          <div className="railed">
            <div
              className="rail-cell"
              style={{ borderColor: 'var(--slate-rule)' }}
            >
              <span className="label" style={{ color: 'var(--slate-leaf)' }}>
                06 / THE LEDGER
              </span>
            </div>
            <div className="rail-body">
              <h2 style={{ color: 'var(--slate-ink)' }}>
                Under <em>management.</em>
              </h2>
              <div style={{ marginTop: 32 }}>
                <AssetLedger />
              </div>
              <p
                className="small"
                style={{ color: 'var(--graphite)', marginTop: 16, filter: 'brightness(1.6)' }}
              >
                A representative view of what a managed school looks like.
                Hostnames anonymised, no client data shown.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 07 / PRICING */}
      <Section rail="07 / PRICING" stripe>
        <h2>
          What it <em>costs.</em>
        </h2>
        <div className="grid-12" style={{ marginTop: 48 }} data-reveal-group>
          <div className="tier col-3" data-reveal>
            <h3 style={{ fontSize: '1.125rem' }}>Findings call</h3>
            <div className="price">Free</div>
            <hr />
            <ul>
              <li>20-minute review</li>
              <li>One-page written summary</li>
              <li>Yours to keep</li>
            </ul>
            <a href="#contact" className="btn btn--secondary">
              Book it →
            </a>
          </div>
          <div className="tier col-3" data-reveal>
            <h3 style={{ fontSize: '1.125rem' }}>Audit</h3>
            <div className="price">
              $200<span className="interval">fixed fee</span>
            </div>
            <hr />
            <ul>
              <li>Full inventory</li>
              <li>Ranked risks</li>
              <li>Costed plan</li>
              <li>Written report</li>
              <li>One week</li>
            </ul>
            <a href="#contact" className="btn btn--secondary">
              Ask about it →
            </a>
          </div>
          <div className="tier tier--recommended col-3" data-reveal>
            <div className="ribbon">Most schools start here</div>
            <h3 style={{ fontSize: '1.125rem' }}>Essentials</h3>
            <div className="price">
              $300<span className="interval">/month · up to 60 devices</span>
            </div>
            <hr />
            <ul>
              <li>Filtering</li>
              <li>Backup with verified restores</li>
              <li>Monitoring</li>
              <li>Account management</li>
              <li>Remote support</li>
            </ul>
            <a href="#contact" className="btn btn--primary">
              Talk to us →
            </a>
          </div>
          <div className="tier col-3" data-reveal>
            <h3 style={{ fontSize: '1.125rem' }}>Managed</h3>
            <div className="price">
              $600<span className="interval">/month · up to 150 devices</span>
            </div>
            <hr />
            <ul>
              <li>Everything in Essentials</li>
              <li>Device management</li>
              <li>Patching</li>
              <li>Vendor liaison</li>
              <li>On-site dispatch in covered metros</li>
              <li>Quarterly review</li>
            </ul>
            <a href="#contact" className="btn btn--secondary">
              Talk to us →
            </a>
          </div>
        </div>
        <div className="callout" style={{ marginTop: 48 }}>
          <h3 style={{ fontSize: '1.125rem' }}>
            Why is this less than you expected?
          </h3>
          <p className="small" style={{ marginBottom: 0 }}>
            Two reasons. Our engineering is in India, so our cost base is lower
            than a US managed service provider&rsquo;s. And these are
            founding-client prices — we&rsquo;re building a track record with
            schools like yours, and the rate is reviewed annually rather than
            being a permanent discount. You&rsquo;ll always get thirty
            days&rsquo; notice of any change.
          </p>
        </div>
      </Section>

      {/* 08 / CONTINUITY */}
      <Section rail="08 / CONTINUITY">
        <h2>
          What happens if we stop working <em>together.</em>
        </h2>
        <p style={{ marginTop: 16 }}>
          Your school keeps full administrator access to every system, at all
          times — we never hold credentials you don&rsquo;t have. Documentation
          is updated quarterly and delivered to you, not kept on our side. Every
          configuration decision is written down in language another IT
          professional can act on. If we disappear tomorrow, someone competent
          can pick this up in an afternoon.
        </p>
        <p style={{ fontWeight: 500 }}>
          That&rsquo;s written into the contract, not offered as a promise.
        </p>
      </Section>

      {/* 09 / DATA */}
      <Section rail="09 / DATA" stripe>
        <h2>
          Your students&rsquo; <em>data.</em>
        </h2>
        <div className="grid-12" style={{ marginTop: 48 }} data-reveal-group>
          <div className="card col-4" data-reveal>
            <div className="eyebrow">Where it lives</div>
            <p className="small" style={{ marginBottom: 0 }}>
              In the systems your school already holds administrator access
              to — Google Workspace, your SIS, your backup target. Not on our
              side.
            </p>
          </div>
          <div className="card col-4" data-reveal>
            <div className="eyebrow">Who can access it</div>
            <p className="small" style={{ marginBottom: 0 }}>
              Named individuals, with access scoped per system and reviewed.
              You can see and revoke every grant at any time.
            </p>
          </div>
          <div className="card col-4" data-reveal>
            <div className="eyebrow">When you leave</div>
            <p className="small" style={{ marginBottom: 0 }}>
              Everything stays with you — accounts, documentation, backups.
              Offboarding is contractual, not negotiated on the way out.
            </p>
          </div>
        </div>
        <p className="small" style={{ marginTop: 24 }}>
          &ldquo;We&rsquo;ll work through your data privacy agreement —
          including NDPA-format agreements — before anything is signed.&rdquo;{' '}
          <Link href="/trust">Read the full trust page →</Link>
        </p>
      </Section>

      {/* 10 / PROOF */}
      <Section rail="10 / PROOF">
        <h2>
          <em>Proof.</em>
        </h2>
        <Link href="/work/abraar-academy/" className="card" style={{ marginTop: 32, display: 'block' }}>
          <div className="eyebrow">NV-01 · Case study</div>
          <h3>Abraar Academy — rebuilt after the provider left</h3>
          <p className="small">
            Hypervisor, domain controllers, service containers, verified
            backups, and an overlay network — designed, documented, and run for
            the school where the founder teaches. Built unpaid after the high
            school program was outsourced and support disappeared.
          </p>
          <ul className="chips">
            <li className="chip">Proxmox</li>
            <li className="chip">Active Directory</li>
            <li className="chip">Filtering</li>
            <li className="chip">Verified backup</li>
          </ul>
        </Link>
      </Section>

      {/* 11 / QUESTIONS */}
      <Section rail="11 / QUESTIONS">
        <h2>
          Questions schools <em>ask.</em>
        </h2>
        <div style={{ marginTop: 32 }}>
          <FAQ items={faqItems} />
        </div>
      </Section>

      {/* 12 / CONTACT */}
      <Section rail="12 / CONTACT" stripe id="contact">
        <h2>
          Book the <em>call.</em>
        </h2>
        <div className="grid-12" style={{ marginTop: 48 }}>
          <div className="col-6">
            <SchoolsForm />
          </div>
          <div className="col-6">
            <CalEmbed />
          </div>
        </div>
      </Section>
    </>
  );
}
