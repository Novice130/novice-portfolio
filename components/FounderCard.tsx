import Image from 'next/image';

/**
 * The founder, rendered the way everything else on this site is
 * rendered: as a record in the ledger. Replaces a photograph.
 * Soft paper tones so it blends with the page.
 */
export default function FounderCard() {
  const labelStyle = {
    color: 'var(--leaf)',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.06em',
    padding: '12px 12px 12px 12px',
    whiteSpace: 'nowrap' as const,
    verticalAlign: 'top' as const,
  };
  const valueStyle = {
    padding: '12px 12px 12px 0',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--t-data)',
    color: 'var(--ink)',
  };

  return (
    <div
      style={{
        background: 'var(--paper-card)',
        border: '1px solid var(--rule)',
        borderRadius: 2,
        padding: 28,
      }}
    >
      <div
        className="label"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}
      >
        <span>PERSONNEL RECORD</span>
        <span>NV-00</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid var(--rule-soft)',
        }}
      >
        <Image
          src="/logo.png"
          alt=""
          width={44}
          height={44}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)' }}>
            Founder
          </div>
          <div className="data" style={{ color: 'var(--leaf)', fontSize: 13 }}>
            <span
              className="dot"
              aria-hidden="true"
              style={{ background: 'var(--leaf)' }}
            />
            active · in a classroom weekly
          </div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {[
            ['ROLE', 'teacher · systems administrator'],
            ['CLASSROOM', '6 years, ongoing'],
            ['RUNS', 'the school’s own infrastructure'],
            ['BASE', 'Hyderabad, India'],
            ['ENTITY', 'Novice Digital Solutions, WY, USA'],
          ].map(([k, v], i) => (
            <tr key={k} style={{ background: i % 2 === 0 ? 'var(--stripe)' : 'transparent' }}>
              <td style={labelStyle}>{k}</td>
              <td style={valueStyle}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
