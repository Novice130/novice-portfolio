'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Entry = { id: string; label: string };

/**
 * Fixed right-side rail of buttons — one per section — to jump
 * section to section. Labels come from the rail eyebrow when present.
 * Hidden below 1024px.
 */
export default function SectionNav() {
  const pathname = usePathname();
  const [sections, setSections] = useState<Entry[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('main section'));
    const entries: Entry[] = els.map((el, i) => {
      if (!el.id) el.id = `section-${i}`;
      const label =
        el.querySelector('.rail-cell .label')?.textContent?.trim() ||
        el.querySelector('h1, h2')?.textContent?.trim() ||
        `Section ${i + 1}`;
      return { id: el.id, label };
    });
    setSections(entries);
    setActive(0);

    const io = new IntersectionObserver(
      (obs) => {
        obs.forEach((o) => {
          if (o.isIntersecting) {
            const idx = els.indexOf(o.target as HTMLElement);
            if (idx >= 0) setActive(idx);
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  if (sections.length < 2) return null;

  return (
    <nav className="section-nav" aria-label="Page sections">
      {sections.map((s, i) => (
        <button
          key={s.id}
          className={`section-nav-dot${i === active ? ' active' : ''}`}
          aria-label={s.label}
          aria-current={i === active ? 'true' : undefined}
          title={s.label}
          onClick={() =>
            document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
