import type { ReactNode } from 'react';

/**
 * Page section with the left margin rail (≥1024px).
 * `rail` is the section index label, e.g. "01 / OVERVIEW".
 */
export default function Section({
  rail,
  stripe,
  slate,
  id,
  children,
}: {
  rail?: string;
  stripe?: boolean;
  slate?: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`section${stripe ? ' section--stripe' : ''}`}
      style={slate ? { background: 'var(--slate)' } : undefined}
    >
      <div className="container">
        <div className="railed">
          <div className="rail-cell">
            {rail && <span className="label" style={slate ? { color: 'var(--slate-leaf)' } : undefined}>{rail}</span>}
          </div>
          <div className="rail-body">{children}</div>
        </div>
      </div>
    </section>
  );
}
