import type { Metadata } from 'next';
import Link from 'next/link';
import Section from '@/components/Section';
import AssetLedger from '@/components/AssetLedger';

export const metadata: Metadata = {
  title: 'Abraar Academy — Case study',
  description:
    'Rebuilt a school’s infrastructure after the provider left: hypervisor, domain controllers, service containers, verified backups, and an overlay network.',
};

const problems = [
  'The outsourced provider left with the high school program, and support disappeared with them.',
  'Nobody on staff held administrator access to the systems the school ran on.',
  'Backups existed on paper. Nobody had ever restored one.',
  'Devices, accounts, and filtering had no owner and no inventory.',
];

const outcomes = [
  { label: 'DOWNTIME', detail: 'Domain services at 99.9%+ uptime since rebuild' },
  { label: 'BACKUP', detail: 'Restores tested on a schedule — verified, not assumed' },
  { label: 'FILTERING', detail: 'Enforced per device, thousands of blocks daily' },
  { label: 'DOCS', detail: 'Every decision written down; another professional can take over in an afternoon' },
];

export default function AbraarCaseStudy() {
  return (
    <>
      <Section rail="NV-01">
        <p className="label" style={{ marginBottom: 16 }}>Case study · Schools · Infrastructure</p>
        <h1>
          Abraar <em>Academy.</em>
        </h1>
        <p className="lead" style={{ marginTop: 24 }}>
          Rebuilt after the provider left. Designed, documented, and operated —
          unpaid — for the school where the founder teaches.
        </p>
      </Section>

      <Section rail="01 / CONTEXT">
        <h2>Context</h2>
        <div className="grid-12" style={{ marginTop: 24 }}>
          <div className="col-7">
            <p>
              Abraar Academy is a private faith-based school. Its high school
              program had been outsourced, and when that arrangement ended, the
              IT support attached to it disappeared overnight. What remained was
              a building full of devices, accounts, and services that nobody
              owned, nobody documented, and nobody could administer.
            </p>
            <p>
              The founder teaches at the school. That&rsquo;s why this
              deployment exists, and why it&rsquo;s labelled honestly: built
              unpaid, as the person in the building who could do it.
            </p>
          </div>
          <aside className="col-5">
            <div className="card">
              <div className="eyebrow">Fact panel</div>
              <div className="ledger">
                {[
                  ['CLIENT', 'Abraar Academy'],
                  ['SECTOR', 'Private / faith-based school'],
                  ['SIZE', '~160 students · ~25 staff'],
                  ['DURATION', 'Ongoing'],
                  ['STACK', 'Proxmox · AD · Docker · Tailscale'],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="ledger-row"
                    style={{ gridTemplateColumns: 'minmax(90px, auto) 1fr', minHeight: 44, padding: '10px 8px' }}
                  >
                    <span className="label">{k}</span>
                    <span className="small">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Section>

      <Section rail="02 / PROBLEM" stripe>
        <h2>Problem</h2>
        <div className="ledger" style={{ marginTop: 24 }} data-reveal-group>
          {problems.map((p, i) => (
            <div
              key={p}
              className="ledger-row"
              style={{ gridTemplateColumns: 'minmax(40px, auto) 1fr' }}
              data-reveal
            >
              <span className="tag">{String(i + 1).padStart(2, '0')}</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section rail="03 / WHAT WE DID">
        <h2>What we did</h2>
        <p style={{ marginTop: 16 }}>
          Rebuilt the stack from the hypervisor up: virtualisation host, primary
          and replica domain controllers, containerised services, an
          off-host backup target with scheduled restore tests, and an overlay
          network for management access. Everything documented as it was built.
        </p>
        <div className="diagram" style={{ marginTop: 32 }}>
          <pre aria-label="Architecture diagram">{`┌──────────────────────────────────────────────────────┐
│  HYPERVISOR (Proxmox)                                │
│                                                      │
│  ┌────────────────┐   ┌────────────────┐             │
│  │ AC-0118        │   │ AC-0119        │             │
│  │ domain ctrl    │──▶│ replica        │             │
│  └────────────────┘   └────────────────┘             │
│                                                      │
│  ┌──────────────────────────────────────┐            │
│  │ service containers                   │            │
│  │ filtering · monitoring · file · apps │            │
│  └──────────────────────────────────────┘            │
└──────────────┬───────────────────────────────────────┘
               │ scheduled, verified
               ▼
        ┌────────────┐        ┌────────────────────┐
        │ AC-0301    │        │ overlay network    │
        │ backup     │        │ (management access)│
        └────────────┘        └────────────────────┘`}</pre>
        </div>
      </Section>

      <Section rail="04 / OUTCOME" stripe>
        <h2>Outcome</h2>
        <div className="ledger" style={{ marginTop: 24 }} data-reveal-group>
          {outcomes.map((o) => (
            <div
              key={o.label}
              className="ledger-row"
              style={{ gridTemplateColumns: 'minmax(110px, auto) 1fr' }}
              data-reveal
            >
              <span className="label">{o.label}</span>
              <span className="small">{o.detail}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48 }}>
          <AssetLedger title="UNDER MANAGEMENT" meta="ABRAAR ACADEMY · representative" />
        </div>
      </Section>

      <Section rail="05 / ARTIFACTS">
        <h2>Artifacts</h2>
        <p className="muted" style={{ marginTop: 16 }}>
          Internal infrastructure — no public links. A representative ledger
          view is shown above; screenshots available on a call.
        </p>
        <div className="btn-row">
          <Link href="/schools" className="btn btn--primary">
            This is what the school offer looks like →
          </Link>
          <Link href="/work" className="btn btn--quiet">
            ← All work
          </Link>
        </div>
      </Section>
    </>
  );
}
