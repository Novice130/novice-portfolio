import type { Metadata } from 'next';
import Section from '@/components/Section';

export const metadata: Metadata = {
  title: 'Trust',
  description:
    'Plain-language commitments: access, data location, backups, filtering, FERPA and COPPA posture, offboarding, and incident response.',
};

const rows = [
  {
    label: 'ACCESS',
    detail:
      'We can access the systems named in your agreement, through accounts you can see and revoke. We never touch student work, email content, or anything outside scope.',
  },
  {
    label: 'DATA LOCATION',
    detail:
      'Your data lives in systems your school holds administrator access to — Google Workspace, your SIS, your backup target. Per-tier specifics are written into the agreement.',
  },
  {
    label: 'ACCESS CONTROL',
    detail:
      'Named individuals only, scoped per system, MFA enforced, reviewed quarterly. Every grant is visible to you.',
  },
  {
    label: 'BACKUP & RESTORE',
    detail:
      'Backups run on a schedule and restores are tested on a schedule. A backup that has never been restored is treated as no backup.',
  },
  {
    label: 'FILTERING & CIPA',
    detail:
      'Content filtering configured and tested per device, aligned with CIPA expectations for schools receiving E-Rate funding.',
  },
  {
    label: 'FERPA & COPPA',
    detail:
      'We operate as a school official with a legitimate educational interest under FERPA where applicable, and we don’t collect data from students directly. We describe practices — we don’t claim certifications we don’t hold.',
  },
  {
    label: 'PRIVACY AGREEMENTS',
    detail:
      'We work through your data privacy agreement — including NDPA-format agreements — before anything is signed.',
  },
  {
    label: 'OFFBOARDING',
    detail:
      'You keep every credential, every document, every backup. Offboarding is contractual and takes an afternoon, not a negotiation.',
  },
  {
    label: 'INCIDENTS',
    detail:
      'If something goes wrong, you hear it from us first — with a stated notification window, what happened, what was affected, and what we’re doing.',
  },
];

export default function Trust() {
  return (
    <Section rail="01 / TRUST">
      <h1>
        <em>Trust.</em>
      </h1>
      <p className="lead" style={{ marginTop: 24 }}>
        One row per commitment, in plain language. These are practices we
        follow, written the way we&rsquo;d want them explained to us.
      </p>
      <div className="ledger" style={{ marginTop: 32 }} data-reveal-group>
        {rows.map((r) => (
          <div
            key={r.label}
            className="ledger-row"
            style={{ gridTemplateColumns: 'minmax(170px, auto) 1fr' }}
            data-reveal
          >
            <span className="label">{r.label}</span>
            <span className="small">{r.detail}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 24 }}>
        We describe practices rather than claiming certifications. Regulatory
        wording is reviewed before it becomes part of any agreement.
      </p>
    </Section>
  );
}
