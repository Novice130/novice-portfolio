'use client';

import { useEffect, useRef } from 'react';
import ledger from '@/data/ledger.json';

/**
 * The signature slate panel. Sourced from data/ledger.json —
 * a manually maintained, representative (anonymised) view.
 * Never presented as live telemetry.
 *
 * When the table overflows its panel, it auto-scrolls gently
 * back and forth. Pauses on hover/touch; disabled entirely
 * under prefers-reduced-motion.
 */
export default function AssetLedger({
  compact = false,
  title = 'ASSET LEDGER — REPRESENTATIVE VIEW',
  meta = 'anonymised',
}: {
  compact?: boolean;
  title?: string;
  meta?: string;
}) {
  const rows = compact ? ledger.rows.slice(0, 4) : ledger.rows;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let dir = 1;
    let paused = false;
    let idle = 0;

    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', resume);

    const step = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max > 4 && !paused) {
        if (idle > 0) {
          idle -= 1;
        } else {
          el.scrollLeft += dir * 0.5;
          if (el.scrollLeft >= max - 1) { dir = -1; idle = 90; }
          else if (el.scrollLeft <= 1) { dir = 1; idle = 90; }
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend', resume);
    };
  }, []);

  return (
    <div className="slate" ref={panelRef}>
      <div className="slate-title">
        <span>{title}</span>
        <span>{meta}</span>
      </div>
      <table className="slate-table">
        {!compact && (
          <thead>
            <tr>
              <th>Tag</th>
              <th>System</th>
              <th>Status</th>
              <th>Last check</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r) => (
            <tr key={r.tag}>
              <td>{r.tag}</td>
              <td>{r.system}</td>
              <td>
                <span className="dot" aria-hidden="true" />
                {r.status}
              </td>
              <td>{r.check}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
