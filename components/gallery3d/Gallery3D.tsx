'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import LightSwitch from '@/components/gallery/LightSwitch';
import { pieces } from '@/data/gallery';
import { pieceSlot, stops, type Stop } from './contract';
import { createEngine } from './engine';

type Mode = '3d' | 'flat';

const LAST = stops.length - 1;
/** Scroll must rest this long (ms) before the walk settles on a stop. */
const SETTLE_MS = 160;
// Wheel: px of travel that counts as one step, the quiet gap (ms) that ends a
// gesture (so trackpad momentum cannot fire a second step), and a floor between steps.
const WHEEL_STEP = 30;
const WHEEL_GAP = 140;
const WHEEL_COOLDOWN = 420;
const SWIPE_MIN = 44;
const SWIPE_MS = 900;
/** Nudging this far (in stops) past a stop carries on to the next one. */
const SETTLE_BIAS = 0.07;
/** The caption dims once the camera is this far (in stops) from its stop. */
const WALK_DIM = 0.16;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pad = (n: number) => String(n).padStart(2, '0');
// Every work opens in a new tab, including the ones hosted on this domain, so
// the gallery stays loaded behind it. Only the door to Room 2 leaves the page.
const opensNewTab = (stop: { kind: string }) => stop.kind !== 'door';

// Mirrors the pre-paint script in the layout, for arrivals by client-side navigation.
function detectMode(): Mode {
  if (!('WebGL2RenderingContext' in window)) {
    document.documentElement.dataset.g3 = 'none';
    return 'flat';
  }
  let saved: string | null = null;
  try {
    saved = localStorage.getItem('gmode');
  } catch {}
  return saved === 'flat' ? 'flat' : '3d';
}

function stopFromHash(): number {
  let id = window.location.hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {}
  return Math.max(0, stops.findIndex((s) => s.id === id));
}

export default function Gallery3D({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [progress, setProgress] = useState(0.06);
  const [open, setOpen] = useState(false);
  // Coming back in the same tab (reload, back from Room 2): no opening ceremony.
  const [quick, setQuick] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.dataset.gmode) root.dataset.gmode = detectMode();
    // Tells the layout's watchdog that the shell is alive and owns the mode now.
    if (root.dataset.g3 !== 'none') root.dataset.g3 = 'live';
    setMode(root.dataset.gmode === '3d' ? '3d' : 'flat');
    try {
      setQuick(sessionStorage.getItem('g3seen') === '1');
    } catch {}
    return () => {
      delete root.dataset.gmode;
      delete root.dataset.g3;
    };
  }, []);

  const apply = useCallback((next: Mode, persist: boolean) => {
    document.documentElement.dataset.gmode = next;
    if (persist) {
      try {
        localStorage.setItem('gmode', next);
      } catch {}
    }
    if (window.location.hash) {
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      } catch {}
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    setOpen(false);
    setProgress(0.06);
    setMode(next);
  }, []);

  const onReady = useCallback(() => {
    setOpen(true);
    try {
      sessionStorage.setItem('g3seen', '1');
    } catch {}
  }, []);
  const onFail = useCallback(
    (err: unknown) => {
      console.warn('Gallery: 3D view unavailable, showing the list.', err);
      document.documentElement.dataset.g3 = 'none';
      apply('flat', false);
    },
    [apply],
  );

  return (
    <>
      <header className="g-head g3-head">
        <a href="/" className="g-mark">
          Novice <span>Gallery</span>
        </a>
        <div className="g3-tools">
          <LightSwitch />
          <button type="button" className="g3-mode" onClick={() => apply(mode === '3d' ? 'flat' : '3d', true)}>
            <span className="g3-mode-list">
              List<span className="g3-opt"> view</span>
            </span>
            <span className="g3-mode-walk">
              Walk<span className="g3-opt"> the gallery</span>
            </span>
          </button>
        </div>
      </header>

      <main id="main">
        {mode === '3d' && <Walk onProgress={setProgress} onReady={onReady} onFail={onFail} />}
        <div className={`g3-curtain${open ? ' is-open' : ''}${quick ? ' is-quick' : ''}`} role="status" aria-hidden={open}>
          <span className="g3-curtain-panel g3-curtain-panel--l" />
          <span className="g3-curtain-panel g3-curtain-panel--r" />
          <div className="g3-curtain-body">
            <p className="g3-curtain-mark">
              Novice <span>Gallery</span>
            </p>
            <span className="g3-curtain-line">
              <span style={{ transform: `scaleX(${progress})` }} />
            </span>
            <small>Opening the gallery…</small>
          </div>
        </div>
        <div className="g3-flat">{children}</div>
      </main>
    </>
  );
}

type WalkProps = {
  onProgress: (progress: number) => void;
  onReady: () => void;
  onFail: (err: unknown) => void;
};

function Walk({ onProgress, onReady, onFail }: WalkProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<(index: number) => void>(() => {});
  const faceRef = useRef<(index: number) => void>(() => {});
  // Scroll position in stops; the camera trails it.
  const targetRef = useRef(0);

  const [current, setCurrent] = useState(stopFromHash);
  const [settled, setSettled] = useState(current);
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem('g3hint') !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!stage || !canvas || !track) return;

    const first = track.firstElementChild as HTMLElement;
    let top = 0;
    let height = 1;
    const measure = () => {
      const rect = first.getBoundingClientRect();
      top = rect.top + window.scrollY;
      height = rect.height || window.innerHeight;
    };
    measure();

    const start = stopFromHash();
    let anchor = start;
    let shown = start;
    let touching = false;
    let hinting = true;
    let timer = 0;
    targetRef.current = start;
    window.scrollTo({ top: top + start * height, behavior: 'instant' });

    // Nothing on screen scrolls, so every jump is an instant scroll and the
    // engine's damped camera supplies the motion.
    // Street View model: walking keeps you on the centre line looking down the
    // gallery; choosing a work turns you to face it and brings up its caption.
    const root = document.documentElement;
    const isPiece = (i: number) => stops[i].kind === 'piece';
    let facing = isPiece(start) && window.location.hash.length > 1;
    const syncFace = () => {
      if (facing || !isPiece(Math.round(targetRef.current))) root.dataset.g3face = '1';
      else delete root.dataset.g3face;
    };
    const setFacing = (on: boolean) => {
      facing = on;
      engine.setFace(on);
      syncFace();
    };
    const go = (index: number, keepFace = false) => {
      const i = clamp(Math.round(index), 0, LAST);
      anchor = i;
      targetRef.current = i;
      if (!keepFace) facing = false;
      engine.setFace(facing);
      engine.setFocusTarget(i);
      syncFace();
      window.scrollTo({ top: top + i * height, behavior: 'instant' });
    };
    const face = (index: number) => {
      const i = clamp(Math.round(index), 0, LAST);
      if (i !== Math.round(targetRef.current)) go(i);
      setFacing(true);
    };
    goRef.current = go;
    faceRef.current = face;
    syncFace();

    const engine = createEngine({
      canvas,
      focus: start,
      face: facing,
      onProgress,
      onReady,
      onError: onFail,
      onFocus: (f) => {
        const c = Math.round(f);
        if (c !== shown) {
          shown = c;
          setCurrent(c);
        }
        stage.classList.toggle('is-walking', Math.abs(f - c) > WALK_DIM);
      },
      onCut: () => {
        canvas.classList.remove('is-cut');
        void canvas.offsetWidth;
        canvas.classList.add('is-cut');
      },
      onHotspot: (id) => {
        const cur = Math.round(targetRef.current);
        // Floor markers, Street View style.
        if (id === 'nav:next') return go(cur + 1);
        if (id === 'nav:prev') return go(cur - 1);
        if (id === 'nav:face') return face(cur);
        if (id.startsWith('nav:goto:')) {
          const n = Number(id.slice(9));
          if (n !== cur) go(n);
          else if (facing && isPiece(cur)) setFacing(false);
          return;
        }
        const i = stops.findIndex((s) => s.id === id);
        if (i < 0) return;
        // First click on a work walks over and faces it; a second one opens it.
        if (isPiece(i) && !(facing && i === cur && i === shown)) return face(i);
        if (i !== shown || i !== cur) return go(i);
        const href = stops[i].href;
        if (!href) return;
        if (opensNewTab(stops[i])) window.open(href, '_blank', 'noopener');
        else window.location.assign(href);
      },
    });

    // One wheel notch or a short swipe should still take you to the next work.
    const settle = () => {
      if (touching) return;
      const f = targetRef.current;
      const d = f - anchor;
      const to = Math.abs(d) >= SETTLE_BIAS && Math.abs(d) < 1 ? anchor + Math.sign(d) : Math.round(f);
      if (Math.abs(f - to) > 0.01) go(to);
      else anchor = to;
    };
    const onScroll = () => {
      let f = clamp((window.scrollY - top) / height, 0, LAST);
      if (Math.abs(f - Math.round(f)) < 0.004) f = Math.round(f);
      targetRef.current = f;
      engine.setFocusTarget(f);
      // Arriving by scrollbar or hash link skips go(), so the caption flag is refreshed here too.
      syncFace();
      if (hinting && f > 0.05) {
        hinting = false;
        setHint(false);
        try {
          localStorage.setItem('g3hint', '1');
        } catch {}
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    };
    // Wheel and swipe step one work at a time. Following the raw scroll position
    // let trackpad momentum drag the camera back and forth after each step.
    let wheelSum = 0;
    let wheelAt = 0;
    let wheelArmed = true;
    let wheelFree = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt > WHEEL_GAP) {
        wheelArmed = true;
        wheelSum = 0;
      }
      wheelAt = now;
      if (!wheelArmed || now < wheelFree) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      wheelSum += e.deltaMode === 1 ? d * 32 : d;
      if (Math.abs(wheelSum) < WHEEL_STEP) return;
      go(Math.round(targetRef.current) + Math.sign(wheelSum));
      wheelSum = 0;
      wheelArmed = false;
      wheelFree = now + WHEEL_COOLDOWN;
    };
    let swipe: { x: number; y: number; t: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touching = true;
      window.clearTimeout(timer);
      const t = e.touches[0];
      swipe = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: performance.now() } : null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length) return;
      const from = swipe;
      const up = e.changedTouches[0];
      swipe = null;
      if (from && up && e.type === 'touchend' && performance.now() - from.t < SWIPE_MS) {
        const dx = up.clientX - from.x;
        const dy = up.clientY - from.y;
        const d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
        // Swipe up or left walks on; down or right walks back.
        if (Math.abs(d) > SWIPE_MIN) go(Math.round(targetRef.current) - Math.sign(d));
      }
      touching = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    };
    const onResize = () => {
      const before = height;
      measure();
      if (Math.abs(height - before) > 0.5) go(anchor, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const cur = Math.round(targetRef.current);
      const stop = stops[cur];
      const side = stop.kind === 'piece' && stop.pieceIndex !== undefined ? pieceSlot(stop.pieceIndex).side : 0;
      switch (e.key) {
        case 'ArrowUp':
        case 'PageDown':
          go(cur + 1);
          break;
        case 'PageUp':
          go(cur - 1);
          break;
        case 'ArrowDown':
        case 'Escape':
          // Step back from a work first, then walk back.
          if (side && facing) setFacing(false);
          else if (e.key === 'ArrowDown') go(cur - 1);
          else return;
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          if (!side) go(cur + dir);
          else if (!facing) {
            if (dir === side) face(cur);
            else return;
          }
          // Facing a wall, the gallery runs left to right across the screen.
          else go(cur + (dir === -side ? 1 : -1));
          break;
        }
        case 'Home':
          go(0);
          break;
        case 'End':
          go(LAST);
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.clearTimeout(timer);
      delete root.dataset.g3face;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      goRef.current = () => {};
      engine.dispose();
    };
  }, [onProgress, onReady, onFail]);

  // The address follows the walk, but only once it pauses: browsers cap
  // history.replaceState calls and nobody shares a link mid-stride.
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(current), 260);
    return () => window.clearTimeout(t);
  }, [current]);

  useEffect(() => {
    const hash = settled === 0 ? '' : `#${stops[settled].id}`;
    if (hash === window.location.hash || (!hash && window.location.hash === '#intro')) return;
    try {
      window.history.replaceState(
        window.history.state,
        '',
        hash || window.location.pathname + window.location.search,
      );
    } catch {}
  }, [settled]);

  const go = (index: number) => goRef.current(index);
  const step = (dir: -1 | 1) => {
    const f = targetRef.current;
    go(dir > 0 ? Math.floor(f + 0.001) + 1 : Math.ceil(f - 0.001) - 1);
  };

  return (
    <div className="g3-stage" ref={stageRef}>
      <canvas className="g3-canvas" ref={canvasRef} aria-hidden="true" />

      <div className="g3-scrim" aria-hidden="true" />

      <div className="g3-track" ref={trackRef}>
        {stops.map((s, i) => (
          <section key={s.id} id={s.id} className="g3-stop" aria-labelledby={`g3-title-${s.id}`}>
            <Caption
              stop={s}
              index={i}
              current={i === current}
              onFocus={() => {
                if (i !== Math.round(targetRef.current)) faceRef.current(i);
              }}
              onStart={() => go(1)}
            />
          </section>
        ))}
      </div>

      {hint && current === 0 && (
        <p className="g3-hint">
          <span className="g3-hint-cue" aria-hidden="true" />
          Scroll or tap the floor arrows to walk · click a work to view it
        </p>
      )}

      <div className="g3-dock">
        <button
          type="button"
          className="g3-step"
          aria-label="Previous work"
          aria-disabled={current === 0}
          onClick={() => step(-1)}
        >
          <Arrow dir={-1} />
        </button>
        <div className="g3-mid">
          <p className="g3-count" aria-hidden="true">
            <b>{pad(current + 1)}</b> — {pad(stops.length)}
          </p>
          <nav className="g3-rail" aria-label="Works in the gallery">
            <ol>
              {stops.map((s, i) => (
                <li key={s.id} className={`g3-tick g3-tick--${s.kind}`}>
                  <button
                    type="button"
                    aria-label={s.kind === 'centerpiece' ? `Centrepiece: ${s.title}` : s.title}
                    aria-current={i === current ? 'step' : undefined}
                    data-tip={s.kind === 'centerpiece' ? 'Centrepiece' : s.title}
                    onClick={() => go(i)}
                  >
                    <i aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
        <button
          type="button"
          className="g3-step"
          aria-label="Next work"
          aria-disabled={current === LAST}
          onClick={() => step(1)}
        >
          <Arrow dir={1} />
        </button>
      </div>

      <p className="g3-sr" aria-live="polite">
        {`${stops[settled].title}, ${settled + 1} of ${stops.length}`}
      </p>
    </div>
  );
}

type CaptionProps = { stop: Stop; index: number; current: boolean; onFocus: () => void; onStart: () => void };

function Caption({ stop, index, current, onFocus, onStart }: CaptionProps) {
  const Title = stop.kind === 'intro' ? 'h1' : 'h2';
  const restoring = stop.pieceIndex !== undefined && pieces[stop.pieceIndex].status === 'restoration';
  // [visible label, accessible name] — the arrows are decoration.
  const [label, name] =
    stop.kind === 'centerpiece'
      ? [`Open ${stop.title} ↗`, `Open ${stop.title}`]
      : stop.kind === 'door'
        ? ['Enter Room 2 →', 'Enter Room 2']
        : ['Visit site ↗', `Visit site: ${stop.title}`];

  return (
    <article className={`g3-card g3-card--${stop.kind}${current ? ' is-current' : ''}`} onFocus={onFocus}>
      <div className="g3-eyebrow">
        <span className="g3-rule" aria-hidden="true" />
        <p className="g3-meta g3-r">
          {stop.kind !== 'intro' && <b>No. {pad(index)}</b>}
          {stop.meta}
        </p>
      </div>
      <Title className="g3-title" id={`g3-title-${stop.id}`}>
        <span className="g3-mask">
          <span className="g3-line">{stop.title}</span>
        </span>
      </Title>
      {restoring && <p className="g3-tag g3-r">Under restoration</p>}
      <p className="g3-blurb g3-r">{stop.blurb}</p>
      {stop.href ? (
        <a
          className="g3-cta g3-r"
          href={stop.href}
          aria-label={name}
          {...(opensNewTab(stop) && { target: '_blank', rel: 'noopener' })}
        >
          {label}
        </a>
      ) : (
        <button type="button" className="g3-cta g3-r" onClick={onStart}>
          Start walking ↓
        </button>
      )}
      {stop.kind === 'intro' && <span className="g3-scroll g3-r" aria-hidden="true" />}
    </article>
  );
}

function Arrow({ dir }: { dir: -1 | 1 }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d={dir > 0 ? 'M4 12h15M13 6l6 6-6 6' : 'M20 12H5M11 6l-6 6 6 6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
