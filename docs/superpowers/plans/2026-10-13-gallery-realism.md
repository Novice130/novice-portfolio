# 3D Gallery: Arrows, Sharpness and Realism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the walkable 3D gallery read as a real room: side arrows that appear only near a work, artworks and plates that stay sharp under zoom, and scanned materials, room reflections, real shadows and a post chain in place of the painted, flat look.

**Architecture:** Pure decision logic (arrow fade, pixel ratio, artwork tiers, step-down) lives in `components/gallery3d/logic/` with unit tests. Three new render units (`materialLibrary`, `environment`, `pipeline`) are created by the engine and handed to scene modules through `SceneCtx`. Static shadow maps and the environment cube maps are baked on demand through one `invalidateStatic()` call; the render-on-demand loop is unchanged.

**Tech Stack:** three.js `0.170.0` (core plus `three/addons/postprocessing` and `three/addons/geometries`), Next.js 15 static export, TypeScript. Dev only: vitest, playwright, sharp.

**Spec:** `docs/superpowers/specs/2026-10-13-gallery-realism-design.md`. Its last section, "Revisions after reading the code", overrides the earlier sections where they differ. Read it first.

## Global Constraints

- No new runtime dependency. `vitest`, `playwright` and `sharp` are `devDependencies`.
- `components/gallery3d/engine.ts` must not statically import `three` or any module that does. New render modules are loaded with dynamic `import()` in `boot()`. Modules in `logic/` are pure and may be imported statically.
- Render on demand stays: no frames while the camera is settled, except within 1.5 stops of the centrepiece, which animates by design.
- Low tier (`quality === 'low'`): 1K-or-smaller materials, environment map, no shadow maps, no post chain, fake AO decals kept, pixel ratio at most 1.5, no 2400px artworks.
- High tier pixel ratio: device ratio times pinch scale, at most 4, within 8 megapixels (12 while pinch-zoomed).
- Texture sets are CC0 only, from Poly Haven, listed in `public/gallery/tex/CREDITS.md`.
- Every new texture, render target and cube map is disposed in the owning unit's `dispose()`.
- A failed texture, environment bake or post chain must leave the previous look on screen. Nothing may throw out of the frame loop.
- The camera keeps Euler order `YXZ`. `THREE.Raycaster` ignores `.visible`; hidden hit targets must have `visible = false` on the hit mesh itself.
- Gates before every commit: `npx tsc --noEmit -p .`, `npm test`, `npm run build`.
- Commit after every task. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Browser checks run against the built site: `npm run build && npx serve out -l 4173`. Every Playwright context must clear `localStorage.gmode` and set `reducedMotion: 'no-preference'` (a leftover of either has produced misleading results before).

## Review Focus

1. **A texture set is missing or the visitor is offline.** The procedural surface must stay, with one console warning per set and no exception. Pinned in Task 6, Step 9.
2. **Canvas is 0×0 or `devicePixelRatio` is undefined during layout.** The pixel ratio must come back finite and at least `min(device, 1)`, never `NaN` or 0. Pinned in Task 5, Step 1.
3. **The visitor jumps the whole gallery (`End`, `Home`) or walks back and forth quickly.** Never more than three 2400px textures alive, and no canvas left pointing at a disposed texture. Pinned in Task 4, Step 1 (sequence test) and Step 8.
4. **Portrait phone viewport.** The side arrow must lie inside the visible floor, not beyond the screen edge. Pinned in Task 2, Step 1 and Step 9.
5. **Theme toggled several times in a row.** Bakes must coalesce and GPU texture count must not grow. Pinned in Task 7, Step 10.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `vitest.config.ts` | new | Test runner config, `@` alias. |
| `scripts/shots.mjs` | new | Before / after stills at fixed stops and themes. |
| `scripts/capture-gallery.mjs` | new | Recapture site screenshots at 2400px. |
| `scripts/fetch-textures.mjs` | new | Download and convert the five Poly Haven sets. |
| `components/gallery3d/logic/arrowFade.ts` | new | Side arrow opacity, hit threshold, floor position. |
| `components/gallery3d/logic/artworkTiers.ts` | new | Image URLs per tier; which works hold a 2400px texture. |
| `components/gallery3d/logic/pixelRatio.ts` | new | Pixel ratio policy. |
| `components/gallery3d/logic/qualityStepDown.ts` | new | Slow-frame monitor and step-down order. |
| `components/gallery3d/render/materialLibrary.ts` | new | Loads scanned sets, applies them to materials. |
| `components/gallery3d/render/environment.ts` | new | Bakes two room cube maps, assigns them to materials. |
| `components/gallery3d/render/unlit.ts` | new | Marks a material as exempt from tone mapping. |
| `components/gallery3d/render/pipeline.ts` | new | GTAO, bloom, grade pass. |
| `components/gallery3d/contract.ts` | modify | `STAND_BACK`, `SceneCtx.materials / env / invalidateStatic`. |
| `components/gallery3d/engine.ts` | modify | Creates the render units, static bake, pixel ratio, step-down. |
| `components/gallery3d/scene/navArrows.ts` | modify | Floor-fixed side arrow with distance fade. |
| `components/gallery3d/scene/artworks.ts` | modify | Tiered images, metals, reflection, pools. |
| `components/gallery3d/scene/room.ts` | modify | Scanned materials, shadows, lighting, bevels, skirting, rail. |
| `components/gallery3d/scene/centerpiece.ts` | modify | Reflection on glass, shadow-casting spot, marble plinth. |
| `components/gallery3d/README.md` | modify | Rewritten at the end. |

---

### Task 1: Tooling and baseline stills

**Files:**
- Create: `vitest.config.ts`, `scripts/shots.mjs`
- Modify: `package.json`, `.gitignore`, `components/gallery3d/engine.ts` (`pickQuality`, debug hook)

**Interfaces:**
- Produces: `npm test`; `node scripts/shots.mjs --out=<dir> [--base=<url>] [--q=low|high] [--center]`; URL flags `?g3q=low|high` and `?g3debug`; with `g3debug`, `canvas.dataset.g3frames` (frame counter) and `window.__g3 = { renderer }`.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev vitest@^2 playwright@^1.48 sharp@^0.33
npx playwright install chromium
```

- [ ] **Step 2: Add scripts and ignore the stills folder**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"shots": "node scripts/shots.mjs",
"capture": "node scripts/capture-gallery.mjs",
"textures": "node scripts/fetch-textures.mjs"
```

Append to `.gitignore`:

```
.stills/
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { include: ['components/**/*.test.ts'], environment: 'node', passWithNoTests: true },
});
```

- [ ] **Step 4: Add the quality override and debug hook to the engine**

In `components/gallery3d/engine.ts`, replace `pickQuality` with:

```ts
function pickQuality(): Quality {
  // ?g3q=low|high forces a tier, for testing.
  const forced = new URLSearchParams(window.location.search).get('g3q');
  if (forced === 'low' || forced === 'high') return forced;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const smallTouch =
    window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600;
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || smallTouch ? 'low' : 'high';
}
```

In `start()`, directly after `let ready = false;`, add:

```ts
    // ?g3debug exposes a frame counter and the renderer to the test scripts.
    const debug = new URLSearchParams(window.location.search).has('g3debug');
    let frameCount = 0;
    if (debug) (window as unknown as { __g3?: unknown }).__g3 = { renderer };
```

In `frame()`, directly after `renderer.render(scene, camera);`, add:

```ts
      if (debug) canvas.dataset.g3frames = String(++frameCount);
```

- [ ] **Step 5: Create `scripts/shots.mjs`**

```js
// Stills at fixed stops in both themes, for before / after comparison.
// Usage: node scripts/shots.mjs --out=.stills/baseline [--base=http://localhost:4173] [--q=low] [--center]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const base = arg('base', 'http://localhost:4173');
const out = arg('out', '.stills/current');
const quality = arg('q', '');
const center = flag('center');
const STOPS = ['', 'citcd', 'phet-remaster', 'centerpiece', 'door'];
const PIECES = new Set(['citcd', 'phet-remaster']);

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const stop of STOPS) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        reducedMotion: 'no-preference',
      });
      await context.addInitScript((t) => {
        localStorage.setItem('gtheme', t);
        localStorage.removeItem('gmode');
      }, theme);
      const page = await context.newPage();
      const query = `?g3debug${quality ? `&g3q=${quality}` : ''}`;
      await page.goto(`${base}/${query}${stop ? `#${stop}` : ''}`);
      await page.waitForSelector('html[data-g3="live"]', { timeout: 30000 });
      await page.waitForTimeout(stop === 'centerpiece' ? 5000 : 3500);
      // A work's link opens facing it; --center steps back to the centre line.
      if (center && PIECES.has(stop)) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(1500);
      }
      const file = path.join(out, `${theme}-${stop || 'intro'}${center && PIECES.has(stop) ? '-center' : ''}.png`);
      await page.screenshot({ path: file });
      console.log(file);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
```

- [ ] **Step 6: Run the gates**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all pass; vitest reports "No test files found" and exits 0.

- [ ] **Step 7: Capture baseline stills**

```bash
npx serve out -l 4173 &
SERVE_PID=$!
sleep 2
node scripts/shots.mjs --out=.stills/baseline
node scripts/shots.mjs --out=.stills/baseline --center
kill $SERVE_PID
```

Expected: 14 PNG paths printed. Read `.stills/baseline/light-citcd-center.png` and confirm it shows the corridor with a work to one side. These are the "before" images for every later comparison.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore vitest.config.ts scripts/shots.mjs components/gallery3d/engine.ts
git commit -m "chore(gallery): test runner, stills script and tier override"
```

---

### Task 2: Side arrow on the floor with distance fade

**Files:**
- Create: `components/gallery3d/logic/arrowFade.ts`, `components/gallery3d/logic/arrowFade.test.ts`
- Modify: `components/gallery3d/contract.ts` (stops), `components/gallery3d/scene/navArrows.ts`

**Interfaces:**
- Produces:
  - `ARROW_FADE: { far: 6.4; near: 5.2; aheadMin: 1.5; aheadFull: 2.6; hitMin: 0.3; maxX: 2.4 }`
  - `arrowOpacity(distance: number, ahead: number, reducedMotion?: boolean): number`
  - `arrowHittable(opacity: number): boolean`
  - `arrowFloorX(aspect: number, depth: number): number`
  - `STAND_BACK = 3.6` exported from `contract.ts`

Background: `distance` is the horizontal distance from the camera to the work's point on the wall; `ahead` is how far the work is in front of the camera along the corridor (`camera.z - work.z`, positive while approaching). The camera looks down the gallery with a 58 degree vertical field of view, so floor nearer than about 3m is off screen.

- [ ] **Step 1: Write the failing tests**

`components/gallery3d/logic/arrowFade.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ARROW_FADE, arrowFloorX, arrowHittable, arrowOpacity } from './arrowFade';

describe('arrowOpacity', () => {
  it('is fully visible at the stand point (3.6m back, 3.5m across)', () => {
    expect(arrowOpacity(Math.hypot(3.5, 3.6), 3.6)).toBe(1);
  });
  it('is invisible from the previous stand point', () => {
    expect(arrowOpacity(Math.hypot(3.5, 7.6), 7.6)).toBe(0);
  });
  it('is half visible midway through the distance ramp', () => {
    expect(arrowOpacity((ARROW_FADE.near + ARROW_FADE.far) / 2, 4.6)).toBeCloseTo(0.5, 5);
  });
  it('fades out while walking past the work', () => {
    expect(arrowOpacity(3.6, 1.0)).toBe(0);
    expect(arrowOpacity(4.0, (ARROW_FADE.aheadMin + ARROW_FADE.aheadFull) / 2)).toBeCloseTo(0.5, 5);
  });
  it('never increases as distance grows', () => {
    let last = 1;
    for (let d = 4; d <= 9; d += 0.1) {
      const o = arrowOpacity(d, 5);
      expect(o).toBeLessThanOrEqual(last + 1e-9);
      last = o;
    }
  });
  it('is zero for non-finite input', () => {
    expect(arrowOpacity(NaN, 3)).toBe(0);
    expect(arrowOpacity(5, Infinity)).toBe(0);
  });
  it('is all or nothing under reduced motion', () => {
    expect(arrowOpacity(5.0, 3.6, true)).toBe(1);
    expect(arrowOpacity(5.8, 4.6, true)).toBe(0);
    expect(arrowOpacity(3.6, 1.0, true)).toBe(0);
  });
});

describe('arrowHittable', () => {
  it('needs at least 0.3 opacity', () => {
    expect(arrowHittable(0.29)).toBe(false);
    expect(arrowHittable(0.3)).toBe(true);
  });
});

describe('arrowFloorX', () => {
  it('sits 2.4m out on a wide screen', () => {
    expect(arrowFloorX(16 / 9, 3.6)).toBe(ARROW_FADE.maxX);
  });
  it('moves in on a narrower landscape window', () => {
    expect(arrowFloorX(1.3, 3.6)).toBeCloseTo(1.87, 1);
  });
  it('stays inside the visible floor on a portrait phone', () => {
    const aspect = 390 / 844;
    const halfVisible = 3.6 * Math.tan((76 / 2) * (Math.PI / 180)) * aspect;
    const x = arrowFloorX(aspect, 3.6);
    expect(x).toBeGreaterThan(0.5);
    expect(x + 0.2).toBeLessThan(halfVisible);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run components/gallery3d/logic/arrowFade.test.ts`
Expected: FAIL, cannot resolve `./arrowFade`.

- [ ] **Step 3: Implement `components/gallery3d/logic/arrowFade.ts`**

```ts
// When the side arrow (the floor marker that leads to a work) is visible, and
// where on the floor it lies. Pure: no three.js, no DOM.

export const ARROW_FADE = {
  /** Camera-to-work distance (m): invisible beyond `far`, fully visible within `near`. */
  far: 6.4,
  near: 5.2,
  /** Metres the work is still ahead of the camera: gone below `aheadMin`, full above `aheadFull`. */
  aheadMin: 1.5,
  aheadFull: 2.6,
  /** Opacity below which the arrow cannot be clicked. */
  hitMin: 0.3,
  /** Furthest the arrow lies from the corridor centre line (m). */
  maxX: 2.4,
} as const;

// Vertical field of view while looking down the gallery: landscape (50 + 8 ahead) and portrait.
const FOV_LANDSCAPE = 58;
const FOV_PORTRAIT = 76;
const ASPECT_LANDSCAPE = 1.3;
const ASPECT_PORTRAIT = 0.6;
/** Share of the visible half-width the arrow may use, leaving room for its own radius. */
const FRAME_SHARE = 0.72;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const ramp = (v: number, lo: number, hi: number) => smooth(clamp01((v - lo) / (hi - lo)));

export function arrowOpacity(distance: number, ahead: number, reducedMotion = false): number {
  if (!Number.isFinite(distance) || !Number.isFinite(ahead)) return 0;
  if (reducedMotion) return distance <= ARROW_FADE.near && ahead >= ARROW_FADE.aheadFull ? 1 : 0;
  return (1 - ramp(distance, ARROW_FADE.near, ARROW_FADE.far)) * ramp(ahead, ARROW_FADE.aheadMin, ARROW_FADE.aheadFull);
}

export function arrowHittable(opacity: number): boolean {
  return opacity >= ARROW_FADE.hitMin;
}

/** Distance from the centre line (m) at which the arrow lies, `depth` metres ahead of the camera. */
export function arrowFloorX(aspect: number, depth: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(depth) || depth <= 0) return ARROW_FADE.maxX;
  const portrait = clamp01((ASPECT_LANDSCAPE - aspect) / (ASPECT_LANDSCAPE - ASPECT_PORTRAIT));
  const fov = FOV_LANDSCAPE + (FOV_PORTRAIT - FOV_LANDSCAPE) * portrait;
  const halfVisible = depth * Math.tan((fov / 2) * (Math.PI / 180)) * aspect;
  return Math.min(ARROW_FADE.maxX, FRAME_SHARE * halfVisible);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run components/gallery3d/logic/arrowFade.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Move the stand point in `contract.ts`**

Directly above `export const stops: Stop[] = [`, add:

```ts
/** How far before a work, on the centre line, the visitor stops (m). The floor
 *  level with the work must be in frame from here; see logic/arrowFade.ts. */
export const STAND_BACK = 3.6;
```

In the `pieces.map` block, replace `aheadCam: [0, EYE, s.position[2] + 3.2],` with:

```ts
      aheadCam: [0, EYE, s.position[2] + STAND_BACK],
```

- [ ] **Step 6: Rework the side marker in `navArrows.ts`**

a. Add to the `'../contract'` import list: `STAND_BACK,`. Add below that import:

```ts
import { arrowFloorX, arrowHittable, arrowOpacity } from '../logic/arrowFade';
```

b. Replace `const side = make(0.4, 0.4, true, 1, false);` with:

```ts
  // Lies on the floor level with the work (depth-tested, like the forward disc).
  const side = make(0.4, 0.4, true, 1, true);
```

c. Below `let curFacing = false;`, add:

```ts
  let sideIdx = -1;
  let sideVis = 0;
  let sideAspect = NaN;
```

d. Above `function layout(`, add:

```ts
  function placeSide(idx: number) {
    sideIdx = idx;
    sideAspect = ctx.camera.aspect;
    const slot = pieceSlot(at(idx).pieceIndex ?? 0);
    side.root.position.set(slot.side * arrowFloorX(sideAspect, STAND_BACK), FLOOR_Y, slot.position[2]);
    // Chevron points at the wall the work hangs on.
    side.root.rotation.y = yawOf(slot.side, 0);
    side.chev.rotation.z = 0;
    side.body.rotation.x = -Math.PI / 2;
    side.root.updateMatrixWorld(true);
  }
```

e. In `layout()`, delete the line `side.on = s.kind === 'piece' && !facing;`.

f. In `placeScreen()`, delete the whole `if (side.on) { ... }` block (the one beginning with the comment "The floor beside the visitor is out of frame").

g. In `applyAll()`, replace the `for (const m of markers) { ... }` loop with:

```ts
    for (const m of markers) {
      // The side arrow is fixed in the world and fades by distance, not by settling.
      const k = m === side ? sideVis : vis;
      const v = m.on && k > 0.001;
      m.root.visible = v;
      m.hit.visible = v && (m !== side || (settled && arrowHittable(sideVis)));
      if (!v) continue;
      const base = pal.discA * m.dk;
      m.discMat.opacity = (m.hover ? Math.min(0.8, base + 0.25) : base) * k;
      m.ringMat.opacity = pal.ringA * k;
      m.chevMat.opacity = pal.chevA * k;
    }
```

h. In `update()`, replace everything from `const target = nowSettled ? 1 : 0;` to the end of the function with:

```ts
    // Side arrow: belongs to the nearest work, fades with true distance to it.
    const camNow = ctx.camera;
    const wantIdx = at(idx).kind === 'piece' && !facing ? idx : -1;
    if (wantIdx >= 0 && (wantIdx !== sideIdx || camNow.aspect !== sideAspect)) placeSide(wantIdx);
    let sideTo = 0;
    if (wantIdx >= 0) {
      const slot = pieceSlot(at(wantIdx).pieceIndex ?? 0);
      const ahead = camNow.position.z - slot.position[2];
      sideTo = arrowOpacity(Math.hypot(camNow.position.x - slot.position[0], ahead), ahead, reduced);
    }
    if (reduced) sideVis = sideTo;
    else {
      sideVis += (sideTo - sideVis) * (1 - Math.exp(-dt * 12));
      if (Math.abs(sideTo - sideVis) < 0.004) sideVis = sideTo;
    }
    side.on = sideVis > 0.001 || sideTo > 0;

    const target = nowSettled ? 1 : 0;
    if (reduced) vis = target;
    else if (vis !== target) {
      const step = dt / (target > vis ? FADE_IN : FADE_OUT);
      vis = target > vis ? Math.min(target, vis + step) : Math.max(target, vis - step);
    }
    applyAll();
    return vis !== target || sideVis !== sideTo;
```

- [ ] **Step 7: Run the gates**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all pass.

- [ ] **Step 8: Check the arrow in the browser**

```bash
npx serve out -l 4173 & SERVE_PID=$!; sleep 2
node scripts/shots.mjs --out=.stills/arrows --center
kill $SERVE_PID
```

Read `.stills/arrows/light-citcd-center.png` and `.stills/arrows/dark-citcd-center.png`. Expected: one disc with a chevron lying flat on the floor on the work's side, pointing at the wall, fully inside the frame; the forward disc still on the centre line. Read `.stills/arrows/light-intro.png`. Expected: no side arrow. If the side arrow touches the bottom edge of the frame, raise `STAND_BACK` to 3.8 and re-run.

- [ ] **Step 9: Check the portrait viewport and mid-walk**

Write `.stills/check-arrows.mjs`:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
await context.addInitScript(() => localStorage.removeItem('gmode'));
const page = await context.newPage();
await page.goto('http://localhost:4173/?g3debug#citcd');
await page.waitForSelector('html[data-g3="live"]');
await page.waitForTimeout(3500);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(1500);
await page.screenshot({ path: '.stills/arrows/portrait-citcd-center.png' });
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(350);
await page.screenshot({ path: '.stills/arrows/portrait-midwalk.png' });
await browser.close();
```

Run it with the server up (`npx serve out -l 4173 &` then `node .stills/check-arrows.mjs`). Read both images. Expected: at rest the side arrow is wholly on screen; mid-walk the arrow for the work being left is faded or gone and none sits at the screen edge.

- [ ] **Step 10: Commit**

```bash
git add components/gallery3d/logic components/gallery3d/contract.ts components/gallery3d/scene/navArrows.ts
git commit -m "feat(gallery): side arrow lies by the work and fades with distance"
```

---

### Task 3: Recapture the screenshots at 2400px

**Files:**
- Create: `scripts/capture-gallery.mjs`
- Create (generated): `public/gallery/<id>.webp`, `public/gallery/<id>-1200.webp` for the nine works and `apache-tandoori`

**Interfaces:**
- Produces: for every `image: '/gallery/<id>.jpg'` in `data/gallery.ts`, the files `/gallery/<id>.webp` (2400px wide) and `/gallery/<id>-1200.webp`. The JPEGs are left in place.

- [ ] **Step 1: Create `scripts/capture-gallery.mjs`**

```js
// Recaptures every site in data/gallery.ts at 2400px wide.
// Usage: node scripts/capture-gallery.mjs [--base=http://localhost:4173] [--only=id,id]
// Relative hrefs are resolved against --base, so serve ./out first.
// A site that fails is skipped and its old files are kept; exit code 1 lists the failures.
import { rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { centerpiece, pieces } from '../data/gallery.ts';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const base = arg('base', 'http://localhost:4173');
const only = arg('only', '').split(',').filter(Boolean);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LARGE = 2400;
const SMALL = 1200;
const MIN_BYTES = 20_000;

const jobs = [...pieces, centerpiece]
  .map((p) => ({ id: path.basename(p.image, path.extname(p.image)), href: p.href, image: p.image }))
  .filter((j) => !only.length || only.includes(j.id));

const failures = [];
const browser = await chromium.launch();
try {
  for (const job of jobs) {
    const url = new URL(job.href, base).toString();
    const dir = path.join(root, 'public', path.dirname(job.image));
    const large = path.join(dir, `${job.id}.webp`);
    const small = path.join(dir, `${job.id}-1200.webp`);
    const tmpLarge = `${large}.tmp`;
    const tmpSmall = `${small}.tmp`;
    try {
      // Same viewport width and crop height as the image being replaced.
      const old = await sharp(path.join(root, 'public', job.image)).metadata();
      const scale = LARGE / old.width;
      const context = await browser.newContext({
        viewport: { width: old.width, height: Math.min(old.height, 1400) },
        deviceScaleFactor: scale,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      if (!response || !response.ok()) throw new Error(`HTTP ${response ? response.status() : 'no response'}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      const shot = await page.screenshot({ type: 'png', fullPage: true });
      await context.close();

      const meta = await sharp(shot).metadata();
      const height = Math.min(meta.height, Math.round(old.height * scale));
      if (height < Math.round(old.height * scale)) {
        console.warn(`  ${job.id}: page is shorter than the old crop (${meta.height}px < ${Math.round(old.height * scale)}px)`);
      }
      const cropped = sharp(shot).extract({ left: 0, top: 0, width: Math.min(meta.width, LARGE), height });
      await cropped.clone().webp({ quality: 82 }).toFile(tmpLarge);
      await cropped.clone().resize({ width: SMALL }).webp({ quality: 80 }).toFile(tmpSmall);
      for (const file of [tmpLarge, tmpSmall]) {
        if ((await stat(file)).size < MIN_BYTES) throw new Error('capture is nearly empty');
      }
      await rename(tmpLarge, large);
      await rename(tmpSmall, small);
      console.log(`${job.id}: ${url}\n  ${large} (${Math.round((await stat(large)).size / 1024)} KB)\n  ${small}`);
    } catch (err) {
      await rm(tmpLarge, { force: true });
      await rm(tmpSmall, { force: true });
      failures.push(`${job.id} (${url}): ${err.message}`);
      console.error(`${job.id}: FAILED, old image kept. ${err.message}`);
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`\n${failures.length} capture(s) failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
```

- [ ] **Step 2: Check the failure path first**

Run: `node scripts/capture-gallery.mjs --base=http://localhost:9 --only=citcd; echo "exit=$?"`
Expected: `citcd: FAILED, old image kept.` and `exit=1`. Run `ls public/gallery/citcd*`. Expected: only `citcd.jpg`.

- [ ] **Step 3: Capture everything**

```bash
npm run build
npx serve out -l 4173 & SERVE_PID=$!; sleep 2
node scripts/capture-gallery.mjs; echo "exit=$?"
kill $SERVE_PID
```

Expected: ten ids printed, each with two paths, `exit=0`. If an external site fails, re-run with `--only=<id>` once; if it still fails leave it (the 3D view falls back to the JPEG) and report the id.

- [ ] **Step 4: Check sizes**

Run: `ls -la public/gallery/*.webp`
Expected: each `<id>.webp` under about 600 KB. If one is over 700 KB, re-encode it at lower quality: `node -e "require('sharp')('public/gallery/ID.webp').webp({quality:72}).toFile('public/gallery/ID.q.webp')"` then `mv public/gallery/ID.q.webp public/gallery/ID.webp`.

- [ ] **Step 5: Owner review gate**

Read each `public/gallery/<id>-1200.webp` and confirm it shows the intended site, not an error page, cookie wall or blank frame. Then stop and ask the owner to look through `public/gallery/*.webp` before committing. Do not commit captures the owner has not seen.

- [ ] **Step 6: Tandoori logo**

Run: `find . -path ./node_modules -prune -o -iname '*tandoori*' -print` and check pixel sizes with `sips -g pixelWidth <file>`. If a version at least 512px wide exists, write it over the 144px file: `node -e "require('sharp')('SOURCE').resize({width:512}).png().toFile('public/gallery/tandoori-logo.png')"`. If none exists, leave the file and add this line to the "Open items" list in `components/gallery3d/README.md`: `- The Tandoori logo on the plaque is 144px; supply a larger source.`

- [ ] **Step 7: Commit**

```bash
git add scripts/capture-gallery.mjs public/gallery components/gallery3d/README.md
git commit -m "feat(gallery): recapture site screenshots at 2400px"
```

---

### Task 4: Tiered artwork loading

**Files:**
- Create: `components/gallery3d/logic/artworkTiers.ts`, `components/gallery3d/logic/artworkTiers.test.ts`
- Modify: `components/gallery3d/scene/artworks.ts` (`Painting` type, loading section, `update`, `dispose`), `components/gallery3d/scene/centerpiece.ts` (screen image load)

**Interfaces:**
- Consumes: files from Task 3.
- Produces:
  - `artworkSources(image: string): { small: string; large: string; fallback: string }`
  - `MAX_LARGE = 3`
  - `wantedLarge(focus: number, pieceCount: number, quality: Quality): number[]` (piece indices, most wanted first; piece `i` is stop `i + 1`)
  - `planLarge(live: readonly number[], wanted: readonly number[]): { load: number[]; drop: number[] }`

- [ ] **Step 1: Write the failing tests**

`components/gallery3d/logic/artworkTiers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_LARGE, artworkSources, planLarge, wantedLarge } from './artworkTiers';

describe('artworkSources', () => {
  it('derives the WebP tiers from the JPEG path', () => {
    expect(artworkSources('/gallery/citcd.jpg')).toEqual({
      small: '/gallery/citcd-1200.webp',
      large: '/gallery/citcd.webp',
      fallback: '/gallery/citcd.jpg',
    });
  });
});

describe('wantedLarge', () => {
  it('wants the current work and its neighbours, current first', () => {
    expect(wantedLarge(3, 9, 'high')).toEqual([2, 3, 1]);
  });
  it('follows the nearest stop while walking', () => {
    expect(wantedLarge(3.4, 9, 'high')).toEqual([2, 3, 1]);
    expect(wantedLarge(3.6, 9, 'high')).toEqual([3, 4, 2]);
  });
  it('wants only the first work at the intro', () => {
    expect(wantedLarge(0, 9, 'high')).toEqual([0]);
  });
  it('wants only the last work at the centrepiece, none at the door', () => {
    expect(wantedLarge(10, 9, 'high')).toEqual([8]);
    expect(wantedLarge(11, 9, 'high')).toEqual([]);
  });
  it('wants nothing on the low tier or for bad input', () => {
    expect(wantedLarge(3, 9, 'low')).toEqual([]);
    expect(wantedLarge(NaN, 9, 'high')).toEqual([]);
    expect(wantedLarge(3, 0, 'high')).toEqual([]);
  });
});

describe('planLarge', () => {
  it('loads what is newly wanted and drops what is not', () => {
    expect(planLarge([1, 2, 3], [2, 3, 4])).toEqual({ load: [4], drop: [1] });
  });
  it('never leaves more than MAX_LARGE alive, whatever the route', () => {
    let live: number[] = [];
    const route = [0, 1, 2, 3, 11, 0, 10, 5, 5.5, 6, 2, 9, 11, 1];
    for (const focus of route) {
      const wanted = wantedLarge(focus, 9, 'high');
      const { load, drop } = planLarge(live, wanted);
      live = live.filter((i) => !drop.includes(i)).concat(load);
      expect(live.length).toBeLessThanOrEqual(MAX_LARGE);
      expect([...live].sort()).toEqual([...wanted].sort());
    }
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run components/gallery3d/logic/artworkTiers.test.ts`
Expected: FAIL, cannot resolve `./artworkTiers`.

- [ ] **Step 3: Implement `components/gallery3d/logic/artworkTiers.ts`**

```ts
// Which image file a work shows. Every work gets the 1200px image; only the
// work the visitor is at and its two neighbours hold the 2400px one.
import type { Quality } from '../contract';

export const MAX_LARGE = 3;

export function artworkSources(image: string): { small: string; large: string; fallback: string } {
  const stem = image.replace(/\.[a-z0-9]+$/i, '');
  return { small: `${stem}-1200.webp`, large: `${stem}.webp`, fallback: image };
}

/** Piece indices that should hold a 2400px texture, most wanted first. Piece i is stop i + 1. */
export function wantedLarge(focus: number, pieceCount: number, quality: Quality): number[] {
  if (quality === 'low' || !Number.isFinite(focus) || pieceCount <= 0) return [];
  const current = Math.round(focus) - 1;
  return [current, current + 1, current - 1].filter((i) => i >= 0 && i < pieceCount).slice(0, MAX_LARGE);
}

export function planLarge(live: readonly number[], wanted: readonly number[]): { load: number[]; drop: number[] } {
  return {
    load: wanted.filter((i) => !live.includes(i)),
    drop: live.filter((i) => !wanted.includes(i)),
  };
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run components/gallery3d/logic/artworkTiers.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Wire tiers into `artworks.ts`**

a. Add the import below the existing imports:

```ts
import { artworkSources, planLarge, wantedLarge } from '../logic/artworkTiers';
```

b. In the `Painting` type, below `loaded: boolean;`, add:

```ts
  small: THREE.Texture | null;
  large: THREE.Texture | null;
  largeLoading: boolean;
```

c. In `buildPainting`, in the `painting` object literal, below `loaded: false,`, add:

```ts
      small: null,
      large: null,
      largeLoading: false,
```

d. Directly above `const paintings = pieces.map(buildPainting);`, add (these must sit above the `return` statement; the functions below are hoisted, plain variables are not):

```ts
  const loader = new THREE.TextureLoader();
  let tierKey = NaN;
```

e. Replace the whole `loadNearestFirst` function with:

```ts
  function prepare(tex: THREE.Texture): void {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
  }

  function loadNearestFirst(): void {
    const eye = ctx.camera.position;
    const queue = paintings.slice().sort((a, b) => a.root.position.distanceToSquared(eye) - b.root.position.distanceToSquared(eye));
    let cursor = 0;

    const next = (): void => {
      if (disposed || cursor >= queue.length) return;
      const p = queue[cursor++];
      const src = artworkSources(p.piece.image);
      const arrived = (tex: THREE.Texture): void => {
        if (disposed) {
          tex.dispose();
          return;
        }
        track(tex);
        prepare(tex);
        p.small = tex;
        p.canvas.material.uniforms.map.value = p.large ?? tex;
        p.loaded = true;

        const image = tex.image as { width?: number; height?: number } | undefined;
        const aspect = image?.width && image?.height ? image.width / image.height : DEFAULT_ASPECT;
        p.from = p.size;
        p.to = fitSize(aspect);
        p.sizeT = 0;
        ctx.invalidate();
        next();
      };
      // No WebP (capture failed): the original JPEG. No JPEG either: a primed canvas stays on the wall.
      loader.load(src.small, arrived, undefined, () => loader.load(src.fallback, arrived, undefined, () => next()));
    };
    for (let i = 0; i < CONCURRENT_LOADS; i++) next();
  }

  // ── 2400px tier ───────────────────────────────────────────────────────────

  function syncLarge(focus: number): void {
    const key = Math.round(focus);
    if (key === tierKey) return;
    tierKey = key;
    const live = paintings.filter((p) => p.large || p.largeLoading).map((p) => p.index);
    const { load, drop } = planLarge(live, wantedLarge(focus, paintings.length, ctx.quality));
    for (const i of drop) dropLarge(paintings[i]);
    for (const i of load) loadLarge(paintings[i]);
  }

  function dropLarge(p: Painting): void {
    p.largeLoading = false;
    if (!p.large) return;
    // Never leave the canvas pointing at a disposed texture.
    p.canvas.material.uniforms.map.value = p.small;
    p.large.dispose();
    p.large = null;
    ctx.invalidate();
  }

  function loadLarge(p: Painting): void {
    p.largeLoading = true;
    loader.load(
      artworkSources(p.piece.image).large,
      (tex) => {
        // Dropped, or already satisfied by an earlier request, while this one was in flight.
        if (disposed || !p.largeLoading || p.large) {
          tex.dispose();
          return;
        }
        p.largeLoading = false;
        prepare(tex);
        p.large = tex;
        if (p.loaded) p.canvas.material.uniforms.map.value = tex;
        ctx.invalidate();
      },
      undefined,
      () => {
        p.largeLoading = false; // the 1200px image stays
      },
    );
  }
```

f. In `update`, directly after `if (disposed) return false;`, add:

```ts
    syncLarge(focus);
```

g. In `dispose`, directly after `disposed = true;`, add:

```ts
    for (const p of paintings) {
      p.large?.dispose();
      p.large = null;
    }
```

- [ ] **Step 6: Centrepiece screen image**

In `components/gallery3d/scene/centerpiece.ts`, add the import:

```ts
import { artworkSources } from '../logic/artworkTiers';
```

Replace the block `loader.load(centerpiece.image, (tex) => { ... });` (it ends with `ctx.invalidate();` then `});`) with:

```ts
  const screenArrived = (tex: THREE.Texture) => {
    if (disposed) {
      tex.dispose();
      return;
    }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    screenTex = tex;
    screenMat.map = tex;
    screenMat.color.set(0xffffff);
    screenMat.needsUpdate = true;
    ctx.invalidate();
  };
  const screenSrc = artworkSources(centerpiece.image);
  loader.load(low ? screenSrc.small : screenSrc.large, screenArrived, undefined, () =>
    loader.load(screenSrc.fallback, screenArrived),
  );
```

- [ ] **Step 7: Run the gates**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all pass.

- [ ] **Step 8: Check tier loading in the browser**

Write `.stills/check-tiers.mjs`:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
await context.addInitScript(() => localStorage.removeItem('gmode'));
const page = await context.newPage();
const large = new Set();
const errors = [];
page.on('request', (r) => { if (/\/gallery\/[a-z-]+\.webp$/.test(r.url()) && !/-1200\.webp$/.test(r.url())) large.add(r.url().split('/').pop()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4173/?g3debug&g3q=high#citcd');
await page.waitForSelector('html[data-g3="live"]');
await page.waitForTimeout(4000);
console.log('at citcd:', [...large].sort().join(', '));
await page.keyboard.press('End');
await page.waitForTimeout(5000);
await page.keyboard.press('Home');
await page.waitForTimeout(5000);
console.log('after End/Home:', [...large].sort().join(', '));
console.log('textures:', await page.evaluate(() => window.__g3.renderer.info.memory.textures));
console.log('errors:', errors.length ? errors : 'none');
await page.screenshot({ path: '.stills/tiers-home.png' });
await browser.close();
```

Run with the server up. Expected: `at citcd:` lists `abraar-academy.webp, build-imara.webp, citcd.webp` (the work and its neighbours); `errors: none`; the screenshot shows the gallery, with no black or missing canvases. Then run again with `g3q=low` in the URL. Expected: both lists empty.

- [ ] **Step 9: Commit**

```bash
git add components/gallery3d/logic components/gallery3d/scene/artworks.ts components/gallery3d/scene/centerpiece.ts
git commit -m "feat(gallery): tiered artwork images, 2400px near the visitor"
```

---

### Task 5: Pixel ratio follows zoom

**Files:**
- Create: `components/gallery3d/logic/pixelRatio.ts`, `components/gallery3d/logic/pixelRatio.test.ts`
- Modify: `components/gallery3d/engine.ts` (`TUNING`, `resize`, lifecycle listeners)

**Interfaces:**
- Produces:
  - `DPR: { low: 1.5; max: 4; pixels: 8_000_000; pixelsZoomed: 12_000_000; step: 0.25 }`
  - `pickPixelRatio(input: { device: number; viewportScale: number; quality: Quality; cssWidth: number; cssHeight: number; penalty?: number }): number`
  - In the engine: `let dprPenalty = 0` and `let currentDpr = 1`, read by Task 11.

- [ ] **Step 1: Write the failing tests**

`components/gallery3d/logic/pixelRatio.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickPixelRatio } from './pixelRatio';

const hi = { quality: 'high' as const, viewportScale: 1, cssWidth: 1440, cssHeight: 900 };

describe('pickPixelRatio', () => {
  it('caps the low tier at 1.5', () => {
    expect(pickPixelRatio({ ...hi, quality: 'low', device: 3 })).toBe(1.5);
    expect(pickPixelRatio({ ...hi, quality: 'low', device: 1 })).toBe(1);
  });
  it('renders a retina laptop at its device ratio', () => {
    expect(pickPixelRatio({ ...hi, device: 2 })).toBe(2);
  });
  it('follows browser zoom, which shrinks the CSS size as it raises the ratio', () => {
    expect(pickPixelRatio({ ...hi, device: 4, cssWidth: 720, cssHeight: 450 })).toBe(4);
  });
  it('never exceeds 4', () => {
    expect(pickPixelRatio({ ...hi, device: 6, cssWidth: 480, cssHeight: 300 })).toBe(4);
  });
  it('holds a large window to 8 megapixels', () => {
    expect(pickPixelRatio({ ...hi, device: 2, cssWidth: 1920, cssHeight: 1080 })).toBe(1.96);
  });
  it('allows 12 megapixels while pinch-zoomed', () => {
    expect(pickPixelRatio({ ...hi, device: 2, viewportScale: 2 })).toBe(3.04);
  });
  it('steps down by 0.25 per penalty, never below min(device, 1)', () => {
    expect(pickPixelRatio({ ...hi, device: 4, cssWidth: 720, cssHeight: 450, penalty: 2 })).toBe(3.5);
    expect(pickPixelRatio({ ...hi, device: 1, penalty: 10 })).toBe(1);
    expect(pickPixelRatio({ ...hi, device: 0.8, penalty: 10 })).toBe(0.8);
  });
  it('survives a zero-size canvas and a missing device ratio', () => {
    const r = pickPixelRatio({ quality: 'high', device: NaN, viewportScale: NaN, cssWidth: 0, cssHeight: 0 });
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBe(1);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run components/gallery3d/logic/pixelRatio.test.ts`
Expected: FAIL, cannot resolve `./pixelRatio`.

- [ ] **Step 3: Implement `components/gallery3d/logic/pixelRatio.ts`**

```ts
// How many device pixels per CSS pixel the canvas renders at.
//
// Browser zoom raises devicePixelRatio and shrinks the CSS size by the same
// factor, so rendering at the full device ratio costs the same pixels as
// before. The cap is therefore a pixel budget, not a ratio.
import type { Quality } from '../contract';

export const DPR = {
  low: 1.5,
  max: 4,
  pixels: 8_000_000,
  /** Budget while the page is pinch-zoomed: sharper at a cost the frame monitor can take back. */
  pixelsZoomed: 12_000_000,
  /** Ratio given up per step-down. */
  step: 0.25,
} as const;

export type DprInput = {
  device: number;
  /** window.visualViewport.scale: above 1 while pinch-zoomed. */
  viewportScale: number;
  quality: Quality;
  cssWidth: number;
  cssHeight: number;
  /** Step-downs applied so far (see qualityStepDown.ts). */
  penalty?: number;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

export function pickPixelRatio(input: DprInput): number {
  const device = Number.isFinite(input.device) && input.device > 0 ? input.device : 1;
  if (input.quality === 'low') return Math.min(device, DPR.low);
  const scale = Number.isFinite(input.viewportScale) && input.viewportScale > 1 ? input.viewportScale : 1;
  const area = Math.max(1, input.cssWidth * input.cssHeight || 0);
  const budget = scale > 1.05 ? DPR.pixelsZoomed : DPR.pixels;
  const wanted = Math.min(device * scale, DPR.max, Math.sqrt(budget / area));
  return round2(Math.max(Math.min(device, 1), wanted - (input.penalty ?? 0) * DPR.step));
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run components/gallery3d/logic/pixelRatio.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Use it in the engine**

a. Add to the static imports at the top of `engine.ts`:

```ts
import { pickPixelRatio } from './logic/pixelRatio';
```

b. In `TUNING`, delete the two lines `dprLow: 1.5,` and `dprHigh: 2,`.

c. In `start()`, directly above `let sized = '';`, add:

```ts
    let dprPenalty = 0;
    let currentDpr = 1;
```

d. In `resize`, replace the line that begins `const dpr = Math.min(window.devicePixelRatio || 1,` with:

```ts
      const dpr = pickPixelRatio({
        device: window.devicePixelRatio || 1,
        viewportScale: window.visualViewport?.scale ?? 1,
        quality,
        cssWidth: w,
        cssHeight: h,
        penalty: dprPenalty,
      });
      currentDpr = dpr;
```

e. In the lifecycle section, directly above `listen(motion, 'change', () => {`, add:

```ts
    // Pinch zoom changes the visual viewport without resizing the canvas.
    if (window.visualViewport) listen(window.visualViewport, 'resize', resize);
```

`dprPenalty` is only reassigned in Task 11; leave it as `let`.

- [ ] **Step 6: Run the gates**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all pass.

- [ ] **Step 7: Check sharpness under zoom**

Write `.stills/check-zoom.mjs` (a 720×450 viewport at device ratio 4 is what a 1440×900 retina window reports at 200% browser zoom):

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [name, viewport, dsf] of [['100', { width: 1440, height: 900 }, 2], ['200', { width: 720, height: 450 }, 4]]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, reducedMotion: 'no-preference' });
  await context.addInitScript(() => localStorage.removeItem('gmode'));
  const page = await context.newPage();
  await page.goto('http://localhost:4173/?g3debug&g3q=high#citcd');
  await page.waitForSelector('html[data-g3="live"]');
  await page.waitForTimeout(4500);
  console.log(name, 'canvas buffer:', await page.evaluate(() => { const c = document.querySelector('canvas'); return `${c.width}x${c.height}`; }));
  await page.screenshot({ path: `.stills/zoom-${name}.png` });
  await context.close();
}
await browser.close();
```

Run with the server up. Expected: both lines print `2880x1800`. Before this task the 200% line would have printed `1440x900`. Read `.stills/zoom-200.png`: the wall plate text beside the work has clean edges, and the screenshot in the frame shows readable page text.

- [ ] **Step 8: Commit**

```bash
git add components/gallery3d/logic components/gallery3d/engine.ts
git commit -m "feat(gallery): pixel ratio follows browser and pinch zoom"
```

---

### Task 6: Scanned materials

**Files:**
- Create: `scripts/fetch-textures.mjs`, `components/gallery3d/render/materialLibrary.ts`
- Create (generated): `public/gallery/tex/{parquet,marble,plaster,velvet,walnut}/{color,normal,rough}-{hi,lo}.webp`, `public/gallery/tex/CREDITS.md`
- Modify: `components/gallery3d/contract.ts` (`SceneCtx`), `components/gallery3d/engine.ts` (`boot`, `start`), `components/gallery3d/scene/room.ts`, `components/gallery3d/scene/artworks.ts`, `components/gallery3d/scene/centerpiece.ts`

**Interfaces:**
- Produces:
  - `type SetName = 'parquet' | 'marble' | 'plaster' | 'velvet' | 'walnut'`
  - `type ApplyOptions = { repeat: [number, number]; keepMap?: boolean; color?: number; roughness?: number; normalScale?: number }`
  - `type MaterialLibrary = { apply(material: THREE.MeshStandardMaterial, name: SetName, options: ApplyOptions): void; dispose(): void }`
  - `createMaterialLibrary(renderer: THREE.WebGLRenderer, quality: Quality, onChange: () => void): MaterialLibrary`
  - `SceneCtx.materials: MaterialLibrary`
  - `SceneCtx.invalidateStatic: () => void` (in this task it only requests a frame; Task 7 gives it the bake)

`apply` is asynchronous and silent: the material keeps what it has until the set arrives, and keeps it forever if the set fails. `repeat` is in the surface's existing UV units. `keepMap` leaves the material's colour map (a painted pattern) and adds only normal and roughness.

- [ ] **Step 1: Create `scripts/fetch-textures.mjs`**

```js
// Downloads the CC0 texture sets from Poly Haven and writes WebP tiers.
// Usage: node scripts/fetch-textures.mjs
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'public', 'gallery', 'tex');
const BUDGET_HI = 3_300_000; // bytes, all hi-tier files together

const SETS = [
  { name: 'parquet', id: 'herringbone_parquet', hi: 2048, lo: 1024, use: 'corridor floor' },
  { name: 'marble', id: 'marble_01', hi: 1024, lo: 512, use: 'salon floor, dado, plinth' },
  { name: 'plaster', id: 'white_plaster_02', hi: 1024, lo: 512, use: 'walls, vault, dome' },
  { name: 'velvet', id: 'velour_velvet', hi: 512, lo: 512, use: 'salon walls, rope' },
  { name: 'walnut', id: 'walnut_veneer', hi: 1024, lo: 512, use: 'walnut frames' },
];
const MAPS = { color: 'Diffuse', normal: 'nor_gl', rough: 'Rough' };
const QUALITY = { color: 80, normal: 86, rough: 78 };

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
};
const getBuffer = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

let totalHi = 0;
let totalLo = 0;
const credits = ['# Texture credits', '', 'All sets are CC0 (public domain) from Poly Haven.', '', '| Folder | Asset | Used for | Source |', '|---|---|---|---|'];
for (const set of SETS) {
  const files = await getJson(`https://api.polyhaven.com/files/${set.id}`);
  const dir = path.join(outRoot, set.name);
  await mkdir(dir, { recursive: true });
  for (const [map, key] of Object.entries(MAPS)) {
    const url = files[key]?.['2k']?.jpg?.url;
    if (!url) throw new Error(`${set.id}: no 2k jpg for "${key}". Available: ${Object.keys(files).join(', ')}`);
    const source = await getBuffer(url);
    for (const [tier, px] of [['hi', set.hi], ['lo', set.lo]]) {
      const file = path.join(dir, `${map}-${tier}.webp`);
      await sharp(source).resize(px, px).webp({ quality: QUALITY[map] }).toFile(file);
      const { size } = await stat(file);
      if (tier === 'hi') totalHi += size;
      else totalLo += size;
      console.log(`${path.relative(root, file)}  ${px}px  ${Math.round(size / 1024)} KB`);
    }
  }
  credits.push(`| \`${set.name}/\` | ${set.id} | ${set.use} | https://polyhaven.com/a/${set.id} |`);
}
await writeFile(path.join(outRoot, 'CREDITS.md'), `${credits.join('\n')}\n`);
console.log(`\nhi tier: ${(totalHi / 1e6).toFixed(2)} MB   lo tier: ${(totalLo / 1e6).toFixed(2)} MB`);
if (totalHi > BUDGET_HI) {
  console.error(`hi tier is over the ${(BUDGET_HI / 1e6).toFixed(1)} MB budget: lower QUALITY and re-run.`);
  process.exit(1);
}
```

- [ ] **Step 2: Fetch the textures**

Run: `npm run textures`
Expected: 30 files listed, a totals line, exit 0. If it exits 1 on budget, lower each `QUALITY` value by 6 and re-run. Read `public/gallery/tex/parquet/color-lo.webp` and confirm it is a herringbone wood floor.

- [ ] **Step 3: Create `components/gallery3d/render/materialLibrary.ts`**

```ts
// Scanned PBR texture sets (colour, normal, roughness) for the room's surfaces.
// Sets load after first paint; a surface keeps its procedural texture until its
// set arrives, and for good if the set cannot be fetched.
import * as THREE from 'three';
import type { Quality } from '../contract';

export type SetName = 'parquet' | 'marble' | 'plaster' | 'velvet' | 'walnut';

export type ApplyOptions = {
  /** Texture repeats per unit of the surface's existing UVs. */
  repeat: [number, number];
  /** Keep the material's own colour map (a painted pattern); add only normal and roughness. */
  keepMap?: boolean;
  /** Tint applied when the scanned colour map replaces the painted one. */
  color?: number;
  /** Multiplier on the scanned roughness (default 1). */
  roughness?: number;
  normalScale?: number;
};

export type MaterialLibrary = {
  apply(material: THREE.MeshStandardMaterial, name: SetName, options: ApplyOptions): void;
  dispose(): void;
};

type Loaded = { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture };
const MAPS = ['color', 'normal', 'rough'] as const;

export function createMaterialLibrary(
  renderer: THREE.WebGLRenderer,
  quality: Quality,
  onChange: () => void,
): MaterialLibrary {
  const tier = quality === 'high' ? 'hi' : 'lo';
  const anisotropy = Math.min(quality === 'high' ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();
  const sets = new Map<SetName, Promise<Loaded | null>>();
  const owned: THREE.Texture[] = [];
  let disposed = false;

  const loadMap = (name: SetName, map: (typeof MAPS)[number]) =>
    new Promise<THREE.Texture>((resolve, reject) =>
      loader.load(`/gallery/tex/${name}/${map}-${tier}.webp`, resolve, undefined, reject),
    );

  const load = (name: SetName): Promise<Loaded | null> => {
    const cached = sets.get(name);
    if (cached) return cached;
    const pending = Promise.allSettled(MAPS.map((map) => loadMap(name, map))).then((results) => {
      const textures = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
      if (disposed || textures.some((t) => !t)) {
        textures.forEach((t) => t?.dispose());
        if (!disposed) console.warn(`[gallery3d] texture set "${name}" unavailable; keeping the procedural surface`);
        return null;
      }
      const [color, normal, rough] = textures as THREE.Texture[];
      color.colorSpace = THREE.SRGBColorSpace;
      owned.push(color, normal, rough);
      return { color, normal, rough };
    });
    sets.set(name, pending);
    return pending;
  };

  // Clones share the GPU image; each carries its own repeat.
  const tuned = (source: THREE.Texture, repeat: [number, number]): THREE.Texture => {
    const t = source.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
    owned.push(t);
    return t;
  };

  return {
    apply(material, name, options) {
      void load(name).then((set) => {
        if (!set || disposed) return;
        if (!options.keepMap) {
          material.map = tuned(set.color, options.repeat);
          if (options.color !== undefined) material.color.setHex(options.color);
        }
        material.normalMap = tuned(set.normal, options.repeat);
        material.normalScale.setScalar(options.normalScale ?? 1);
        material.roughnessMap = tuned(set.rough, options.repeat);
        material.roughness = options.roughness ?? 1;
        material.needsUpdate = true;
        onChange();
      });
    },
    dispose() {
      disposed = true;
      owned.forEach((t) => t.dispose());
      owned.length = 0;
      sets.clear();
    },
  };
}
```

- [ ] **Step 4: Extend the contract**

In `components/gallery3d/contract.ts`, add below the existing imports:

```ts
import type { MaterialLibrary } from './render/materialLibrary';
```

Replace the `SceneCtx` type with:

```ts
export type SceneCtx = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  theme: ThemeName;
  quality: Quality;
  /** Scanned texture sets. `apply` is async and leaves the material alone on failure. */
  materials: MaterialLibrary;
  /** Call when async work (a texture arriving) needs a new frame. */
  invalidate: () => void;
  /**
   * Call when the static look changed (a surface texture arrived, the shatter
   * ended): shadow maps and room reflections are rendered again, once.
   */
  invalidateStatic: () => void;
};
```

Replace the "Budget:" comment at the bottom of the file with:

```ts
// Budget: shadow maps are static. They render at load, on a theme switch and
// when a part calls ctx.invalidateStatic(); never per frame, except the
// centrepiece spot during its two-second shatter. At most 3 real lights in
// room, 0 in artworks (picture-light pools are additive planes), 1 in
// centerpiece. Share geometries and materials. The low tier has no shadow maps
// and no post chain and targets 60fps on a 2020 phone at devicePixelRatio 1.5.
```

- [ ] **Step 5: Create the library in the engine**

a. In `boot()`, change the progress divisor `/ 5` to `/ 6`, and replace the `Promise.all` and the `live = start(...)` line with:

```ts
    const [T, room, artworks, centerpiece, nav, matLib] = await Promise.all([
      track(import('three')),
      track(import('./scene/room')),
      track(import('./scene/artworks')),
      track(import('./scene/centerpiece')),
      track(import('./scene/navArrows')),
      track(import('./render/materialLibrary')),
    ]);
    if (disposed) return;
    live = start(T, [room.createRoom, artworks.createArtworks, centerpiece.createCenterpiece, nav.createNavArrows], {
      matLib,
    });
```

b. Above `export function createEngine`, add:

```ts
type RenderModules = {
  matLib: typeof import('./render/materialLibrary');
};
```

c. Change the signature `function start(T: typeof THREE, factories: Factory[]): Live {` to:

```ts
  function start(T: typeof THREE, factories: Factory[], mods: RenderModules): Live {
```

d. Replace the line `const ctx: SceneCtx = { renderer, scene, camera, theme, quality, invalidate };` with:

```ts
    const invalidateStatic = () => invalidate();
    const materials = mods.matLib.createMaterialLibrary(renderer, quality, () => invalidateStatic());
    const ctx: SceneCtx = { renderer, scene, camera, theme, quality, materials, invalidate, invalidateStatic };
```

e. In `destroy`, directly above `renderer.dispose();`, add:

```ts
      materials.dispose();
```

`destroy` is declared above `materials`; it only runs later, so the reference is valid. If TypeScript reports "used before its declaration", move the three lines from step d above the `const destroy = () => {` declaration.

- [ ] **Step 6: Apply the sets in `room.ts`**

Directly above the comment `// --- Assemble ---`, add:

```ts
  // --- Scanned materials ---------------------------------------------------
  // Real sizes of the scans (m): parquet 3.4, marble 1.5, plaster 1.0, velvet 0.28.
  const lib = ctx.materials;
  lib.apply(floorMat, 'parquet', { repeat: [PARQUET_TILE / 3.4, PARQUET_TILE / 3.4], roughness: 0.7 });
  lib.apply(wallMat, 'plaster', { repeat: [PLASTER_TILE, PLASTER_TILE], normalScale: 0.6 });
  lib.apply(dadoMat, 'marble', { repeat: [DADO_TILE / 1.5, DADO_H / 1.5], color: 0x9a4a42, roughness: 0.55 });
  // Painted patterns stay as the colour; the scan supplies relief and sheen.
  lib.apply(salonWallMat, 'velvet', { repeat: [damaskTile / 0.28, damaskTile / 0.28], keepMap: true, normalScale: 0.5 });
  lib.apply(salonFloorMat, 'marble', { repeat: [(2 * R) / 1.5, (2 * R) / 1.5], keepMap: true, roughness: 0.45 });
  lib.apply(vaultMat, 'plaster', { repeat: [1, 1], keepMap: true, normalScale: 0.5 });
  lib.apply(domeMat, 'plaster', { repeat: [24, 5], keepMap: true, normalScale: 0.5 });
```

- [ ] **Step 7: Apply walnut and marble elsewhere**

In `artworks.ts` `buildPainting`, replace the line `hung.add(new THREE.Mesh(sweep.geometry, track(makeFrameMaterial(frameParams[piece.frame], frameUniforms))));` with:

```ts
    const frameMat = track(makeFrameMaterial(frameParams[piece.frame], frameUniforms));
    if (piece.frame === 'walnut') ctx.materials.apply(frameMat, 'walnut', { repeat: [0.5, 1], roughness: 0.8 });
    hung.add(new THREE.Mesh(sweep.geometry, frameMat));
```

In `centerpiece.ts`, directly below `const plinthMat = own(new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 }));`, add:

```ts
  ctx.materials.apply(plinthMat, 'marble', { repeat: [1.4, 0.7], roughness: 0.5 });
```

and directly below the `const ropeMat = own(new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }));` line, add:

```ts
  ctx.materials.apply(ropeMat, 'velvet', { repeat: [24, 1], keepMap: true, normalScale: 0.8 });
```

- [ ] **Step 8: Run the gates and compare stills**

```bash
npx tsc --noEmit -p . && npm test && npm run build
npx serve out -l 4173 & SERVE_PID=$!; sleep 2
node scripts/shots.mjs --out=.stills/materials && node scripts/shots.mjs --out=.stills/materials --center
kill $SERVE_PID
```

Read `.stills/materials/light-citcd-center.png` beside `.stills/baseline/light-citcd-center.png`. Expected: the floor is a scanned herringbone with visible board joints and grain, walls show fine plaster relief. Tune by eye, one value at a time, rebuilding between changes:
- Floor boards look too large or too small: change the `3.4` divisor in the parquet `repeat`.
- Floor too matte or too glossy: `roughness` between 0.5 and 0.9.
- Dado marble too pink or too grey: `color`.
- Damask relief too noisy: `normalScale` down to 0.3.

- [ ] **Step 9: Check the offline path**

Write `.stills/check-offline.mjs`:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
await context.addInitScript(() => localStorage.removeItem('gmode'));
const page = await context.newPage();
await page.route('**/gallery/tex/**', (route) => route.abort());
const warnings = [];
const errors = [];
page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[gallery3d]')) warnings.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4173/?g3debug#citcd');
await page.waitForSelector('html[data-g3="live"]');
await page.waitForTimeout(4000);
console.log('warnings:', warnings.length, '\n' + warnings.join('\n'));
console.log('page errors:', errors.length ? errors : 'none');
console.log('mode:', await page.evaluate(() => document.documentElement.dataset.gmode));
await page.screenshot({ path: '.stills/offline.png' });
await browser.close();
```

Run with the server up. Expected: `warnings: 5` (one per set), `page errors: none`, `mode: 3d`. Read `.stills/offline.png`: it matches the baseline look, with no black surfaces.

- [ ] **Step 10: Commit**

```bash
git add scripts/fetch-textures.mjs public/gallery/tex components/gallery3d
git commit -m "feat(gallery): scanned floor, plaster, marble, velvet and walnut"
```

---

### Task 7: Room reflections

**Files:**
- Create: `components/gallery3d/render/environment.ts`
- Modify: `components/gallery3d/contract.ts`, `components/gallery3d/engine.ts`, `components/gallery3d/scene/room.ts`, `components/gallery3d/scene/artworks.ts`, `components/gallery3d/scene/centerpiece.ts`

**Interfaces:**
- Consumes: `SceneCtx.invalidateStatic` from Task 6.
- Produces:
  - `type Zone = 'corridor' | 'salon'`
  - `type RegisterOptions = { intensity?: number; metalness?: number; roughness?: number }`
  - `type Environment = { bake(): void; register(material: THREE.MeshStandardMaterial, zone: Zone, options?: RegisterOptions): void; cube(zone: Zone): THREE.CubeTexture | null; onBake(listener: () => void): void; dispose(): void }`
  - `createEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, hidden: () => THREE.Object3D[]): Environment`
  - `SceneCtx.env: Environment | null`
  - Engine: `refreshStatic()` (Task 8 adds shadow marking to it) and a real `invalidateStatic`.

`register` assigns the baked map to the material once a bake has succeeded. `metalness` and `roughness` in the options are applied only then, so a failed bake never leaves a full metal with nothing to reflect. `cube` returns the unfiltered cube map for custom shaders (sharp reflections on glass); it is null until the first bake.

- [ ] **Step 1: Create `components/gallery3d/render/environment.ts`**

```ts
// Room reflections. The gallery is rendered into two cube maps (one standing in
// the corridor, one in the salon), each prefiltered for rough surfaces, and
// handed to the materials of that zone. Reflections therefore show this room.
// Bakes happen on demand (load, theme switch, late textures), never per frame.
import * as THREE from 'three';
import { CORRIDOR, SALON } from '../contract';

export type Zone = 'corridor' | 'salon';

export type RegisterOptions = {
  /** envMapIntensity once the map is assigned (default 1). */
  intensity?: number;
  /** Applied only once a bake has succeeded, so a failed bake leaves the old look. */
  metalness?: number;
  roughness?: number;
};

export type Environment = {
  bake(): void;
  register(material: THREE.MeshStandardMaterial, zone: Zone, options?: RegisterOptions): void;
  /** Unfiltered cube map for custom shaders; null until the first bake. */
  cube(zone: Zone): THREE.CubeTexture | null;
  onBake(listener: () => void): void;
  dispose(): void;
};

const PROBE: Record<Zone, [number, number, number]> = {
  corridor: [0, 2.4, (CORRIDOR.zStart + CORRIDOR.zEnd) / 2],
  // Off the salon centre: the centre is inside the glass case.
  salon: [SALON.center[0] + 3.5, 3.2, SALON.center[2] + 3.5],
};
const FACE = 256;

type Entry = { material: THREE.MeshStandardMaterial; options: RegisterOptions };
type ZoneState = {
  target: THREE.WebGLCubeRenderTarget;
  camera: THREE.CubeCamera;
  filtered: THREE.WebGLRenderTarget | null;
  entries: Entry[];
};

export function createEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  hidden: () => THREE.Object3D[],
): Environment {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const listeners: Array<() => void> = [];
  let baked = false;

  const makeZone = (zone: Zone): ZoneState => {
    const target = new THREE.WebGLCubeRenderTarget(FACE, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    const camera = new THREE.CubeCamera(0.1, 80, target);
    camera.position.set(...PROBE[zone]);
    return { target, camera, filtered: null, entries: [] };
  };
  const zones: Record<Zone, ZoneState> = { corridor: makeZone('corridor'), salon: makeZone('salon') };
  const all = () => [...zones.corridor.entries, ...zones.salon.entries];

  const assign = (state: ZoneState, entry: Entry) => {
    if (!state.filtered) return;
    const { material, options } = entry;
    const first = !material.envMap;
    material.envMap = state.filtered.texture;
    material.envMapIntensity = options.intensity ?? 1;
    if (first) {
      if (options.metalness !== undefined) material.metalness = options.metalness;
      if (options.roughness !== undefined) material.roughness = options.roughness;
      material.needsUpdate = true;
    }
  };

  return {
    bake() {
      const hide = hidden().filter((o) => o.visible);
      hide.forEach((o) => (o.visible = false));
      // No feedback loop: nothing reflects while the probes render. Intensity
      // 0, not a null map, so no shader recompiles.
      all().forEach((e) => (e.material.envMapIntensity = 0));
      try {
        for (const state of Object.values(zones)) {
          state.camera.update(renderer, scene);
          const next = pmrem.fromCubemap(state.target.texture);
          state.filtered?.dispose();
          state.filtered = next;
        }
        baked = true;
      } finally {
        hide.forEach((o) => (o.visible = true));
        for (const state of Object.values(zones)) state.entries.forEach((e) => assign(state, e));
      }
      listeners.forEach((fn) => fn());
    },
    register(material, zone, options = {}) {
      const entry = { material, options };
      zones[zone].entries.push(entry);
      if (baked) assign(zones[zone], entry);
    },
    cube: (zone) => (baked ? zones[zone].target.texture : null),
    onBake(listener) {
      listeners.push(listener);
    },
    dispose() {
      for (const state of Object.values(zones)) {
        state.entries.forEach((e) => (e.material.envMap = null));
        state.entries.length = 0;
        state.filtered?.dispose();
        state.target.dispose();
      }
      pmrem.dispose();
      listeners.length = 0;
    },
  };
}
```

- [ ] **Step 2: Extend the contract**

In `contract.ts`, add the import:

```ts
import type { Environment } from './render/environment';
```

In `SceneCtx`, below the `materials` member, add:

```ts
  /** Room reflections; null if the bake is unavailable. Register materials at build time. */
  env: Environment | null;
```

- [ ] **Step 3: Bake from the engine**

a. In `boot()`: progress divisor `/ 6` becomes `/ 7`; add `envMod` to the destructuring and `track(import('./render/environment')),` as the last entry of the `Promise.all` array; pass `{ matLib, envMod }` to `start`. In `RenderModules` add:

```ts
  envMod: typeof import('./render/environment');
```

b. Replace the three lines added in Task 6 Step 5d with:

```ts
    let staticDirty = true;
    let lastBake = -Infinity;
    const invalidateStatic = () => {
      staticDirty = true;
      invalidate();
    };
    const materials = mods.matLib.createMaterialLibrary(renderer, quality, () => invalidateStatic());
    let navGroup: THREE.Object3D | null = null;
    let env: ReturnType<typeof mods.envMod.createEnvironment> | null = null;
    try {
      // Floor markers and cursors must not appear in reflections.
      env = mods.envMod.createEnvironment(renderer, scene, () => (navGroup ? [navGroup] : []));
    } catch (err) {
      console.warn('[gallery3d] room reflections unavailable', err);
    }
    const ctx: SceneCtx = { renderer, scene, camera, theme, quality, materials, env, invalidate, invalidateStatic };

    /** Re-renders everything that is static between events: shadow maps and reflections. */
    const refreshStatic = () => {
      if (!env) return;
      try {
        env.bake();
      } catch (err) {
        console.warn('[gallery3d] room reflections failed; continuing without', err);
        env.dispose();
        env = null;
        ctx.env = null;
      }
    };
```

c. Directly after the `for (const make of factories) { ... }` try / catch block, add:

```ts
    // createNavArrows is the last factory.
    navGroup = parts[parts.length - 1]?.group ?? null;
```

d. In `frame()`, directly above `renderer.render(scene, camera);`, add:

```ts
      // Texture arrivals come in bursts at load: at most one bake per 250ms.
      if (staticDirty) {
        if (now - lastBake > 250) {
          staticDirty = false;
          lastBake = now;
          refreshStatic();
        } else busy = true;
      }
```

e. In `setTheme`, replace the final `invalidate();` with `invalidateStatic();`.

f. In the `webglcontextrestored` listener, replace `invalidate();` with `invalidateStatic();`.

g. In `destroy`, directly above `materials.dispose();`, add `env?.dispose();`.

- [ ] **Step 4: Register the room's materials**

In `room.ts`, directly below the scanned-materials block from Task 6, add:

```ts
  // --- Reflections ---------------------------------------------------------
  // Rough surfaces take the map too: it is also their bounce light.
  if (ctx.env) {
    for (const m of [floorMat, wallMat, dadoMat, vaultMat, stoneMat, darkMat]) ctx.env.register(m, 'corridor');
    for (const m of [salonWallMat, domeMat, salonFloorMat]) ctx.env.register(m, 'salon');
    ctx.env.register(giltMat, 'corridor', { metalness: 1, roughness: 0.32 });
  }
```

The reflection map adds bounce light, so the fill must come down. In `THEMES`, change `light.hemiIntensity` from `2.3` to `1.3`, `dark.hemiIntensity` from `1.0` to `0.6`, `light.giltEmissive` from `0.18` to `0.05` and `dark.giltEmissive` from `0.2` to `0.06`.

- [ ] **Step 5: Metals and canvas glazing in `artworks.ts`**

a. In `buildPainting`, replace the three lines added in Task 6 Step 7 with:

```ts
    const frameMat = track(makeFrameMaterial(frameParams[piece.frame], frameUniforms));
    if (piece.frame === 'walnut') ctx.materials.apply(frameMat, 'walnut', { repeat: [0.5, 1], roughness: 0.8 });
    // Gilt and brass become true metals once there is a room to reflect.
    ctx.env?.register(
      frameMat,
      'corridor',
      piece.frame === 'gilt' ? { metalness: 1, roughness: 0.38 } : piece.frame === 'brass' ? { metalness: 1, roughness: 0.3 } : {},
    );
    hung.add(new THREE.Mesh(sweep.geometry, frameMat));
```

b. Directly below the `const fixtureMat = ...` line, add:

```ts
  ctx.env?.register(fixtureMat, 'corridor', { metalness: 1, roughness: 0.35 });
```

c. Replace the comment above `gilt:` in `frameParams` ("Metalness is kept moderate on purpose ...", two lines) with:

```ts
    // Moderate metalness is the fallback look; ctx.env raises gilt and brass to
    // full metals once the room reflection exists.
```

d. Replace the `VERT` constant with:

```ts
const VERT = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
```

e. In `CANVAS_FRAG`, below `uniform float uDay;`, add:

```glsl
uniform samplerCube uEnv;
uniform float uGloss;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
```

and directly above the `#ifdef USE_FOG` line inside `main`, add:

```glsl
  // Glazing: a faint, slightly blurred reflection of the room, stronger at a glancing angle.
  vec3 viewDir = normalize(vWorldPos - cameraPosition);
  vec3 n = normalize(vWorldNormal);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-viewDir, n), 0.0), 5.0);
  col += textureCube(uEnv, reflect(viewDir, n), 2.5).rgb * fres * uGloss;
```

f. In `makeCanvasMaterial`, in the uniforms object, below `uFog: { value: 1 },`, add:

```ts
      uEnv: { value: null },
      uGloss: { value: 0 },
```

g. Directly above `loadNearestFirst();` (the call, near `setTheme(theme);`), add:

```ts
  ctx.env?.onBake(() => {
    const cube = ctx.env?.cube('corridor') ?? null;
    for (const p of paintings) {
      p.canvas.material.uniforms.uEnv.value = cube;
      p.canvas.material.uniforms.uGloss.value = cube ? 0.5 : 0;
    }
  });
```

- [ ] **Step 6: Glass, shards and brass in `centerpiece.ts`**

a. Directly below the `const brassMat = own(...)` line, add:

```ts
  ctx.env?.register(brassMat, 'salon', { metalness: 1, roughness: 0.3 });
  ctx.env?.register(plinthMat, 'salon');
  ctx.env?.register(bezelMat, 'salon');
```

b. In `glassFragment`, below `uniform float uGlintStrength;`, add:

```glsl
    uniform samplerCube uEnv;
    uniform float uEnvStrength;
```

and replace the two lines from `float alpha = uOpacity + ...` to `gl_FragColor = vec4(uTint + vec3(glint), clamp(alpha, 0.0, 1.0) * fogFade);` with:

```glsl
      float alpha = uOpacity + fresnel * uFresnel + sheen * uSheen + glint;
      // Sharp reflection of the salon, in world space.
      vec3 n = normalize(vNormal);
      vec3 v = normalize(vView);
      if (dot(n, v) < 0.0) n = -n;
      vec3 reflected = (vec4(reflect(-v, n), 0.0) * viewMatrix).xyz;
      float schlick = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
      vec3 refl = textureCube(uEnv, reflected).rgb * schlick * uEnvStrength;
      float reflA = clamp(dot(refl, vec3(0.3333)), 0.0, 1.0);
      float outA = clamp(alpha + reflA, 0.0, 1.0);
      vec3 body = (uTint + vec3(glint)) * clamp(alpha, 0.0, 1.0);
      gl_FragColor = vec4((body + refl) / max(outA, 1e-4), outA * fogFade);
```

c. In `glassUniforms`, below `uGlintStrength: { value: 0 },`, add:

```ts
    uEnv: { value: null as THREE.CubeTexture | null },
    uEnvStrength: { value: 0 },
```

d. In the shard fragment shader, replace the line `gl_FragColor = vec4(uTint * (1.0 + edge * 0.4 + twinkle), clamp(alpha, 0.0, 1.0) * fogFade);` with:

```glsl
          // Cut glass shows green at its edge.
          vec3 rim = mix(vec3(1.0), vec3(0.72, 1.0, 0.86), edge);
          gl_FragColor = vec4(uTint * rim * (1.0 + edge * 0.4 + twinkle), clamp(alpha, 0.0, 1.0) * fogFade);
```

e. Directly above `// ---- state` (the section with `type Phase`), add:

```ts
  let envReady = false;
  ctx.env?.onBake(() => {
    const cube = ctx.env?.cube('salon') ?? null;
    envReady = !!cube;
    for (const material of [glassMat, frontMat]) {
      (material.uniforms.uEnv as THREE.IUniform<THREE.CubeTexture | null>).value = cube;
      setUniform(material, 'uEnvStrength', cube ? 1.4 : 0);
      // The painted diagonal sheen stands in for a reflection; fade it once there is a real one.
      setUniform(material, 'uSheen', spec.glassSheen * (cube ? 0.25 : 1));
    }
  });
```

`setUniform` and `spec` are declared just below in the state section; this callback runs later, so the order is safe. If TypeScript reports a use-before-declaration error, move this block to directly above `shards.visible = false;`.

f. In `setTheme`, replace `setUniform(material, 'uSheen', spec.glassSheen);` with:

```ts
      setUniform(material, 'uSheen', spec.glassSheen * (envReady ? 0.25 : 1));
```

- [ ] **Step 7: Run the gates**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all pass.

- [ ] **Step 8: Compare stills**

```bash
npx serve out -l 4173 & SERVE_PID=$!; sleep 2
node scripts/shots.mjs --out=.stills/env && node scripts/shots.mjs --out=.stills/env --center
kill $SERVE_PID
```

Read `.stills/env/light-citcd-center.png`, `.stills/env/dark-centerpiece.png` and `.stills/env/light-centerpiece.png` beside their `.stills/materials/` counterparts. Expected: the parquet carries a soft reflection of the skylight and bright walls; gilt frames and brass read as metal with highlights, not flat ochre; the case panes show a faint reflection of the salon; overall brightness is close to before. Tune by eye:
- Room brighter or darker overall than `.stills/materials/`: `hemiIntensity` in `room.ts` `THEMES`, in steps of 0.2.
- Floor reflection too mirror-like: parquet `roughness` in Task 6's `apply` call, up toward 0.85.
- Gilt too dark at night: `register(giltMat, ...)` and the frame `register` calls accept `intensity`; try 1.5.
- Glass reflection too strong: `uEnvStrength` 1.4 down toward 0.8.
- Canvas glazing distracts from the screenshot: `uGloss` 0.5 down toward 0.25.

- [ ] **Step 9: Check idle rendering**

Write `.stills/check-idle.mjs`:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
await context.addInitScript(() => localStorage.removeItem('gmode'));
const page = await context.newPage();
await page.goto('http://localhost:4173/?g3debug#citcd');
await page.waitForSelector('html[data-g3="live"]');
await page.waitForTimeout(6000);
const frames = () => page.evaluate(() => Number(document.querySelector('canvas').dataset.g3frames));
const a = await frames();
await page.waitForTimeout(2000);
const b = await frames();
console.log('frames rendered in 2s at rest:', b - a);
await browser.close();
```

Run with the server up. Expected: `frames rendered in 2s at rest: 0`.

- [ ] **Step 10: Check repeated theme switches**

Write `.stills/check-theme.mjs`:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
await context.addInitScript(() => localStorage.removeItem('gmode'));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4173/?g3debug#citcd');
await page.waitForSelector('html[data-g3="live"]');
await page.waitForTimeout(6000);
const textures = () => page.evaluate(() => window.__g3.renderer.info.memory.textures);
const flip = (t) => page.evaluate((v) => { document.documentElement.dataset.gtheme = v; }, t);
const before = await textures();
for (let i = 0; i < 10; i++) { await flip(i % 2 ? 'light' : 'dark'); await page.waitForTimeout(120); }
await page.waitForTimeout(1500);
const after = await textures();
console.log('textures before / after 10 switches:', before, after);
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
```

Run with the server up. Expected: the two counts are equal (a difference of 1 or 2 is acceptable while a 2400px image is in flight; growth of 10 or more means bakes are leaking targets) and `page errors: none`.

- [ ] **Step 11: Commit**

```bash
git add components/gallery3d
git commit -m "feat(gallery): baked room reflections on floor, metals, glass and canvases"
```

---

### Task 8: Shadows and lighting

**Files:**
- Modify: `components/gallery3d/engine.ts`, `components/gallery3d/scene/room.ts`, `components/gallery3d/scene/artworks.ts`, `components/gallery3d/scene/centerpiece.ts`

**Interfaces:**
- Consumes: `refreshStatic()` and `ctx.invalidateStatic()` from Task 7.
- Produces: static shadow maps on the high tier. A light that casts shadows needs no registration; `refreshStatic()` finds it by traversal.

- [ ] **Step 1: Enable static shadow maps in the engine**

Directly below `renderer.toneMappingExposure = TUNING.exposure[theme];`, add:

```ts
    // Static shadows: maps render only when refreshStatic() flags them.
    renderer.shadowMap.enabled = quality === 'high';
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
```

In `refreshStatic`, replace `if (!env) return;` with:

```ts
      if (renderer.shadowMap.enabled) {
        scene.traverse((o) => {
          const light = o as THREE.Light;
          if (light.isLight && light.castShadow && light.shadow) {
            light.shadow.autoUpdate = false;
            light.shadow.needsUpdate = true;
          }
        });
        renderer.shadowMap.needsUpdate = true;
      }
      if (!env) return;
```

The shadow maps are flagged before the bake, so the first cube face renders them and the reflections include the shadows.

- [ ] **Step 2: Sun and oculus shadows in `room.ts`**

a. Directly below `group.add(hemi, sun, oculusLight);`, add:

```ts
  if (high) {
    // Same direction as before (low, from ahead), re-aimed at the corridor's
    // middle so one orthographic map covers its whole length.
    const dir = new THREE.Vector3(0, 8, -9).normalize();
    sun.target.position.set(0, 0, CORRIDOR_MID);
    sun.position.copy(sun.target.position).addScaledVector(dir, 34);
    group.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -HW - 0.5;
    sc.right = HW + 0.5;
    sc.top = 22;
    sc.bottom = -22;
    sc.near = 4;
    sc.far = 70;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;

    oculusLight.castShadow = true;
    oculusLight.shadow.mapSize.set(1024, 1024);
    oculusLight.shadow.camera.near = 0.5;
    oculusLight.shadow.camera.far = 24;
    oculusLight.shadow.bias = -0.002;

    // Every lit surface receives; the box batches (pilasters, cornice, benches) and ribs cast.
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) mesh.receiveShadow = true;
    });
    for (const mesh of instanced) mesh.castShadow = true;
  }
```

b. Real ambient occlusion and shadows replace the painted contact ramps on the high tier. Replace `addMesh(aoB.build(), aoMat, 1);` with:

```ts
  addMesh(aoB.build(), aoMat, 1).visible = !high;
```

- [ ] **Step 3: Retune the room's light**

In `room.ts`, add `glassGain: number;` to the `ThemeSpec` type below `glass: number;`. In `THEMES` set these values (others unchanged):

| Key | `light` | `dark` |
|---|---|---|
| `sun` | `0xffe2b8` | `0x9fb0d0` |
| `sunIntensity` | `2.6` | `0.6` |
| `oculus` | `0xf4f0e8` (unchanged) | `0xc9b08a` |
| `oculusIntensity` | `105` (unchanged) | `44` |
| `glassGain` | `1.9` | `1` |

The warmer, brighter night oculus is what stops the salon's red walls reading black.

In `setTheme`, replace `glassMat.color.setHex(t.glass);` with:

```ts
    // Above 1 on the high tier so the skylight feeds the bloom pass.
    glassMat.color.setHex(t.glass).multiplyScalar(high ? t.glassGain : 1);
```

- [ ] **Step 4: Centrepiece spot shadow**

In `centerpiece.ts`:

a. Replace `spot.castShadow = false;` with:

```ts
  spot.castShadow = !low;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 3;
  spot.shadow.camera.far = 12;
  spot.shadow.bias = -0.0006;
  spot.shadow.normalBias = 0.02;
```

b. Directly above `// ---- state`, add:

```ts
  if (!low) {
    // Solid parts cast and receive; glass panes do not (they would cast solid black).
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !(mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    shards.castShadow = true;
  }
```

c. In `stepBreaking`, directly after `clock += Math.min(dt, 1 / 20);`, add:

```ts
    if (!low) {
      // The only per-frame shadow update in the gallery, for the two seconds the glass falls.
      spot.shadow.needsUpdate = true;
      ctx.renderer.shadowMap.needsUpdate = true;
    }
```

d. In `settle`, add as the last line:

```ts
    ctx.invalidateStatic();
```

e. In `setTheme`, replace `shadowMat.opacity = spec.shadow;` with:

```ts
    // The real shadow carries the shape; the painted one only softens the contact.
    shadowMat.opacity = spec.shadow * (low ? 1 : 0.45);
```

- [ ] **Step 5: Picture-light pools**

In `artworks.ts`:

a. Replace the `wall:` entry of `FX_BODY` with:

```ts
  // Inverse-square falloff from a tube lamp just above the top rail, 0.25m off
  // the wall, shaded so it throws light downward. Zero at the plane's edge.
  wall: /* glsl */ `
    vec2 d = p - vec2(0.0, uHalf.y + 0.15);
    d.x *= 0.45;
    float h = 0.25;
    float r2 = dot(d, d) + h * h;
    a = (h * h / r2) * (h / sqrt(r2));
    a *= smoothstep(0.05, -0.25, d.y);
    vec2 e = smoothstep(vec2(1.0), vec2(0.7), abs(vUv - 0.5) * 2.0);
    a *= e.x * e.y * 6.0;`,
```

b. Replace the `glowColor` and `picLight` lines with (about 3000K, in linear RGB):

```ts
  const glowColor = new THREE.Color().setRGB(1, 0.58, 0.26);
```

```ts
  const picLight = new THREE.Color().setRGB(1, 0.72, 0.42);
```

c. In `applyLook`, replace the two lines `p.shadow.visible = !dark;` and `p.shadow.material.uniforms.uIntensity.value = 0.36;` with:

```ts
    // The frame's contact shadow: from daylight by day, from its own lamp at night.
    p.shadow.visible = true;
    p.shadow.material.uniforms.uIntensity.value = dark ? 0.5 * level : 0.36;
```

- [ ] **Step 6: Run the gates and compare stills**

```bash
npx tsc --noEmit -p . && npm test && npm run build
npx serve out -l 4173 & SERVE_PID=$!; sleep 2
node scripts/shots.mjs --out=.stills/shadows && node scripts/shots.mjs --out=.stills/shadows --center
node scripts/shots.mjs --out=.stills/shadows-low --q=low
kill $SERVE_PID
```

Read `.stills/shadows/light-citcd-center.png`, `.stills/shadows/dark-citcd.png`, `.stills/shadows/light-centerpiece.png`, `.stills/shadows/dark-centerpiece.png`. Expected: pilasters throw soft shadows along the floor; the plinth, case frame and stanchions throw a shadow from the spot; at night each lit work has a warm pool that is hot under the lamp and falls off quickly, and the salon walls read red. No stripes or speckle on walls or floor. Tune by eye:
- Stripes or speckle on a surface (shadow acne): raise `normalBias` on that light by 0.01.
- Shadows detached from their object (peter-panning): lower `normalBias`, or move `bias` toward 0.
- Day too flat: `hemiIntensity` down 0.2, or `sunIntensity` up 0.3.
- Night pools too orange or too hot: `glowColor`, or the `6.0` gain in the `wall` shader.

Read `.stills/shadows-low/light-centerpiece.png`. Expected: no real shadows, painted contact shadows present, scene otherwise intact.

- [ ] **Step 7: Re-run the idle check**

Run `.stills/check-idle.mjs` from Task 7 with the server up.
Expected: `frames rendered in 2s at rest: 0`.

- [ ] **Step 8: Commit**

```bash
git add components/gallery3d
git commit -m "feat(gallery): static shadow maps and retuned day and night lighting"
```

---

### Task 9: Post chain

**Files:**
- Create: `components/gallery3d/render/unlit.ts`, `components/gallery3d/render/pipeline.ts`
- Modify: `components/gallery3d/engine.ts`, `components/gallery3d/scene/room.ts`, `components/gallery3d/scene/artworks.ts`, `components/gallery3d/scene/centerpiece.ts`

**Interfaces:**
- Produces:
  - `markUnlit<M extends THREE.Material>(material: M): M`
  - `type Pipeline = { render(): void; setSize(width: number, height: number, pixelRatio: number): void; setMoving(moving: boolean): void; set(options: { gtao?: boolean; bloom?: boolean }): void; dispose(): void }`
  - `createPipeline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): Pipeline | null` (null when float render targets are unsupported)
  - Engine: `let pipeline: Pipeline | null`, read by Task 11.

How the chain treats colour: the scene renders to a half-float target in linear light. Lit materials write alpha 1. Materials passed through `markUnlit` (and the artwork canvas shader) write alpha 0. The final grade pass applies ACES tone mapping only where alpha is 1, so screenshots, labels and the plaque keep their exact colours. Bloom is patched to leave alpha untouched.

- [ ] **Step 1: Read the three.js sources this task patches**

Read `node_modules/three/examples/jsm/postprocessing/GTAOPass.js` lines 500 to 540 (`overrideVisibility`, `restoreVisibility`), `node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js` lines 120 to 140 (`blendMaterial`) and `node_modules/three/examples/jsm/shaders/OutputShader.js` (the raw-shader header the grade pass copies). Confirm: `GTAOPass` has methods `overrideVisibility()` and `restoreVisibility()` called around its normal pass; `UnrealBloomPass` has a public `blendMaterial`; `OutputShader` declares `precision highp float;` and includes `<tonemapping_pars_fragment>` and `<colorspace_pars_fragment>`. If any differs (the installed version is not 0.170.0), stop and report.

- [ ] **Step 2: Create `components/gallery3d/render/unlit.ts`**

```ts
// Marks a built-in material as "unlit content": a screenshot, a label, a sign.
// It writes alpha 0, which the post chain's grade pass reads as "do not tone
// map". Harmless without the post chain: the canvas has no alpha channel.
import type * as THREE from 'three';

export function markUnlit<M extends THREE.Material>(material: M): M {
  const before = material.onBeforeCompile;
  const beforeKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\n\tgl_FragColor.a = 0.0;',
    );
  };
  material.customProgramCacheKey = () => `${beforeKey.call(material)}|unlit`;
  return material;
}
```

- [ ] **Step 3: Create `components/gallery3d/render/pipeline.ts`**

```ts
// Post chain for the high tier: ambient occlusion, bloom, then a grade pass
// that tone-maps lit pixels only and adds a touch of grain and vignette.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export type Pipeline = {
  render(): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  /** Grain animates only while the camera moves, so a settled view is a still image. */
  setMoving(moving: boolean): void;
  set(options: { gtao?: boolean; bloom?: boolean }): void;
  dispose(): void;
};

const GRADE_VERTEX = /* glsl */ `
  precision highp float;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// Raw shader, like three's OutputShader: a normal ShaderMaterial would have the
// renderer's own tone mapping injected a second time when drawing to the screen.
const GRADE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uContrast;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uSeed;
  #include <tonemapping_pars_fragment>
  #include <colorspace_pars_fragment>
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    // Alpha 1: lit surface, tone-mapped. Alpha 0: screenshot or label, shown as authored.
    float lit = clamp(texel.a, 0.0, 1.0);
    vec3 mapped = sRGBTransferOETF(vec4(ACESFilmicToneMapping(texel.rgb), 1.0)).rgb;
    mapped = clamp((mapped - 0.5) * uContrast + 0.5, 0.0, 1.0);
    vec3 plain = sRGBTransferOETF(vec4(clamp(texel.rgb, 0.0, 1.0), 1.0)).rgb;
    vec3 color = mix(plain, mapped, lit);
    color *= 1.0 - uVignette * smoothstep(0.45, 1.0, length(vUv - 0.5) * 1.4);
    color += (hash(gl_FragCoord.xy + uSeed) - 0.5) * uGrain;
    gl_FragColor = vec4(color, 1.0);
  }`;

class GradePass extends Pass {
  readonly uniforms = {
    tDiffuse: { value: null as THREE.Texture | null },
    toneMappingExposure: { value: 1 },
    uContrast: { value: 1.05 },
    uVignette: { value: 0.16 },
    uGrain: { value: 0.02 },
    uSeed: { value: 0 },
  };
  private readonly material = new THREE.RawShaderMaterial({
    name: 'GalleryGrade',
    uniforms: this.uniforms,
    vertexShader: GRADE_VERTEX,
    fragmentShader: GRADE_FRAGMENT,
  });
  private readonly quad = new FullScreenQuad(this.material);

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

export function createPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): Pipeline | null {
  // Without float colour buffers the half-float target is incomplete and renders black, silently.
  if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) {
    return null;
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // The chain bypasses the canvas's own antialiasing, so the scene target is multisampled.
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
  gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: 12, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.85;
  // Half resolution: occlusion is low-frequency and the denoise pass hides the difference.
  const fullSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w: number, h: number) => fullSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
  // GTAOPass renders the scene again with a normal material. Glow planes, glass,
  // floor markers and hit targets must not occlude: hide everything that is not
  // an opaque surface for that pass.
  const hiddenForAo = new Map<THREE.Object3D, boolean>();
  const soft = (o: THREE.Object3D): boolean => {
    const mesh = o as THREE.Mesh;
    if ((o as THREE.Points).isPoints || (o as THREE.Line).isLine) return true;
    if (!mesh.isMesh) return false;
    const m = mesh.material as THREE.Material | THREE.Material[];
    const one = Array.isArray(m) ? m[0] : m;
    return !!one && (one.transparent || !one.visible || !one.depthWrite);
  };
  gtao.overrideVisibility = () => {
    scene.traverse((o) => {
      if (soft(o)) {
        hiddenForAo.set(o, o.visible);
        o.visible = false;
      }
    });
  };
  gtao.restoreVisibility = () => {
    hiddenForAo.forEach((visible, o) => (o.visible = visible));
    hiddenForAo.clear();
  };
  composer.addPass(gtao);

  // Threshold above 1: only emitters (lamps, skylight, door glow) bloom, never a white web page.
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.6, 1.15);
  // Add light without touching alpha, which carries the lit / unlit mask.
  const blend = bloom.blendMaterial;
  blend.blending = THREE.CustomBlending;
  blend.blendEquation = THREE.AddEquation;
  blend.blendSrc = THREE.OneFactor;
  blend.blendDst = THREE.OneFactor;
  blend.blendSrcAlpha = THREE.ZeroFactor;
  blend.blendDstAlpha = THREE.OneFactor;
  composer.addPass(bloom);

  const grade = new GradePass();
  composer.addPass(grade);

  let moving = false;
  return {
    render() {
      if (moving) grade.uniforms.uSeed.value = (grade.uniforms.uSeed.value + 1.618) % 97;
      composer.render();
    },
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    setMoving(next) {
      moving = next;
    },
    set(options) {
      if (options.gtao !== undefined) gtao.enabled = options.gtao;
      if (options.bloom !== undefined) bloom.enabled = options.bloom;
    },
    dispose() {
      gtao.dispose();
      bloom.dispose();
      grade.dispose();
      composer.dispose();
      target.dispose();
    },
  };
}
```

- [ ] **Step 4: Route the frame through the pipeline**

In `engine.ts`:

a. In `boot()`: progress divisor `/ 7` becomes `/ 8`; add `post` to the destructuring, `track(import('./render/pipeline')),` as the last entry of the `Promise.all` array, and pass `{ matLib, envMod, post }`. In `RenderModules` add:

```ts
  post: typeof import('./render/pipeline');
```

b. Directly after the line `navGroup = parts[parts.length - 1]?.group ?? null;`, add:

```ts
    let pipeline: ReturnType<typeof mods.post.createPipeline> = null;
    if (quality === 'high') {
      try {
        pipeline = mods.post.createPipeline(renderer, scene, camera);
      } catch (err) {
        console.warn('[gallery3d] post chain unavailable; rendering directly', err);
      }
    }
    const lastCamPos = new T.Vector3(NaN, NaN, NaN);
    const lastCamQuat = new T.Quaternion();
    const draw = () => {
      if (!pipeline) return renderer.render(scene, camera);
      try {
        pipeline.setMoving(!lastCamPos.equals(camera.position) || !lastCamQuat.equals(camera.quaternion));
        lastCamPos.copy(camera.position);
        lastCamQuat.copy(camera.quaternion);
        pipeline.render();
      } catch (err) {
        // Same path the low tier takes; ACES is still set on the renderer for it.
        console.warn('[gallery3d] post chain failed; rendering directly', err);
        pipeline.dispose();
        pipeline = null;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }
    };
```

c. In `frame()`, replace `renderer.render(scene, camera);` with `draw();`.

d. In `resize`, directly after `renderer.setSize(w, h, false);`, add:

```ts
      pipeline?.setSize(w, h, dpr);
```

`resize` is declared after `pipeline`; if not (declaration order differs in the file), move the block from step b above the `// ---- size` section.

e. In `destroy`, directly above `env?.dispose();`, add `pipeline?.dispose();`. `destroy` is declared before `pipeline`; if TypeScript reports use-before-declaration, declare `let pipeline: ReturnType<typeof mods.post.createPipeline> = null;` above `const destroy` and assign it in step b instead of declaring it there.

- [ ] **Step 5: Mark the unlit content**

a. `artworks.ts`: add `import { markUnlit } from '../render/unlit';`. In `CANVAS_FRAG` replace `gl_FragColor = vec4(col, 1.0);` with:

```glsl
  // Alpha 0: the post chain leaves this pixel's colour as authored (see render/unlit.ts).
  gl_FragColor = vec4(col, 0.0);
```

Wrap the tag and label materials: replace `const tagMat = track(new THREE.MeshBasicMaterial({ map: tagTex, toneMapped: false }));` with:

```ts
  const tagMat = track(markUnlit(new THREE.MeshBasicMaterial({ map: tagTex, toneMapped: false })));
```

and in `buildPainting` replace `track(new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false }))` with:

```ts
track(markUnlit(new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false })))
```

In `setTheme`, replace `lampMat.color.setRGB(1, 0.86, 0.62);` with:

```ts
      // Above 1 on the high tier: the lamp is an emitter and feeds the bloom pass.
      lampMat.color.setRGB(1, 0.86, 0.62).multiplyScalar(high ? 3.2 : 1);
```

b. `centerpiece.ts`: add `import { markUnlit } from '../render/unlit';`. Wrap two materials:

```ts
  const screenMat = own(markUnlit(new THREE.MeshBasicMaterial({ color: 0x11161c, toneMapped: false })));
```

```ts
  const plaqueMat = own(markUnlit(new THREE.MeshBasicMaterial({ map: plaqueTex, toneMapped: false })));
```

c. `room.ts`: add `import { markUnlit } from '@/components/gallery3d/render/unlit';`. Wrap two materials:

```ts
  const doorMat = mat(markUnlit(new THREE.MeshBasicMaterial({ color: 0xf2d9a6, toneMapped: false })));
  const signMat = mat(markUnlit(new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })));
```

- [ ] **Step 6: Run the gates**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all pass. If TypeScript cannot resolve `three/addons/...`, use `three/examples/jsm/...` for the five imports in `pipeline.ts` (both map to the same files). If the typings reject the assignments to `gtao.setSize`, `gtao.overrideVisibility`, `gtao.restoreVisibility` or the read of `bloom.blendMaterial` (declared private or missing in `@types/three`), go through a local structural type instead of weakening the whole file, for example `const patch = gtao as unknown as { setSize(w: number, h: number): void; overrideVisibility(): void; restoreVisibility(): void };` and assign on `patch`. Step 1 confirmed the members exist at runtime.

- [ ] **Step 7: Compare stills**

```bash
npx serve out -l 4173 & SERVE_PID=$!; sleep 2
node scripts/shots.mjs --out=.stills/post && node scripts/shots.mjs --out=.stills/post --center
node scripts/shots.mjs --out=.stills/post-low --q=low
kill $SERVE_PID
```

Read `.stills/post/light-citcd.png` beside `.stills/shadows/light-citcd.png` (both facing the work). Expected: the screenshot in the frame has the same colours and the same white as before, not greyer; the wall plate is as white as before. Read `.stills/post/light-citcd-center.png`, `.stills/post/dark-citcd-center.png`, `.stills/post/dark-centerpiece.png`. Expected: soft darkening where frames meet the wall, where the skirting meets the floor and under the plinth; a small glow around the picture lamps and the skylight, no haze over the whole frame; edges are antialiased; no dark halos around floor markers, light pools or glass. Tune by eye:
- Dark halos around a transparent object: it is leaking into the AO pass; check its material is `transparent` or `depthWrite: false`, which `soft()` hides.
- AO too heavy or blotchy: `gtao.blendIntensity` 0.85 down to 0.6; `radius` 0.5 down to 0.35.
- AO shows blocky edges at half resolution: delete the two `fullSize` / `gtao.setSize` lines and pass `size.x, size.y` to the constructor.
- Glow too strong: bloom strength 0.22 down to 0.12. White page content glowing: threshold 1.15 up to 1.3.
- Lit surfaces dimmer than `.stills/shadows/`: glow planes and lamps now pass through ACES; raise `NIGHT.wall` and `NIGHT.floor` in `artworks.ts` by about 25% and `poolOpacity` in `room.ts` by about 25%.
- Grain visible as noise on white walls: `uGrain` 0.02 down to 0.012.

Read `.stills/post-low/light-citcd.png`. Expected: unchanged from `.stills/shadows-low/light-citcd.png`.

- [ ] **Step 8: Re-run idle, zoom and theme checks**

Run `.stills/check-idle.mjs`, `.stills/check-zoom.mjs` and `.stills/check-theme.mjs` with the server up.
Expected: `frames rendered in 2s at rest: 0`; both zoom lines `2880x1800`; texture counts equal before and after; no page errors.

- [ ] **Step 9: Commit**

```bash
git add components/gallery3d
git commit -m "feat(gallery): ambient occlusion, bloom and grade pass on the high tier"
```

---

### Task 10: Bevels, skirting and picture rail

**Files:**
- Modify: `components/gallery3d/scene/room.ts` (`BoxBatch`, corridor trim, assemble loop, dispose), `components/gallery3d/scene/centerpiece.ts` (plinth, step)

**Interfaces:**
- Produces: `BoxBatch.build(unitBox, material, bevel?)` returning `THREE.Mesh` (an `InstancedMesh` when `bevel` is 0).

- [ ] **Step 1: Bevelled box batches in `room.ts`**

a. Add imports below the `three` import:

```ts
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
```

(`artworks.ts` already imports `mergeGeometries`; use the same module specifier it uses if it differs.)

b. Replace `BoxBatch.build` with:

```ts
  /**
   * bevel = 0: one instanced unit box (cheap, hard edges; the low tier).
   * bevel > 0: every box at its true size with rounded edges, merged into one
   * mesh. A hard 90 degree edge catches no highlight and reads as a game level.
   */
  build(unitBox: THREE.BufferGeometry, material: THREE.Material, bevel = 0): THREE.Mesh {
    if (bevel <= 0) {
      const mesh = new THREE.InstancedMesh(unitBox, material, this.boxes.length);
      const m = new THREE.Matrix4();
      this.boxes.forEach((b, i) => {
        m.makeScale(b.s[0], b.s[1], b.s[2]).setPosition(b.c[0], b.c[1], b.c[2]);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      return mesh;
    }
    const parts = this.boxes.map((b) => {
      const r = Math.min(bevel, Math.min(b.s[0], b.s[1], b.s[2]) * 0.25);
      return new RoundedBoxGeometry(b.s[0], b.s[1], b.s[2], 2, r).translate(b.c[0], b.c[1], b.c[2]);
    });
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return new THREE.Mesh(merged ?? unitBox, material);
  }
```

c. Change the declaration `const instanced: THREE.InstancedMesh[] = [];` to:

```ts
  const instanced: THREE.Mesh[] = [];
```

d. In the assemble loop, replace `const mesh = batch.build(unitBox, material);` with:

```ts
    const mesh = batch.build(unitBox, material, high ? 0.012 : 0);
    if (mesh.geometry !== unitBox) geometries.push(mesh.geometry);
```

e. In `dispose`, replace `instanced.forEach((m) => m.dispose());` with:

```ts
    instanced.forEach((m) => (m as THREE.InstancedMesh).isInstancedMesh && (m as THREE.InstancedMesh).dispose());
```

- [ ] **Step 2: Skirting board and picture rail**

In `room.ts`, in the corridor section, directly below the line that adds the skylight curb (`stoneBoxes.add(side * SKY_HALF, vaultY(SKY_HALF) - 0.05, CORRIDOR_MID, 0.12, 0.14, CORRIDOR_LEN);`) and inside the same `for (const side of [-1, 1] as const)` loop, add:

```ts
    // Skirting board at the foot of the dado, and a picture rail above the frames
    // (tallest frame plus its lamp tops out near 3.85m; capitals start at 4.95m).
    stoneBoxes.add(side * (HW - 0.0125), 0.07, CORRIDOR_MID, 0.025, 0.14, CORRIDOR_LEN);
    giltBoxes.add(side * (HW - 0.015), 4.35, CORRIDOR_MID, 0.03, 0.045, CORRIDOR_LEN);
```

- [ ] **Step 3: Bevelled plinth**

In `centerpiece.ts`, add the import:

```ts
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
```

Replace the six lines that create `plinth` and `step` (from `const plinth = add(new THREE.Mesh(unitBox, plinthMat));` through `step.position.y = 0.035;`) with:

```ts
  const edge = low ? 0 : 0.012;
  const plinth = add(
    new THREE.Mesh(own(new RoundedBoxGeometry(PLINTH.width, PLINTH.height, PLINTH.depth, 3, edge)), plinthMat),
  );
  plinth.position.y = PLINTH.height / 2;

  const step = add(
    new THREE.Mesh(own(new RoundedBoxGeometry(PLINTH.width + 0.16, 0.07, PLINTH.depth + 0.16, 3, edge)), plinthMat),
  );
  step.position.y = 0.035;
```

- [ ] **Step 4: Run the gates and compare stills**

```bash
npx tsc --noEmit -p . && npm test && npm run build
npx serve out -l 4173 & SERVE_PID=$!; sleep 2
node scripts/shots.mjs --out=.stills/geometry && node scripts/shots.mjs --out=.stills/geometry --center
node scripts/shots.mjs --out=.stills/geometry-low --q=low
kill $SERVE_PID
```

Read `.stills/geometry/light-citcd-center.png`, `.stills/geometry/light-centerpiece.png`, `.stills/geometry/light-door.png`. Expected: pilaster, cornice, bench and plinth edges carry a thin highlight line; a stone skirting runs along the foot of both corridor walls and a thin gilt rail above the frames; no frame, lamp or label intersects the rail; marble on the plinth and dado blocks is not stretched or smeared. If a frame's lamp touches the rail, raise the rail's `4.35` to `4.5`. Read `.stills/geometry-low/light-centerpiece.png`: unchanged apart from the skirting and rail.

- [ ] **Step 5: Commit**

```bash
git add components/gallery3d
git commit -m "feat(gallery): bevelled edges, skirting board and picture rail"
```

---

### Task 11: Step-down and documentation

**Files:**
- Create: `components/gallery3d/logic/qualityStepDown.ts`, `components/gallery3d/logic/qualityStepDown.test.ts`
- Modify: `components/gallery3d/engine.ts` (`frame`), `components/gallery3d/README.md`

**Interfaces:**
- Consumes: `dprPenalty`, `currentDpr`, `sized`, `resize` (Task 5); `invalidateStatic` (Task 7); `pipeline.set` (Task 9).
- Produces:
  - `type Budget = { dprPenalty: number; gtao: boolean; sunShadow: 4096 | 2048; bloom: boolean }`
  - `FULL_BUDGET: Budget`
  - `stepDown(budget: Budget, pixelRatio: number): Budget | null`
  - `createFrameMonitor(slowMs?: number, run?: number): { push(ms: number): boolean; reset(): void }`

- [ ] **Step 1: Write the failing tests**

`components/gallery3d/logic/qualityStepDown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FULL_BUDGET, createFrameMonitor, stepDown } from './qualityStepDown';

describe('stepDown', () => {
  it('gives up extra pixel ratio first, while it is above 2', () => {
    expect(stepDown(FULL_BUDGET, 3)).toEqual({ ...FULL_BUDGET, dprPenalty: 1 });
  });
  it('then drops GTAO, the sun shadow map size, then bloom', () => {
    const a = stepDown(FULL_BUDGET, 2);
    expect(a).toEqual({ ...FULL_BUDGET, gtao: false });
    const b = stepDown(a!, 2);
    expect(b).toEqual({ ...FULL_BUDGET, gtao: false, sunShadow: 2048 });
    const c = stepDown(b!, 2);
    expect(c).toEqual({ dprPenalty: 0, gtao: false, sunShadow: 2048, bloom: false });
  });
  it('returns null when nothing is left to give up', () => {
    expect(stepDown({ dprPenalty: 0, gtao: false, sunShadow: 2048, bloom: false }, 2)).toBeNull();
  });
});

describe('createFrameMonitor', () => {
  it('fires after eight consecutive slow frames, then starts over', () => {
    const monitor = createFrameMonitor();
    const results = Array.from({ length: 9 }, () => monitor.push(30));
    expect(results).toEqual([false, false, false, false, false, false, false, true, false]);
  });
  it('is reset by one fast frame', () => {
    const monitor = createFrameMonitor();
    for (let i = 0; i < 7; i++) monitor.push(30);
    monitor.push(10);
    expect(monitor.push(30)).toBe(false);
  });
  it('ignores hiccups and nonsense: a tab switch is not a slow GPU', () => {
    const monitor = createFrameMonitor();
    for (let i = 0; i < 7; i++) monitor.push(30);
    expect(monitor.push(900)).toBe(false);
    expect(monitor.push(NaN)).toBe(false);
    expect(monitor.push(0)).toBe(false);
    expect(monitor.push(30)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run components/gallery3d/logic/qualityStepDown.test.ts`
Expected: FAIL, cannot resolve `./qualityStepDown`.

- [ ] **Step 3: Implement `components/gallery3d/logic/qualityStepDown.ts`**

```ts
// What the high tier gives up, and in what order, when frames run slow.

export type Budget = {
  /** Pixel-ratio steps given up (see pixelRatio.ts). */
  dprPenalty: number;
  gtao: boolean;
  sunShadow: 4096 | 2048;
  bloom: boolean;
};

export const FULL_BUDGET: Budget = { dprPenalty: 0, gtao: true, sunShadow: 4096, bloom: true };

/** The next cheaper budget, or null when nothing is left. `pixelRatio` is the ratio in use now. */
export function stepDown(budget: Budget, pixelRatio: number): Budget | null {
  if (pixelRatio > 2) return { ...budget, dprPenalty: budget.dprPenalty + 1 };
  if (budget.gtao) return { ...budget, gtao: false };
  if (budget.sunShadow === 4096) return { ...budget, sunShadow: 2048 };
  if (budget.bloom) return { ...budget, bloom: false };
  return null;
}

/** Longer than this is a hiccup (tab switch, garbage collection), not a slow GPU. */
const HICCUP_MS = 250;

/** `push` returns true once `run` consecutive frames took longer than `slowMs`. */
export function createFrameMonitor(slowMs = 24, run = 8) {
  let slow = 0;
  return {
    push(ms: number): boolean {
      if (!Number.isFinite(ms) || ms <= 0 || ms > HICCUP_MS) {
        slow = 0;
        return false;
      }
      if (ms <= slowMs) {
        slow = 0;
        return false;
      }
      if (++slow < run) return false;
      slow = 0;
      return true;
    },
    reset() {
      slow = 0;
    },
  };
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run components/gallery3d/logic/qualityStepDown.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire it into the engine**

a. Add to the static imports of `engine.ts`:

```ts
import { FULL_BUDGET, createFrameMonitor, stepDown } from './logic/qualityStepDown';
```

b. Directly above `function frame(now: number) {`, add:

```ts
    let budget = FULL_BUDGET;
    const monitor = createFrameMonitor();
    const applyStepDown = () => {
      const next = stepDown(budget, currentDpr);
      if (!next) return;
      if (next.dprPenalty !== budget.dprPenalty) {
        dprPenalty = next.dprPenalty;
        sized = '';
        resize();
      }
      if (next.gtao !== budget.gtao) pipeline?.set({ gtao: next.gtao });
      if (next.bloom !== budget.bloom) pipeline?.set({ bloom: next.bloom });
      if (next.sunShadow !== budget.sunShadow) {
        scene.traverse((o) => {
          const light = o as THREE.DirectionalLight;
          if (!light.isDirectionalLight || !light.castShadow) return;
          light.shadow.mapSize.set(next.sunShadow, next.sunShadow);
          light.shadow.map?.dispose();
          light.shadow.map = null;
        });
        invalidateStatic();
      }
      budget = next;
    };
```

`sized` and `resize` are declared in the `// ---- size` section below `frame`; they are only used when `applyStepDown` runs, which is after `start()` has finished, so the order is safe. If TypeScript reports use-before-declaration for `sized`, move the `let sized = '';` line above this block.

c. In `frame()`, replace the two lines

```ts
      const dt = lastT ? clamp((now - lastT) / 1000, 0.001, 0.05) : 1 / 60;
      lastT = now;
```

with:

```ts
      // Only gaps between consecutive animation frames say anything about speed.
      if (quality === 'high' && lastT && monitor.push(now - lastT)) applyStepDown();
      const dt = lastT ? clamp((now - lastT) / 1000, 0.001, 0.05) : 1 / 60;
      lastT = now;
```

- [ ] **Step 6: Run the gates**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all pass, 33 tests in 4 files.

- [ ] **Step 7: Check the step-down in the browser**

Write `.stills/check-stepdown.mjs` (CPU throttling makes every frame slow):

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
await context.addInitScript(() => localStorage.removeItem('gmode'));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4173/?g3debug&g3q=high');
await page.waitForSelector('html[data-g3="live"]');
await page.waitForTimeout(4000);
const client = await context.newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });
for (let i = 0; i < 9; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(1800); }
await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await page.waitForTimeout(1500);
console.log('page errors:', errors.length ? errors : 'none');
console.log('mode:', await page.evaluate(() => document.documentElement.dataset.gmode));
await page.screenshot({ path: '.stills/stepdown.png' });
await browser.close();
```

Run with the server up. Expected: `page errors: none`, `mode: 3d`. Read `.stills/stepdown.png`: the gallery renders normally (possibly without AO, with coarser shadows or without glow), with no black frame and no missing surfaces.

- [ ] **Step 8: Final stills for the owner**

```bash
npx serve out -l 4173 & SERVE_PID=$!; sleep 2
node scripts/shots.mjs --out=.stills/final && node scripts/shots.mjs --out=.stills/final --center
kill $SERVE_PID
```

These, beside `.stills/baseline/`, are what the owner judges realism from.

- [ ] **Step 9: Rewrite `components/gallery3d/README.md`**

Make these changes, keeping the sections not mentioned:

a. **Status**: replace the bullets with the current state: all work committed on `gallery-home`; gates are `npx tsc --noEmit -p .`, `npm test`, `npm run build`; deployment unchanged (keep the wrangler paragraph).

b. **Running it**: add

```
npm test               # unit tests for logic/
npm run shots -- --out=.stills/now            # stills at five stops, both themes
npm run shots -- --out=.stills/now --center   # the same, on the centre line
npm run capture        # recapture site screenshots (serve ./out on 4173 first)
npm run textures       # re-download the scanned texture sets
```

and the URL flags: `?g3q=low` or `?g3q=high` forces a tier; `?g3debug` exposes `window.__g3.renderer` and a frame counter on `canvas.dataset.g3frames`.

c. **Files**: add rows for `logic/arrowFade.ts`, `logic/artworkTiers.ts`, `logic/pixelRatio.ts`, `logic/qualityStepDown.ts`, `render/materialLibrary.ts`, `render/environment.ts`, `render/unlit.ts`, `render/pipeline.ts`, `scripts/shots.mjs`, `scripts/capture-gallery.mjs`, `scripts/fetch-textures.mjs`, each with the one-line responsibility from this plan's File Structure table.

d. **Rendering**: replace the section with:

```markdown
### Rendering

- Render on demand: the rAF loop stops when the camera has settled and no part
  reports it is animating (the centrepiece animates while within 1.5 stops).
- Two tiers. High: scanned 1K / 2K materials, room reflections, static shadow
  maps, post chain, 2400px artworks near the visitor. Low: 512px / 1K
  materials, room reflections, no shadow maps, no post chain, painted contact
  shadows, 1200px artworks, pixel ratio at most 1.5.
- Static bakes. Shadow maps and the two room cube maps (corridor, salon) render
  at load, on a theme switch, when a surface texture arrives and when the
  shatter ends. Parts ask for this with `ctx.invalidateStatic()`; the engine
  coalesces requests to one bake per 250ms. The only per-frame shadow update is
  the centrepiece spot during its two-second shatter.
- Reflections show this room: `render/environment.ts` renders the gallery into
  cube maps and hands the prefiltered result to every registered material.
  Glass and artwork canvases sample the unfiltered cube in their own shaders.
- Post chain (high tier): scene to a multisampled half-float target, GTAO at
  half resolution, bloom with a threshold above 1, then a grade pass. Lit
  materials write alpha 1 and are ACES tone-mapped; screenshots, labels, the
  plaque, the monitor, the door image and the sign write alpha 0
  (`render/unlit.ts`) and keep their exact colours. Without the chain the
  renderer's own ACES applies and those materials are `toneMapped: false`.
- Pixel ratio is capped by pixel count (8 megapixels, 12 while pinch-zoomed),
  not by ratio, so browser zoom stays sharp at no extra cost.
- Eight consecutive frames over 24ms step the high tier down: pixel ratio above
  2, then GTAO, then the sun shadow map to 2048, then bloom.
```

e. **Tuning**: add bullets: arrow fade and position in `logic/arrowFade.ts` (`ARROW_FADE`) and `STAND_BACK` in `contract.ts`; material scale and sheen in the `lib.apply` calls in `scene/room.ts`; reflection strength through `register(..., { intensity })`; shadow bias on each light; AO, bloom and grade constants at the top of `createPipeline` and in `GradePass.uniforms`; pixel budget in `logic/pixelRatio.ts` (`DPR`).

f. **Bugs fixed along the way**: add:

```markdown
- The floor nearer than about 3m is off screen while looking down the gallery
  (58 degree vertical field of view, level gaze). A floor marker must lie at
  least `STAND_BACK` ahead of the camera or it cannot be seen.
- `GTAOPass` re-renders the scene with a normal material, so glow planes,
  glass and floor markers occlude unless hidden for that pass (`soft()` in
  `render/pipeline.ts`).
- A stock `OutputPass` tone-maps `toneMapped: false` materials too, turning
  white web pages grey. Hence the alpha mask and the custom grade pass.
- The reflection map is also bounce light. Registering materials without
  lowering `hemiIntensity` overexposes the room.
```

g. **Not yet verified**: keep the real-phone / iOS Safari bullet and add "The post chain and shadow maps on integrated GPUs and on Safari / Firefox: checked in headless Chromium only." Remove bullets this work verified (floor ring, night mode facing a work) only if the stills from this plan actually showed them working; otherwise leave them.

h. **Open items**: remove "Source screenshots in `public/gallery/` are 1200px wide..." and "At night the salon's red walls read near-black...". Keep the others.

- [ ] **Step 10: Commit**

```bash
git add components/gallery3d
git commit -m "feat(gallery): quality step-down under slow frames; README for the realism pass"
```

- [ ] **Step 11: Hand over**

Report to the owner: the commit list (`git log --oneline 2625df7..HEAD`), the paths `.stills/baseline/` and `.stills/final/` for side-by-side review, any capture that failed in Task 3, and the items still unverified (real phone, iOS Safari, non-Chromium browsers). Realism is the owner's call: ask which stops still read as artificial and tune from the lists in Tasks 6 to 9.
