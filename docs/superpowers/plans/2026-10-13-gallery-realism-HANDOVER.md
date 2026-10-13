# Handover: 3D gallery realism pass

Written 2026-10-13, when work was paused mid-plan. Read this first, then the
plan (`2026-10-13-gallery-realism.md`) and the spec
(`../specs/2026-10-13-gallery-realism-design.md`, whose last section overrides
the rest).

## Where things stand

Branch `gallery-home`, pushed. Everything on it passes `npx tsc --noEmit -p .`,
`npm test` (39 tests) and `npm run build`.

| Plan task | State | Commit |
|---|---|---|
| 1 Tooling, baseline stills | done | `491fd41` |
| 2 Side arrow on floor, distance fade | done | `c35aba0` |
| (extra) Cat guide + two visitors, stand-in figures | done | `ba10f34` |
| 3 Recapture screenshots at 2400px | done, 8 of 10 | `202632b` |
| 4 Tiered artwork loading | done | `7cc5487` |
| 5 Pixel ratio follows zoom | done | `98a86e7` |
| 6 Scanned materials | done | `ede8341` |
| 7 Room reflections | done | `d215019` |
| 8 Shadows and lighting | done | `9a34185` |
| 9 Post chain | **in progress, on branch `wip/post-chain`** | wip commit |
| 10 Bevels, skirting, picture rail | not started | |
| 11 Step-down, README | not started | |
| Final whole-branch review | not started | |

Revert points: `c35aba0` is the state before the cat and visitors;
`git revert ba10f34` removes only them.

## Resuming

1. `git checkout gallery-home`.
2. Task 9: `git merge wip/post-chain` (or cherry-pick its one commit), then
   continue at plan Task 9 Step 7 (compare stills, tune). The chain renders
   without errors, but the image is washed out and desaturated compared with
   `.stills/shadows/`; start with the tuning list in that step (grade contrast,
   glow planes now passing through ACES, fog). Steps 7 to 9 are not done.
3. Tasks 10 and 11 as written, then the final review.

Local tooling notes:

- Serve the build with
  `python3 -m http.server 4173 --bind 127.0.0.1 --directory "$PWD/out"`.
  `npx serve` fails on this machine: the user npm cache has a file with a
  permissions error. For `npm install`, pass `--cache <some temp dir>`.
- Check scripts live in the git-ignored `.stills/` folder
  (`check-idle.mjs`, `check-theme.mjs`, `check-zoom.mjs`, `check-tiers.mjs`,
  `check-offline.mjs`, `check-visitors.mjs`, `diag.mjs`, `errs.mjs`). They may
  be gone; the plan contains the source of most of them. Use
  `http://127.0.0.1:4173`, not `localhost`.
- `node scripts/shots.mjs --out=.stills/x --only=citcd,centerpiece --theme=light [--center]`
  takes targeted stills. A full run takes about ten minutes in headless
  Chromium (software GL).
- Baseline stills for before / after are in `.stills/baseline/` (git-ignored).
- The executing-plans ledger is at
  `.superpowers/sdd/2026-10-13-gallery-realism/progress.md` (git-ignored). Its
  rulings are copied below in case it is lost.

## Known problems to fix

1. **Feedback loop while baking reflections** (present since Task 7, on
   `gallery-home`). Chromium logs `GL_INVALID_OPERATION: Feedback loop formed
   between Framebuffer and active Texture`. Cause: the artwork canvas shader and
   the glass shader sample the same cube map (`ctx.env.cube(zone)`) that
   `environment.ts` is rendering into during a bake. Fix: give each zone two
   cube targets and render into the one not currently handed out, then swap and
   notify `onBake` listeners; or zero `uGloss` / `uEnvStrength` and null `uEnv`
   for the duration of the bake. Reflections still appear, so the draw calls
   that hit the loop are being skipped, which may leave canvases missing from
   the reflection.
2. **Idle check after Task 8** printed 3 frames in 2s after a 14s wait (it was
   0 after Task 7). Probably load-time bakes taking longer now that a 4096
   shadow map renders in software GL, but not confirmed. Run `.stills/diag.mjs`
   and confirm the frame count reaches 0.
3. A 404 is logged on load. Not traced; likely the `.webp` for
   `apache-tandoori` or `cpts-companion`, which fall back to JPEG by design.
4. Low tier was last viewed after Task 6. Shoot `--q=low` stills before
   finishing.

## Waiting on the owner

- **Models for the cat and visitors.** The figures are grey stand-ins. Wanted:
  two dressed characters from mixamo.com, each with an idle and a walking
  animation (FBX, "with skin"), and one animated cat (idle or sit, and walk).
  Put them in `public/gallery/models/`. Swapping them in means replacing
  `buildPerson` / `buildCat` in `components/gallery3d/scene/visitors.ts` and
  driving an `AnimationMixer` from `actor.speed`. Behaviour
  (`logic/visitors.ts`) does not change.
- **Two screenshots.** `apache-tandoori` and `cpts-companion` show a login
  screen to `npm run capture`. Capture them signed in at 2400px wide and save
  as `public/gallery/<id>.webp` and `<id>-1200.webp`.
- **Review of the eight new captures** in `public/gallery/*.webp`. They were
  committed after my own check only.
- **A larger Tandoori logo** (the plaque uses a 144px file).
- **Realism verdict.** Compare `.stills/baseline/` with the latest stills.

## Rulings made so far (deviations from the plan)

- Work happens in place on `gallery-home`, no separate worktree.
- Task 2: stand point 4.0m (plan 3.6), arrow frame share 0.55 (plan 0.72),
  fade 5.6 / 6.8m (plan 5.2 / 6.4). At 3.6m the arrow sat under the HUD
  counter and was clipped on a phone.
- Task 2: `?g3debug` exposes `camera` and `scene` as well as `renderer`.
- Visitors and cat were built on `gallery-home` as one isolated commit, not a
  separate branch. `navArrows` must stay the last scene factory in
  `engine.ts`; `visitors` sits before it.
- Task 3: capture size floor lowered from 20 KB to 4 KB, plus a blank-frame
  check. Captures were committed without waiting for the owner gate.
- Task 6: corridor walls use `keepMap` (the plaster scan's colour reads as
  dirty grey); dado tint `0x6e2c2a`.
- Task 7: canvas glazing Fresnel capped (`0.04 + 0.2 * pow4`), full Fresnel
  whited out works seen down the corridor. Night `hemiIntensity` 0.9 (plan
  0.6). `shots.mjs` waits for the frame counter to go quiet.
- Tasks 6 to 9 use `three/examples/jsm/...` import paths, as `artworks.ts`
  already did, not `three/addons/...`.
- Not done from the plan: per-task low-tier stills in Tasks 8 and 9.
