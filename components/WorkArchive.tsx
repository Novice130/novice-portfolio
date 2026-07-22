'use client';

import Link from 'next/link';
import { useState } from 'react';
import { projects } from '@/data/projects';

const filters = ['All', 'Schools', 'Education', 'Product', 'Infrastructure'] as const;

export default function WorkArchive() {
  const [active, setActive] = useState<(typeof filters)[number]>('All');
  const shown = projects.filter((p) => active === 'All' || p.filter === active);

  return (
    <>
      <div className="chips" role="group" aria-label="Filter projects" style={{ marginTop: 32 }}>
        {filters.map((f) => (
          <button
            key={f}
            className="chip"
            onClick={() => setActive(f)}
            aria-pressed={active === f}
            style={
              active === f
                ? {
                    background: 'var(--leaf-wash)',
                    borderColor: 'var(--leaf)',
                    color: 'var(--leaf)',
                    cursor: 'pointer',
                  }
                : { cursor: 'pointer', background: 'none' }
            }
          >
            {f}
          </button>
        ))}
      </div>

      <div className="ledger" style={{ marginTop: 24 }}>
        {shown.map((p) => {
          const cols = {
            gridTemplateColumns: 'minmax(72px, auto) 1.2fr 1fr 1.4fr minmax(56px, auto)',
          };
          const inner = (
            <>
              <span className="tag">{p.tag}</span>
              <span style={{ fontWeight: 500 }}>{p.name}</span>
              <span className="small muted">{p.category}</span>
              <span className="small">{p.outcome}</span>
              <span className="data muted">{p.year}</span>
            </>
          );
          if (!p.href) {
            return (
              <div key={p.tag} className="ledger-row" style={cols}>
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
            >
              {inner}
            </a>
          ) : (
            <Link key={p.tag} href={p.href} className="ledger-row" style={cols}>
              {inner}
            </Link>
          );
        })}
      </div>
    </>
  );
}
