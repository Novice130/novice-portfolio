'use client';

import { useRef } from 'react';

export type QA = { q: string; a: string };

/**
 * FAQ as ledger rows. Native <details> — keyboard operable for free.
 * One open at a time.
 */
export default function FAQ({ items }: { items: QA[] }) {
  const ref = useRef<HTMLDivElement>(null);

  function closeOthers(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const target = e.currentTarget;
    if (!target.open || !ref.current) return;
    ref.current.querySelectorAll('details[open]').forEach((d) => {
      if (d !== target) d.removeAttribute('open');
    });
  }

  return (
    <div className="faq" ref={ref}>
      {items.map((item) => (
        <details key={item.q} onToggle={closeOthers}>
          <summary>{item.q}</summary>
          <div className="answer">
            <p>{item.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
