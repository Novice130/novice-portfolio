'use client';

import { useEffect, useRef } from 'react';

/**
 * Cal.com inline embed — same booking link the previous site used
 * (learn-novice-kbeiet/client-booking). Official embed snippet,
 * scoped to a namespace so multiple pages can mount it safely.
 */
const CAL_LINK = 'learn-novice-kbeiet/client-booking';
const NAMESPACE = 'client-booking';

declare global {
  interface Window {
    Cal?: any;
  }
}

export default function CalEmbed() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Official Cal.com loader (idempotent — safe to run twice).
    (function (C: any, A: string, L: string) {
      const p = function (a: any, ar: any) { a.q.push(ar); };
      const d = C.document;
      C.Cal = C.Cal || function () {
        const cal = C.Cal;
        const ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api: any = function () { p(api, arguments); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ['initNamespace', namespace]);
          } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');

    window.Cal('init', NAMESPACE, { origin: 'https://app.cal.com' });
    window.Cal.ns[NAMESPACE]('inline', {
      elementOrSelector: el,
      calLink: CAL_LINK,
      layout: 'month_view',
    });
    window.Cal.ns[NAMESPACE]('ui', {
      theme: 'light',
      styles: { branding: { brandColor: '#1F6B44' } },
      hideEventTypeDetails: false,
      layout: 'month_view',
    });
  }, []);

  return (
    <div className="card" style={{ padding: 8 }}>
      <div ref={ref} style={{ width: '100%', height: 600, overflow: 'auto' }} />
    </div>
  );
}
