# 3D Gallery

The homepage (`app/(gallery)/page.tsx`) is a walkable 3D art gallery built with
plain three.js. A visitor walks down a Louvre-style vaulted corridor past nine
framed works (the sites in `data/gallery.ts`), into a round salon where Apache
Tandoori sits in a smashed glass case, with a doorway to Room 2 (`/school/`).

Navigation follows Google Street View: you stand on the corridor centre line
looking down the gallery, click floor markers to walk, and click a work to step
over and face it.

## Status

- Branch `gallery-home`. **Nothing from this work is committed.**
- Changed: `app/(gallery)/layout.tsx`, `app/(gallery)/page.tsx`, `package.json`
  (+ `three`, `@types/three`), `package-lock.json`.
- New: `components/gallery3d/`, `app/(gallery)/gallery3d.css`.
- `npm run build` and `npx tsc --noEmit -p .` both pass.
- Not deployed. `wrangler.jsonc` already serves `./out` as a static-assets
  Worker (`learnnovice-portfolio`); the wrangler login on this machine has
  expired, so `npx wrangler login` is needed first. Then `npm run build` and
  either `npx wrangler versions upload` (preview URL, live site untouched) or
  `npx wrangler deploy` (replaces the live site).

## Running it

```
npm run build          # static export to ./out
npx serve out -l 4173  # http://localhost:4173
```

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
| `scene/navArrows.ts` | Street View floor markers, the mouse floor ring and the wall highlight square. |
| `app/(gallery)/gallery3d.css` | All 3D-mode styles, scoped under `.g3`. Later rules at the end of the file override earlier ones. |

Each scene module exports one factory (`createRoom`, `createArtworks`,
`createCenterpiece`, `createNavArrows`) returning a `ScenePart`:
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
  reports it is animating. Verified at zero draw calls when idle.
- No shadow maps, no environment map. At most three real lights in the room and
  one in the centrepiece; everything else (picture-light pools, contact
  shadows, the spotlight beam) is faked with shader terms and additive planes.
- ACES tone mapping, sRGB output, device pixel ratio capped at 2 (1.5 on
  low-end devices).
- All surface textures are procedural canvases painted in `room.ts`.

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
  `PALETTES`.

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
- Night mode while facing a work, and the frosted caption panel in night mode.

## Open items

- `apache-tandoori` and `cpts-companion` still use their 1200px JPEGs: both
  sites show a login screen to `npm run capture`. Capture them signed in at
  2400px wide and save as `public/gallery/<id>.webp` and `<id>-1200.webp`.
- The Tandoori logo on the plaque is 144px; supply a larger source.
- The Apache Tandoori button still points to `view.learnnovice.com`. Change
  `centerpiece.href` in `data/gallery.ts` once the repository is public.
- Source screenshots in `public/gallery/` are 1200px wide. Sampling is as sharp
  as it can be; truly crisp canvases need recapturing at about 2400px.
- At night the salon's red walls read near-black under the cool moonlight.
  Warming the night light in `room.ts` would bring the colour back.
- In the centre view there is no floor marker for going back (that direction is
  behind the camera). `↓` and the HUD `←` cover it.
- On desktop in light mode the rope stanchion can cross the centrepiece
  caption.
