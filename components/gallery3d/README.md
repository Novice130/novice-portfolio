# 3D Gallery

The homepage (`app/(gallery)/page.tsx`) is a walkable 3D art gallery built with
plain three.js. A visitor walks down a Louvre-style vaulted corridor past nine
framed works (the sites in `data/gallery.ts`), into a round salon where Apache
Tandoori sits in a smashed glass case, with a doorway to Room 2 (`/school/`).

Navigation follows Google Street View: you stand on the corridor centre line
looking down the gallery, click floor markers to walk, and click a work to step
over and face it.

## Status

- Branch `gallery-home`; all work is committed.
- Gates: `npx tsc --noEmit -p .`, `npm test`, `npm run build`.
- Not deployed. `wrangler.jsonc` already serves `./out` as a static-assets
  Worker (`learnnovice-portfolio`); the wrangler login on this machine has
  expired, so `npx wrangler login` is needed first. Then `npm run build` and
  either `npx wrangler versions upload` (preview URL, live site untouched) or
  `npx wrangler deploy` (replaces the live site).

## Running it

```
npm run build          # static export to ./out
npx serve out -l 4173  # http://localhost:4173
npm test               # unit tests for logic/
npm run shots -- --out=.stills/now            # stills at five stops, both themes
npm run shots -- --out=.stills/now --center   # the same, on the centre line
npm run capture        # recapture site screenshots (serve ./out on 4173 first)
npm run textures       # re-download the scanned texture sets
```

If `npx serve` fails, `python3 -m http.server 4173 --bind 127.0.0.1 --directory out`
does the same job. The stills script takes `--base=http://127.0.0.1:4173`,
`--only=citcd,centerpiece`, `--theme=light`, `--q=low` and `--post=noao,nograde`.

URL flags: `?g3q=low` or `?g3q=high` forces a tier. `?g3debug` exposes
`window.__g3` (`renderer`, `camera`, `scene`, `stepDown()`) and a frame counter
on `canvas.dataset.g3frames`; with it, `&g3post=noao,nograde` switches parts of
the post step off.

`next dev` also works. Deep links: `/#citcd`, `/#centerpiece`, `/#door` and so
on open at that stop (a work's link opens facing the work).

## Files

| File | Role |
|---|---|
| `contract.ts` | Shared contract: world coordinates, corridor / salon dimensions, hanging rules, `stops[]`, and the `SceneCtx` / `ScenePart` / `Hotspot` types every scene module builds against. Start here. |
| `engine.ts` | Framework-free three.js engine: renderer, camera rail, springs, picking, render-on-demand loop. All tunables are in `TUNING` at the top. |
| `Gallery3D.tsx` | Client shell and HUD: mode switch (3D / list), input handling (wheel, swipe, keys, hash), caption cards, prev / next, progress rail, loading curtain. |
| `scene/room.ts` | Architecture and all general lighting: corridor, vault, skylight, salon, dome, doorway, procedural textures, fog, background. |
| `scene/artworks.ts` | The nine framed works: canvases, frames, wall labels, picture lights and their faked light pools. |
| `scene/centerpiece.ts` | Apache Tandoori: plinth, screen, broken glass case, shards, rope, spotlight, one-shot shatter animation on arrival. |
| `scene/navArrows.ts` | Street View floor markers, the mouse floor ring and the wall highlight square. Must stay the last factory in `engine.ts`. |
| `scene/visitors.ts` | Two visitors and a cat guide, as stand-in figures until rigged models are supplied. |
| `logic/visitors.ts` | Their behaviour on the floor plane; no three.js. |
| `logic/arrowFade.ts` | Side arrow opacity, hit threshold, floor position. |
| `logic/artworkTiers.ts` | Image URLs per tier; which works hold a 2400px texture. |
| `logic/pixelRatio.ts` | Pixel ratio policy. |
| `logic/qualityStepDown.ts` | Slow-frame monitor and step-down order. |
| `render/materialLibrary.ts` | Loads the scanned texture sets and applies them to materials. |
| `render/environment.ts` | Bakes two room cube maps and assigns them to materials. |
| `render/pipeline.ts` | High tier post step: ambient occlusion, vignette and grain over the direct render. |
| `scripts/shots.mjs` | Before / after stills at fixed stops and themes. |
| `scripts/capture-gallery.mjs` | Recaptures site screenshots at 2400px. |
| `scripts/fetch-textures.mjs` | Downloads and converts the five Poly Haven sets. |
| `app/(gallery)/gallery3d.css` | All 3D-mode styles, scoped under `.g3`. Later rules at the end of the file override earlier ones. |

Each scene module exports one factory (`createRoom`, `createArtworks`,
`createCenterpiece`, `createVisitors`, `createNavArrows`) returning a `ScenePart`:
`{ group, hotspots?, setTheme, update?, dispose }`. The engine imports them
dynamically, so three.js stays out of the initial bundle.

## How it works

### Modes and themes

Three attributes on `<html>` drive everything, set before first paint by the
inline script in `app/(gallery)/layout.tsx`:

- `data-gmode` = `3d` | `flat`. Flat shows the original 2D gallery markup
  (`components/gallery/`), which is also what no-JS visitors and crawlers get.
  Persisted in `localStorage.gmode`. No WebGL2, or a runtime failure, falls
  back to flat automatically.
- `data-gtheme` = `light` | `dark`, toggled by the existing `LightSwitch`,
  persisted in `localStorage.gtheme`. The engine watches the attribute and
  calls `setTheme` on every part.
- `data-g3` = `live` once the walk is running, `none` if 3D is unavailable.

Two more are set at runtime:

- `data-g3walk` while the camera is in transit (the HUD fades the caption).
- `data-g3face` while facing a work, and at every non-work stop. Absent means
  "looking down the gallery": the caption is hidden and `navArrows` shows the
  forward and side markers instead of the left / right pair.

### Stops and the camera

`stops[]` in `contract.ts` is the ordered rail: `intro`, nine `piece` stops,
`centerpiece`, `door`. `focus` is a fractional index into it.

A work stop has two poses:

- `aheadCam`: on the centre line, 3.2m before the work, looking down the
  gallery. Walking moves between these.
- `cam` / `look`: stepped across the corridor, facing the work square on.

The engine blends from the first to the second with a "gaze" spring once the
visitor chooses the work (`engine.setFace(true)`), and only when nearly at the
stop. The last leg, centrepiece to door, orbits the plinth instead of cutting
through it.

The page keeps one 100svh `<section>` per stop so the scrollbar, hash links and
assistive tech still work, but wheel and touch do not follow raw scroll: they
step exactly one stop per gesture. Following raw scroll let trackpad momentum
drag the camera back and forth.

### Input

| Input | Result |
|---|---|
| Forward floor disc, wheel, swipe up / left, `↑`, `PageDown` | Walk to the next stop |
| Wheel back, swipe down / right, `PageUp`, HUD `←` | Previous stop |
| Side floor arrow, click a work, `←` / `→` toward its wall, `Enter` on its caption | Step over and face the work; caption appears |
| Click a faced work again, or the caption button | Open the site |
| `↓` or `Esc` while facing a work | Step back to the centre line |
| `←` / `→` while facing a work | Previous / next along the gallery |
| Click the floor | Walk to the nearest stop |
| `Home` / `End` | First / last stop |

Hotspot ids the shell understands: a stop id, `nav:next`, `nav:prev`,
`nav:face`, and `nav:goto:N` (the engine turns a `nav:floor` hit into this).

### Rendering

- Render on demand: the rAF loop stops when the camera has settled and no part
  reports it is animating (the centrepiece animates while within 1.5 stops).
- Two tiers. High: scanned 1K / 2K materials, room reflections, static shadow
  maps, post step, bevelled edges, 2400px artworks near the visitor. Low:
  512px / 1K materials, room reflections, no shadow maps, no post step, painted
  contact shadows, hard edges, 1200px artworks, pixel ratio at most 1.5.
- Static bakes. Shadow maps and the two room cube maps (corridor, salon) render
  at load, on a theme switch, when a surface texture arrives and when the
  shatter ends. Parts ask for this with `ctx.invalidateStatic()`; the engine
  coalesces requests to one bake per 250ms. The only per-frame shadow update is
  the centrepiece spot during its two-second shatter.
- Reflections show this room: `render/environment.ts` renders the gallery into
  cube maps and hands the prefiltered result to every registered material.
  Glass and artwork canvases sample the unfiltered cube in their own shaders.
  Each zone has two cube targets; a bake draws into the one not handed out and
  swaps. Reflection strength is scaled per theme (`TUNING.envScale`).
- Post step (high tier): the scene is drawn straight to the canvas with the
  renderer's ACES tone mapping, exactly as on the low tier. `GTAOPass` then
  computes occlusion at full resolution from its own depth and normal pass, and
  one full-screen draw multiplies occlusion, a vignette and a little grain over
  the image. There is no off-screen colour target and no bloom.
- Pixel ratio is capped by pixel count (8 megapixels, 12 while pinch-zoomed),
  not by ratio, so browser zoom stays sharp at no extra cost.
- Eight consecutive frames over 24ms step the high tier down: pixel ratio above
  2, then ambient occlusion, then the sun shadow map to 2048.

## Tuning

- **Walk feel**: `TUNING` in `engine.ts`. `smoothTime` (walk speed),
  `paceCeremony` (slower approach to the salon), `faceTime` (turn to a work),
  `bobY` / `bobX` / `stride` (head bob), `fovPush`, `fovAhead`,
  `viewShiftLandscape` (how far the scene slides right to clear the caption).
- **Where the visitor stands**: `stops` in `contract.ts`. `HANG.maxWidth` is
  1.7m so a frame plus its wall label fits between the pilasters.
- **Lighting**: the `THEMES` table in `room.ts` (ambient, moonlight, fog, gilt
  glow per theme), `NIGHT` / `DAY` at the top of `artworks.ts` (picture-light
  strength), `THEMES` in `centerpiece.ts` (spotlight).
- **Floor markers**: constants at the top of `navArrows.ts`, palettes in
  `PALETTES`. Arrow fade and position in `logic/arrowFade.ts` (`ARROW_FADE`)
  and `STAND_BACK` in `contract.ts`.
- **Materials**: scale and sheen in the `lib.apply` calls in `scene/room.ts`.
- **Reflections**: per material through `register(..., { intensity })`, per
  theme through `TUNING.envScale` in `engine.ts`.
- **Shadows**: bias on each light.
- **Post step**: `AO_INTENSITY`, `VIGNETTE`, `GRAIN` and the `GTAOPass`
  parameters in `render/pipeline.ts`.
- **Pixel budget**: `DPR` in `logic/pixelRatio.ts`.

## Bugs fixed along the way

Worth knowing so they are not reintroduced:

- The camera must use Euler order `YXZ`. Reading pitch and yaw back in the
  default `XYZ` order is unstable when facing a side wall and shows up as
  jitter.
- `THREE.Raycaster` ignores `.visible`, so the engine's `pick` filters hidden
  objects by hand. Without that, faded-out markers stay clickable.
- Screen-anchored markers yaw the root to the camera and rotate the chevron
  inside the disc. Yawing the root 180° for a left-pointing arrow tilts it away
  from the viewer.
- The two inline scripts in the layout are joined with `;`. Concatenating two
  IIFEs without it throws before first paint.
- `data-g3face` is refreshed in the scroll handler as well as in `go()`, or the
  caption never appears at stops reached by hash link or scrollbar.
- The floor nearer than about 3m is off screen while looking down the gallery
  (58 degree vertical field of view, level gaze). A floor marker must lie at
  least `STAND_BACK` ahead of the camera or it cannot be seen.
- `GTAOPass` re-renders the scene with a normal material, so glow planes,
  glass and floor markers occlude unless hidden for that pass (`soft()` in
  `render/pipeline.ts`).
- Do not render the scene into an off-screen linear target for post effects.
  The glow planes, light pools and decals are authored for blending in display
  space; blended in linear light, the additive ones washed the salon wall from
  deep red to pale pink and flattened the floor gloss. Ambient occlusion at
  half resolution also left a ragged fringe beside pilasters.
- Never render into a cube map that a shader in the scene is sampling. The
  bake did, Chromium reported a feedback loop and silently dropped the artwork
  and glass draws from the reflection. Hence the two targets per zone.
- The reflection map is also bounce light. Registering materials without
  lowering the ambient overexposes the room, and at night the lit works in the
  bake lift every wall to grey unless `TUNING.envScale.dark` holds it down.

## Not yet verified

- A real phone or iOS Safari. Only desktop Chromium, plus a 390×844 emulated
  viewport on earlier passes; the phone layout has not been viewed since the
  Street View navigation and the frosted caption panel went in.
- Motion quality. Frame pacing was measured and stills reviewed, but nobody has
  watched the walk, the pan to a work or the caption reveal for smoothness
  since the jitter fixes.
- The mouse floor ring and the highlight square on works: built, never seen
  working.
- The centrepiece and door stops under the Street View camera model, the list
  view toggle and the reduced-motion path after the later passes.
- The frosted caption panel in night mode.
- The post step and shadow maps on integrated GPUs and on Safari / Firefox:
  checked in headless Chromium (software GL) only, where frame times are too
  long to say anything about real cost. Full-resolution ambient occlusion about
  doubled the frame time there.
- The automatic step-down under real slow frames. The order is unit-tested and
  each step was forced through `window.__g3.stepDown()`, but headless frames
  are longer than the 250ms hiccup limit, so the monitor never fired by itself.

## Open items

- `apache-tandoori` and `cpts-companion` still use their 1200px JPEGs: both
  sites show a login screen to `npm run capture`. Capture them signed in at
  2400px wide and save as `public/gallery/<id>.webp` and `<id>-1200.webp`.
- The Tandoori logo on the plaque is 144px; supply a larger source.
- The Apache Tandoori button still points to `view.learnnovice.com`. Change
  `centerpiece.href` in `data/gallery.ts` once the repository is public.
- The visitors and the cat are grey stand-ins. Wanted: two dressed Mixamo
  characters with idle and walking animations and one animated cat, in
  `public/gallery/models/`; then replace `buildPerson` / `buildCat` in
  `scene/visitors.ts`.
- A 404 for `gallery/apache-tandoori.webp` is logged on load. It is the
  designed fallback to the JPEG and goes away with the capture above.
- In the centre view there is no floor marker for going back (that direction is
  behind the camera). `↓` and the HUD `←` cover it.
- On desktop in light mode the rope stanchion can cross the centrepiece
  caption.
