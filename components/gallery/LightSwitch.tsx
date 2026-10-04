'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export default function LightSwitch() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    // Arriving by client-side navigation skips the inline script in the layout.
    if (!root.dataset.gtheme) {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('gtheme');
      } catch {}
      root.dataset.gtheme =
        saved === 'dark' || saved === 'light'
          ? saved
          : window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }
    setTheme(root.dataset.gtheme === 'dark' ? 'dark' : 'light');
  }, []);

  // Dark room only: the pointer is a torch.
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const root = document.documentElement;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        root.style.setProperty('--mx', `${e.clientX}px`);
        root.style.setProperty('--my', `${e.clientY}px`);
        root.style.setProperty('--mxp', `${(e.clientX / window.innerWidth) * 100}%`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const flip = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.dataset.gtheme = next;
    root.classList.remove('g-flick');
    void root.offsetWidth;
    root.classList.add('g-flick');
    try {
      localStorage.setItem('gtheme', next);
    } catch {}
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={theme === 'light'}
      aria-label="Gallery lights"
      onClick={flip}
    >
      <span className="switch-plate" aria-hidden="true">
        <span className="switch-rocker" />
      </span>
      <span className="switch-text">Lights</span>
    </button>
  );
}
