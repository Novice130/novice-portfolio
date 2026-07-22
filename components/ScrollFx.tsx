'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Fade-up on scroll for [data-reveal] elements.
 * 40ms stagger within a group, capped at 8 rows.
 * Re-runs on every route change — client-side navigation mounts new
 * [data-reveal] elements that would otherwise stay hidden.
 */
export default function ScrollFx() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('revealed'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const group = el.closest('[data-reveal-group]');
          let delay = 0;
          if (group) {
            const siblings = Array.from(group.querySelectorAll('[data-reveal]'));
            const idx = siblings.indexOf(el);
            delay = Math.min(idx, 8) * 40;
          }
          setTimeout(() => el.classList.add('revealed'), delay);
          io.unobserve(el);
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll('[data-reveal]:not(.revealed)').forEach((el) => io.observe(el));

    // Safety net: anything still hidden after 2s becomes visible.
    const failsafe = setTimeout(() => {
      document.querySelectorAll('[data-reveal]:not(.revealed)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('revealed');
      });
    }, 2000);

    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, [pathname]);

  return null;
}
