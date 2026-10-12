# 3D gallery: arrows, sharpness and realism

Date: 2026-10-13
Branch: `gallery-home`
Baseline commit: `2625df7`

## Goal

The 3D gallery homepage should read as a real room, not a stylised game level.
Three things were asked for:

1. The left / right arrow that leads to a work should only be visible when the
   visitor is near that work.
2. Artworks and their wall plates must stay sharp when viewed close up or
   zoomed.
3. The whole gallery should look realistic rather than cartoonish.

Success is judged by the owner on before / after stills and a live walk. The
measurable parts (arrow visibility, sharpness at zoom, idle draw calls, frame
time on the low tier) are verified as described under Testing.

## Constraints and assumptions

Stated by the owner:

- Realism target is real-time with baked-quality lighting: scanned materials,
  room reflections, soft shadows, ambient occlusion, light bloom and grain.
- The arrow lies flat on the floor, never on the wall or the picture.
- Screenshots are recaptured from the live sites.

Assumed (not contradicted during design):

- Plain three.js (`^0.170.0`), Next.js static export, Cloudflare static assets.
  No new runtime dependency.
- Phones must still run the walk; the flat list view remains the fallback.
- Layout, stops and the navigation model stay. This is a look and polish pass.
- Render on demand stays: zero draw calls when the camera is settled.

Out of scope: Blender-baked lightmaps, modelled GLB geometry, depth of field,
motion blur, any change to the flat list view, deployment.

## Findings that drive the design

- Source screenshots in `public/gallery/` are 1200px wide and are hung up to
  1.7m wide, so they are magnified at close range.
- The renderer caps device pixel ratio at 2 (1.5 on the low tier). Browser zoom
  and pinch past that upscale the whole canvas, which blurs even the wall
  plates whose textures are already dense.
- Arrows already hide while walking. The real cause of "always visible" is that
  each work stop stands 3.2m before the work on the centre line and shows the
  side arrow at the visitor's feet there.
- The cartoon look comes from: no shadow maps, no environment map, flat
  painted canvas textures with no normal or roughness maps, low metalness on
  metals, an unlit-looking glass case, hard geometric edges, no post chain.

## Architecture

New units under `components/gallery3d/render/`, each with one job:

| Unit | Job | API |
|---|---|---|
| `pipeline.ts` | Post chain: `RenderPass`, `GTAOPass`, `UnrealBloomPass`, `OutputPass` with grain and vignette. High tier only. | `render()`, `setSize(w, h, dpr)`, `setTheme(theme)`, `dispose()` |
| `environment.ts` | Renders the room into two cube maps (mid-corridor, salon), prefilters them with `PMREMGenerator`. Hides floor markers and cursors during the bake. | `bake()`, `corridor`, `salon` (textures), `dispose()` |
| `materialLibrary.ts` | Loads scanned PBR sets from `public/gallery/tex/<name>/{color,normal,rough}.webp` at 2K or 1K by tier. | `get(name, repeat)` resolving to a texture triple, `dispose()` |

Pure decision logic lives in small testable modules with no three.js
dependency:

| Unit | Job |
|---|---|
| `logic/arrowFade.ts` | Opacity from camera-to-work distance; hit-target threshold. |
| `logic/pixelRatio.ts` | Pixel ratio from device ratio, zoom, tier, buffer size and recent frame times. |
| `logic/artworkTiers.ts` | Which works get the 2400px texture given the current stop; eviction past three. |
| `logic/qualityStepDown.ts` | Ordered step-down under sustained slow frames. |

Changed files:

- `contract.ts`: `SceneCtx` gains `materials` (the library), `env` (the two
  environment textures, possibly null) and `invalidateStatic()`. A part calls
  `invalidateStatic()` when the static look changed: a texture arrived, the
  theme switched, the shatter finished. The engine responds by re-rendering
  shadow maps once and re-baking the environment, coalesced to one bake per
  frame. `aheadCam` moves from 3.2m to 1.8m before each work. The budget
  comment is rewritten: static shadow maps are allowed, per-frame shadow
  updates are not, except the centrepiece spot during the shatter.
- `engine.ts`: enables `shadowMap` (`PCFSoftShadowMap`, `autoUpdate = false`),
  builds the pipeline on the high tier and routes the frame through it, applies
  the pixel-ratio policy, retunes gaze timing for the nearer stand point. The
  render-on-demand loop is otherwise untouched.
- `scene/room.ts`: materials from the library; sun and oculus light cast
  shadows; pilasters, benches and the door arch cast and receive. Fake
  ambient-occlusion decals are removed on the high tier and kept on the low
  tier. Bevels, skirting board and picture rail added.
- `scene/artworks.ts`: frames cast shadows; gilt and brass become true metals
  with environment reflection; the canvas gets a faint varnish sheen; tiered
  image loading; denser label and tag canvases; real moulding depth.
- `scene/centerpiece.ts`: glass case and shards become `MeshPhysicalMaterial`
  with environment reflection (no transmission pass); the spot casts a shadow;
  plinth marble from the library; bevelled plinth.
- `scene/navArrows.ts`: side arrow position and distance fade.

## Part 1: arrows

- The side arrow is a flat floor disc with a chevron, placed on the floor about
  0.9m out from the wall, centred on the work, chevron pointing at the work.
- Opacity follows true camera-to-work distance: 0 beyond 4.5m, 1 within 2.5m,
  smooth ramp between. It is multiplied with the existing settle fade, so the
  arrow is still hidden mid-walk.
- The hit target is disabled while opacity is below 0.3, so an invisible arrow
  is never clickable.
- `aheadCam` moves to 1.8m before each work so that on arrival the work is
  nearly beside the visitor and the arrow is at full opacity.
- The facing pair (previous / next while facing a work) is unchanged.
- Reduced motion: no ramp, the arrow is simply on within 2.5m.
- Intro, centrepiece and door stops are unchanged.

## Part 2: sharpness

### Recapture

`scripts/capture-gallery.mjs` reads `data/gallery.ts`, opens each `href` with
Playwright at a 1200px viewport and device scale 2, using the same crop heights
as the current images. For each work it writes:

- `public/gallery/<id>.webp`: 2400px wide, quality about 82, target under
  500 KB.
- `public/gallery/<id>-1200.webp`: 1200px wide.

The existing JPEGs stay for the flat list view and `og.jpg`. The centrepiece
image is recaptured the same way. The Tandoori logo (144px today) is replaced
with a 512px version from source if one exists, otherwise from a capture.

A site that is unreachable or returns a non-200 status is skipped, its old
image is kept, and the script exits non-zero listing the failures. It never
overwrites a good image with an error page. The script prints every output
path so all captures can be reviewed before they are committed.

### Tiered loading

- The 1200px image loads first for every work.
- The 2400px image loads only for the work at the current stop and its two
  neighbours, and is swapped in once decoded.
- At most three 2400px textures are alive; the furthest is disposed when a
  fourth is needed.
- The low tier never loads 2400px images.

### Pixel ratio

- Base cap: 2 on the high tier, 1.5 on the low tier.
- When browser zoom or pinch raises `devicePixelRatio` or
  `visualViewport.scale`, the high-tier cap rises to 3, provided the drawing
  buffer stays under about 8 megapixels.
- If frame time exceeds 24ms for several consecutive frames, the ratio steps
  back down.

### Plates and labels

Label canvases go from 3x to 4x on the high tier and the tag plate from 2x to
4x. Mipmaps and maximum anisotropy stay.

### Antialiasing

The post chain bypasses default canvas antialiasing, so the composer render
target uses 4-sample MSAA on the high tier. The low tier is unchanged.

## Part 3: realism

### Materials

CC0 scanned sets from Poly Haven or ambientCG, each with colour, normal and
roughness maps, as WebP at 2K (high tier) and 1K (low tier). About nine sets,
roughly 2.5 MB at 2K and 0.8 MB at 1K, all loaded after first paint. Each
surface shows its current procedural texture until the scan arrives.

| Surface | Becomes |
|---|---|
| Corridor floor | Scanned oak herringbone; roughness map breaks up reflections along the boards; normal map for joints. |
| Salon floor | Scanned polished marble tile, sharper reflection than the corridor. |
| Corridor walls | Scanned fine plaster with a subtle normal; current tint kept. |
| Salon walls | Scanned fabric base with the existing damask pattern multiplied over it. |
| Dado, plinth | Scanned marble, same set as the salon floor in a different tint. |
| Vault, dome, pilasters | Scanned limestone base; coffer pattern kept as a painted overlay with a derived normal so recesses catch light. |
| Gilt frames | Metalness 1, scanned gold-leaf roughness and normal, existing moulding profile. |
| Walnut frames | Scanned walnut. |
| Brass | Metalness 1 with a brushed roughness map. |
| Rope | Scanned rope or velvet normal, with sheen. |
| Glass case, shards | Physical material: environment reflection, fresnel edge brightening, thin green tint on shard rims. |
| Artwork canvas | Lit by its picture light, clearcoat about 0.15, slight reflection of the room. |

Source and licence of every set are listed in `public/gallery/tex/CREDITS.md`.

### Lighting

- Day: warm shadow-casting sun through the skylight; cool hemisphere fill,
  lowered so shadows have depth. Skylight panes emit enough for bloom.
- Night: cooler, less saturated moonlight; picture lights carry the scene. The
  salon night light is warmed so the red walls no longer read black.
- Picture lights stay faked as pools (nine real lights are too costly). The
  pool is rebuilt with inverse-square falloff at about 2700K, brightens the
  frame's top edge and adds a fake frame shadow below.
- Centrepiece spot: real shadow map, 2048 on the high tier.
- Exposure is retuned per theme after the environment map goes in.

### Shadows

- Sun: one 4096 map covering the corridor on the high tier, PCF soft.
- Rendered once at load, again on theme switch and when the shatter ends.
  During the shatter (about 2 seconds) only the centrepiece spot map updates
  per frame.
- GTAO provides contact shading for frames, skirting and the plinth.

### Reflections

Two cube bakes (mid-corridor and salon), 256px faces, prefiltered. Corridor
materials use the first, salon materials the second, assigned per material when
it is built. There is no per-frame blending. Re-baked on theme switch and when
late textures arrive.

### Post chain (high tier)

- GTAO: radius about 0.5m, half resolution, blurred.
- Bloom: high threshold, low strength, so only lamps, skylight, door glow and
  the screen bleed.
- Output: ACES tone mapping moved here, a slight contrast curve, about 2% film
  grain and a soft vignette. Grain animates only while the camera moves and is
  static when idle, so render on demand holds.

### Geometry

- Bevels on plinth, bench, skirting and door arch edges.
- Skirting board and picture rail along the corridor walls.
- Real profile depth on frame mouldings.

### Tiers

| | High | Low |
|---|---|---|
| Materials | 2K | 1K |
| Environment map | Yes | Yes |
| Shadow maps | Yes | No |
| Post chain | Yes | No |
| Fake AO decals | Removed | Kept |
| 2400px artworks | Yes | No |
| Pixel ratio cap | 2, up to 3 on zoom | 1.5 |

If the high tier averages over 24ms per frame during the first walk it steps
down in this order: GTAO off, sun shadow map to 2048, bloom off. The low-tier
target stays 60fps on a 2020 phone.

## Failure handling

- A scanned set fails to load: the procedural texture stays. No retry loop. One
  console warning per set.
- A 2400px artwork fails: the 1200px image stays.
- The environment bake throws: `ctx.env` stays null and materials keep their
  current look.
- The post chain fails to build: the pipeline disables itself and the engine
  renders directly, the same path the low tier uses.
- WebGL context lost: the existing handler is kept; on restore, shadow maps and
  the environment are re-baked through `invalidateStatic()`.
- Every new texture, render target and cube map is registered for disposal.
- A failure of the whole 3D view still falls back to the flat list view.

## Testing

Unit tests with `vitest` (added as a dev dependency; the repo has no test
runner today), written test-first, for the four `logic/` modules: arrow opacity
and hit threshold, pixel-ratio policy, artwork tier selection and eviction,
step-down order.

Build gates: `npx tsc --noEmit -p .` and `npm run build`.

Browser checks with Playwright against the built `out/`, after resetting
`localStorage.gmode` and reduced-motion emulation:

- Arrow visible at a work's stand point, hidden mid-walk, absent at the intro.
- Plate text and artwork at 100% and 200% browser zoom, compared with the
  baseline build.
- Before / after stills at five fixed stops in day and night, for the owner to
  judge.
- Zero draw calls when settled, with the post chain on.
- Low tier forced by a query flag: no shadow maps, no composer.
- Texture requests blocked: procedural surfaces remain, nothing throws.

Not covered: a real phone and iOS Safari. These stay on the README's
"not yet verified" list until tested on a device.

## Build order

Each step leaves the site working and is committed on its own.

1. Arrows: distance fade, floor position, stand point.
2. Capture script, recapture, tiered artwork loading.
3. Pixel-ratio policy, plate resolution.
4. Material library; scanned sets on floors and walls.
5. Environment bake; metal, glass and canvas materials.
6. Shadow maps and lighting retune.
7. Post chain.
8. Bevels, skirting, picture rail, moulding depth.
9. Tier step-down; README rewrite.
