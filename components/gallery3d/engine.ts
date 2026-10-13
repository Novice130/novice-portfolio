// Framework-free controller for the walkable gallery: owns the renderer, the
// camera rail and the on-demand render loop. The scene itself lives in the
// three scene modules, loaded here so three.js stays out of the first bundle.
import type * as THREE from 'three';
import { EYE, SALON, stops, type Quality, type SceneCtx, type ScenePart, type ThemeName } from './contract';
import { pickPixelRatio } from './logic/pixelRatio';

export const TUNING = {
  /** ACES exposure per room. */
  exposure: { light: 1.0, dark: 1.0 },
  /** Vertical FOV, blended by aspect ratio between the two breakpoints. */
  fovLandscape: 50,
  fovPortrait: 76,
  aspectLandscape: 1.3,
  aspectPortrait: 0.6,
  /** Portrait only: slide the picture up by this share of the height, clear of the bottom sheet. */
  viewShiftPortrait: 0.08,
  /** Landscape: slide the scene right (fraction of width) to clear the caption. */
  viewShiftLandscape: 0.1,
  near: 0.1,
  far: 150,
  /** Seconds the focus spring takes to (mostly) close the gap; a weighty, deliberate walk. */
  smoothTime: 0.75,
  /** Pre-filter on the scroll target (s): rounds the start of a walk into an S-curve yet follows a finger closely. */
  aimTime: 0.2,
  /** Stops per second, so a jump across the whole gallery still takes a moment. */
  maxSpeed: 6,
  /** smoothTime multipliers for the long approach to the salon and the orbit to the door. */
  paceCeremony: 1.4,
  paceOrbit: 1.5,
  /** Corridor path: share of the segment length at which the two Bezier control points sit (both on x = 0). */
  pathCtrl: 0.4,
  /** Gaze choreography, as fractions of a segment: head turns toward travel until gazeTurn, looks ahead until gazeLook, then settles on the next work. */
  gazeTurn: 0.25,
  gazeLook: 0.7,
  /** 0..1: how far the gaze leaves the centrepiece toward the direction of travel while orbiting to the door. */
  gazeOrbit: 0.2,
  /** Head bob: vertical (m), lateral sway (m), roll (deg) and stride length (m, two steps). */
  bobY: 0.006,
  bobX: 0.003,
  bobRoll: 0,
  stride: 3.2,
  /** Walking speed (m/s) at which the bob is at full strength, and the rate (1/s) it fades in and out. */
  bobSpeed: 1.2,
  gaitDamp: 8,
  /** Extra vertical FOV (deg) at mid-stride: the slow push-in on arrival. */
  fovPush: 2.5,
  /** data-g3walk is set while focus is further than this from a stop, or moving faster than walkSpeed (stops/s). */
  walkEdge: 0.08,
  walkSpeed: 0.04,
  /** Turning from the centre line to face a work: spring time (s), and how close to a stop (in stops) the turn may begin. */
  faceTime: 0.5,
  faceReach: 0.35,
  /** Extra vertical FOV (deg, landscape) while looking down the gallery; the step up to a work narrows it. */
  fovAhead: 8,
  /** Pointer parallax, degrees, and its damping rate (1/s). */
  parallaxYaw: 1.6,
  parallaxPitch: 1.0,
  parallaxDamp: 6,
  /** A press that travels further than this (px) is a drag, not a click. */
  clickSlop: 6,
} as const;

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  /** Stop index to open on; the camera starts there rather than walking to it. */
  focus?: number;
  /** Open facing the work at `focus` rather than looking down the gallery. */
  face?: boolean;
  /** Camera focus (fractional stop index), reported whenever it changes. */
  onFocus?: (focus: number) => void;
  /** Reduced motion: the camera just cut to another stop. */
  onCut?: () => void;
  onHotspot?: (stopId: string) => void;
  onProgress?: (progress: number) => void;
  /** The first frame is on screen. */
  onReady?: () => void;
  onError?: (err: unknown) => void;
};

export type Engine = {
  setFocusTarget: (focus: number) => void;
  /** Turn to the work at the current stop (true) or back to the gallery ahead (false). */
  setFace: (on: boolean) => void;
  setTheme: (theme: ThemeName) => void;
  resize: () => void;
  invalidate: () => void;
  dispose: () => void;
};

type Live = Engine;
type Factory = (ctx: SceneCtx) => ScenePart;

const EYE_AHEAD = EYE + 0.15;
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (a: number) => a - TAU * Math.round(a / TAU);
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

type Spring = { x: number; v: number };
// Critically damped spring (Game Programming Gems 4, "SmoothDamp"), frame-rate independent.
function smoothDamp(s: Spring, to: number, time: number, dt: number, maxSpeed: number) {
  const omega = 2 / time;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = clamp(s.x - to, -maxSpeed * time, maxSpeed * time);
  const temp = (s.v + omega * change) * dt;
  s.v = (s.v - omega * temp) * decay;
  const next = s.x - change + (change + temp) * decay;
  if (to - s.x > 0 === next > to || (Math.abs(to - next) < 4e-4 && Math.abs(s.v) < 2e-3)) {
    s.x = to;
    s.v = 0;
  } else {
    s.x = next;
  }
}

const readTheme = (): ThemeName => (document.documentElement.dataset.gtheme === 'dark' ? 'dark' : 'light');

function pickQuality(): Quality {
  // ?g3q=low|high forces a tier, for testing.
  const forced = new URLSearchParams(window.location.search).get('g3q');
  if (forced === 'low' || forced === 'high') return forced;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const smallTouch =
    window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600;
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || smallTouch ? 'low' : 'high';
}

type RenderModules = {
  matLib: typeof import('./render/materialLibrary');
  envMod: typeof import('./render/environment');
  post: typeof import('./render/pipeline');
};

export function createEngine(opts: EngineOptions): Engine {
  const last = stops.length - 1;
  let disposed = false;
  let target = clamp(opts.focus ?? 0, 0, last);
  let face = !!opts.face;
  let live: Live | null = null;

  const boot = async () => {
    let loaded = 0;
    const track = <M>(p: Promise<M>) =>
      p.then((m) => {
        if (!disposed) opts.onProgress?.(0.12 + (0.6 * ++loaded) / 9);
        return m;
      });
    opts.onProgress?.(0.12);
    const [T, room, artworks, centerpiece, visitors, nav, matLib, envMod, post] = await Promise.all([
      track(import('three')),
      track(import('./scene/room')),
      track(import('./scene/artworks')),
      track(import('./scene/centerpiece')),
      track(import('./scene/visitors')),
      track(import('./scene/navArrows')),
      track(import('./render/materialLibrary')),
      track(import('./render/environment')),
      track(import('./render/pipeline')),
    ]);
    if (disposed) return;
    live = start(T, [room.createRoom, artworks.createArtworks, centerpiece.createCenterpiece, visitors.createVisitors, nav.createNavArrows], {
      matLib,
      envMod,
      post,
    });
  };

  boot().catch((err: unknown) => {
    if (disposed) return;
    disposed = true;
    live?.dispose();
    live = null;
    opts.onError?.(err);
  });

  function start(T: typeof THREE, factories: Factory[], mods: RenderModules): Live {
    const { canvas } = opts;
    const quality = pickQuality();
    let theme = readTheme();

    const renderer = new T.WebGLRenderer({
      canvas,
      antialias: quality === 'high',
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = TUNING.exposure[theme];

    // Static shadows: maps render only when refreshStatic() flags them.
    renderer.shadowMap.enabled = quality === 'high';
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(TUNING.fovLandscape, 1, TUNING.near, TUNING.far);
    // Yaw-then-pitch: reading pitch and yaw back from the default XYZ order goes unstable
    // when the visitor faces a side wall (yaw near 90 degrees), which showed up as jitter.
    camera.rotation.order = 'YXZ';
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    const parts: ScenePart[] = [];
    const cleanups: Array<() => void> = [];
    let raf = 0;
    let hoverRaf = 0;
    let lost = false;
    let ready = false;
    // ?g3debug exposes a frame counter and the renderer to the test scripts.
    const debug = new URLSearchParams(window.location.search).has('g3debug');
    let frameCount = 0;
    if (debug) (window as unknown as { __g3?: unknown }).__g3 = { renderer, camera, scene };

    const invalidate = () => {
      if (!raf && !disposed && !lost && !document.hidden) raf = requestAnimationFrame(frame);
    };

    let pipeline: ReturnType<typeof mods.post.createPipeline> = null;

    const destroy = () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(hoverRaf);
      cleanups.forEach((fn) => fn());
      for (const part of parts) {
        scene.remove(part.group);
        try {
          part.dispose();
        } catch {}
      }
      pipeline?.dispose();
      env?.dispose();
      materials.dispose();
      renderer.dispose();
      // The canvas is thrown away with the walk; hand the GPU context back now.
      renderer.forceContextLoss();
    };

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
      try {
        env.bake();
      } catch (err) {
        console.warn('[gallery3d] room reflections failed; continuing without', err);
        env.dispose();
        env = null;
        ctx.env = null;
      }
    };
    try {
      for (const make of factories) {
        const part = make(ctx);
        parts.push(part);
        scene.add(part.group);
      }
    } catch (err) {
      destroy();
      throw err;
    }

    // createNavArrows is the last factory.
    navGroup = parts[parts.length - 1]?.group ?? null;
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

    // ---- the rail ----------------------------------------------------------

    const cams = stops.map((s) => new T.Vector3(...s.cam));
    const looks = stops.map((s) => new T.Vector3(...s.look));
    // The rail runs through the centre-line spots; a work's own cam / look is a step off it.
    const nodes = stops.map((s, n) => (s.aheadCam ? new T.Vector3(...s.aheadCam) : cams[n]));
    const isPiece = stops.map((s) => (s.aheadCam ? 1 : 0));
    // A straight line from the centrepiece to the door runs through the plinth,
    // so the last leg circles the salon instead.
    const orbit = last >= 2 && stops[last].kind === 'door' && stops[last - 1].kind === 'centerpiece';
    const railEnd = orbit ? last - 1 : last;
    const [cx, , cz] = SALON.center;
    const polar = (v: THREE.Vector3) => ({ a: Math.atan2(v.x - cx, v.z - cz), r: Math.hypot(v.x - cx, v.z - cz) });
    const from = polar(cams[railEnd]);
    const to = polar(cams[last]);
    const sweep = wrap(to.a - from.a);

    const positionAt = (f: number, out: THREE.Vector3) => {
      if (orbit && f > railEnd) {
        const t = f - railEnd;
        const a = from.a + sweep * t;
        const r = from.r + (to.r - from.r) * t;
        return out.set(cx + Math.sin(a) * r, cams[railEnd].y + (cams[last].y - cams[railEnd].y) * t, cz + Math.cos(a) * r);
      }
      // Corridor leg: cubic Bezier whose control points sit on the centre line,
      // so the walk drifts to x = 0 mid-stride and never cuts wall to wall.
      const i = clamp(Math.floor(f), 0, Math.max(railEnd - 1, 0));
      const t = clamp(f - i, 0, 1);
      const A = nodes[i];
      const B = nodes[Math.min(i + 1, railEnd)];
      const u = 1 - t;
      const c = TUNING.pathCtrl;
      const z1 = A.z + (B.z - A.z) * c;
      const z2 = A.z + (B.z - A.z) * (1 - c);
      return out.set(
        u * u * u * A.x + t * t * t * B.x,
        A.y + (B.y - A.y) * smoother(t),
        u * u * u * A.z + 3 * u * u * t * z1 + 3 * u * t * t * z2 + t * t * t * B.z,
      );
    };
    const isOrbit = (segment: number) => orbit && segment === railEnd;
    const paceOf = (segment: number) =>
      isOrbit(segment) ? TUNING.paceOrbit : stops[segment + 1].kind === 'centerpiece' ? TUNING.paceCeremony : 1;

    // ---- state -------------------------------------------------------------

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let reduced = motion.matches;
    let focus = reduced ? Math.round(target) : target;
    // aim follows the scroll target, focus follows aim: an S-curve start without lagging a finger.
    const aim: Spring = { x: focus, v: 0 };
    const spring: Spring = { x: focus, v: 0 };
    let reported = NaN;
    let lastT = 0;
    let elapsed = 0;
    let travelled = 0;
    let gait = 0;
    let baseFov = TUNING.fovLandscape;
    let walking = false;
    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    const gaze: Spring = { x: face ? 1 : 0, v: 0 };
    let viewW = 0;
    let viewH = 0;
    let portraitK = 0;
    let slideK = 1;
    let slideApplied = NaN;
    const applyView = () => {
      const shift = Math.round(viewH * TUNING.viewShiftPortrait * portraitK);
      const slide = -Math.round(viewW * TUNING.viewShiftLandscape * (1 - portraitK) * slideK);
      if (shift || slide) camera.setViewOffset(viewW, viewH, slide, shift, viewW, viewH);
      else camera.clearViewOffset();
      slideApplied = slideK;
    };

    const setWalking = (on: boolean) => {
      if (on === walking) return;
      walking = on;
      if (on) document.documentElement.dataset.g3walk = '1';
      else delete document.documentElement.dataset.g3walk;
    };
    cleanups.push(() => {
      walking = false;
      delete document.documentElement.dataset.g3walk;
    });

    const pos = new T.Vector3();
    const prev = positionAt(focus, new T.Vector3());
    const pa = new T.Vector3();
    const pb = new T.Vector3();
    const tgt = new T.Vector3();
    const tmp = new T.Vector3();
    const UP = new T.Vector3(0, 1, 0);
    const mat = new T.Matrix4();
    const qA = new T.Quaternion();
    const qB = new T.Quaternion();
    const qF = new T.Quaternion();
    const qW = new T.Quaternion();
    // On the centre line a work stop looks straight down the gallery.
    const nodeLook = (n: number) => (isPiece[n] ? tmp.set(0, EYE_AHEAD, pos.z - 12) : looks[n]);
    const aimAt = (p: THREE.Vector3, out: THREE.Quaternion) => {
      mat.lookAt(pos, p, UP);
      return out.setFromRotationMatrix(mat);
    };

    /** Places the camera; returns true while the gait is still fading out. */
    const place = (dt: number) => {
      const i = clamp(Math.floor(focus), 0, last - 1);
      const t = clamp(focus - i, 0, 1);
      positionAt(focus, pos);

      // Gaze: turn from the work toward travel, look ahead, then settle on the next work.
      aimAt(nodeLook(i), qA);
      aimAt(nodeLook(i + 1), qB);
      let q: THREE.Quaternion;
      if (isOrbit(i)) {
        positionAt(Math.max(i, focus - 0.02), pa);
        positionAt(Math.min(i + 1, focus + 0.02), pb);
        tmp.subVectors(pb, pa).setY(0);
        if (tmp.lengthSq() < 1e-12) tmp.set(0, 0, -1);
        tgt.copy(pos).addScaledVector(tmp.normalize(), 8).setY(EYE_AHEAD);
        tgt.lerp(tmp.set(cx, 1.5, cz), 1 - TUNING.gazeOrbit);
        aimAt(tgt, qF);
        q =
          t < TUNING.gazeTurn
            ? qA.slerp(qF, smoother(t / TUNING.gazeTurn))
            : t < TUNING.gazeLook
              ? qF
              : qF.slerp(qB, smoother((t - TUNING.gazeLook) / (1 - TUNING.gazeLook)));
      } else {
        q = qA.slerp(qB, smoother(t));
      }

      // Step off the centre line and turn to the work, only once nearly there.
      const n = Math.round(focus);
      const near = isPiece[n] ? 1 - smoother(clamp(Math.abs(focus - n) / TUNING.faceReach, 0, 1)) : 0;
      const w = smoother(clamp(gaze.x, 0, 1)) * near;
      if (w > 0) {
        pos.lerp(cams[n], w);
        q.slerp(aimAt(looks[n], qW), w);
      }
      const ahead = (isPiece[i] * (1 - t) + isPiece[i + 1] * t) * (1 - w);

      // Gait follows distance travelled and fades to exactly zero once settled.
      const step = pos.distanceTo(prev);
      prev.copy(pos);
      let wantGait = 0;
      if (!reduced && step < 1) {
        travelled += step;
        wantGait = clamp(step / dt / TUNING.bobSpeed, 0, 1);
      }
      if (reduced) gait = 0;
      else {
        gait += (wantGait - gait) * (1 - Math.exp(-dt * TUNING.gaitDamp));
        if (wantGait === 0 && gait < 2e-3) gait = 0;
      }
      const phase = (travelled / TUNING.stride) * TAU;
      const bobY = Math.sin(phase * 2) * TUNING.bobY * gait;
      const sway = Math.sin(phase) * gait;

      // FOV push-in: peaks mid-stride, exactly at rest on arrival.
      let push = reduced ? 0 : TUNING.fovPush * Math.sin(Math.PI * t) ** 2;
      if (push < 1e-5) push = 0;
      const fov = baseFov + push + TUNING.fovAhead * ahead * (1 - portraitK);
      slideK = 1 - ahead;
      if (camera.fov !== fov || Math.abs(slideK - slideApplied) > 0.002) {
        camera.fov = fov;
        if (viewW) applyView();
        camera.updateProjectionMatrix();
      }

      camera.position.copy(pos);
      camera.quaternion.copy(q);
      // Keep only yaw and pitch from the slerp (level horizon), then add parallax and roll.
      const pitch = camera.rotation.x;
      const yaw = camera.rotation.y;
      camera.rotation.set(
        pitch - look.y * TUNING.parallaxPitch * RAD,
        yaw - look.x * TUNING.parallaxYaw * RAD,
        -sway * TUNING.bobRoll * RAD,
      );
      camera.translateX(sway * TUNING.bobX);
      camera.position.y += bobY;
      return gait > 0;
    };

    function frame(now: number) {
      raf = 0;
      if (disposed || lost) return;
      const dt = lastT ? clamp((now - lastT) / 1000, 0.001, 0.05) : 1 / 60;
      lastT = now;
      elapsed += dt;
      let busy = false;

      if (reduced) {
        const cut = Math.round(target);
        if (cut !== focus) {
          focus = cut;
          opts.onCut?.();
        }
        aim.x = spring.x = focus;
        aim.v = spring.v = 0;
      } else if (spring.x !== target || aim.x !== target || spring.v !== 0 || aim.v !== 0) {
        smoothDamp(aim, target, TUNING.aimTime, dt, Infinity);
        smoothDamp(spring, aim.x, TUNING.smoothTime * paceOf(clamp(Math.floor(spring.x), 0, last - 1)), dt, TUNING.maxSpeed);
        focus = spring.x;
        if (spring.x !== target || aim.x !== target || spring.v !== 0 || aim.v !== 0) busy = true;
      }
      setWalking(
        !reduced && (Math.abs(focus - Math.round(focus)) > TUNING.walkEdge || Math.abs(spring.v) > TUNING.walkSpeed),
      );

      const gazeTo = face ? 1 : 0;
      if (gaze.x !== gazeTo || gaze.v !== 0) {
        if (reduced) {
          gaze.x = gazeTo;
          gaze.v = 0;
        } else {
          smoothDamp(gaze, gazeTo, TUNING.faceTime, dt, Infinity);
          if (gaze.x !== gazeTo || gaze.v !== 0) busy = true;
        }
      }

      if (look.x !== look.tx || look.y !== look.ty) {
        const k = 1 - Math.exp(-dt * TUNING.parallaxDamp);
        look.x += (look.tx - look.x) * k;
        look.y += (look.ty - look.y) * k;
        if (Math.abs(look.tx - look.x) + Math.abs(look.ty - look.y) < 2e-3) {
          look.x = look.tx;
          look.y = look.ty;
        } else {
          busy = true;
        }
      }

      if (place(dt)) busy = true;
      for (const part of parts) if (part.update?.(dt, elapsed, focus)) busy = true;
      // Texture arrivals come in bursts at load: at most one bake per 250ms.
      if (staticDirty) {
        if (now - lastBake > 250) {
          staticDirty = false;
          lastBake = now;
          refreshStatic();
        } else busy = true;
      }
      draw();
      if (debug) canvas.dataset.g3frames = String(++frameCount);

      if (focus !== reported) {
        reported = focus;
        opts.onFocus?.(focus);
      }
      if (!ready) {
        ready = true;
        opts.onProgress?.(1);
        requestAnimationFrame(() => {
          if (!disposed) opts.onReady?.();
        });
      }
      if (busy) invalidate();
      else if (!raf) {
        lastT = 0;
        if (hover) pickHover();
      }
    }

    // ---- size --------------------------------------------------------------

    let dprPenalty = 0;
    let currentDpr = 1;
    let sized = '';
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = pickPixelRatio({
        device: window.devicePixelRatio || 1,
        viewportScale: window.visualViewport?.scale ?? 1,
        quality,
        cssWidth: w,
        cssHeight: h,
        penalty: dprPenalty,
      });
      currentDpr = dpr;
      const key = `${w}x${h}@${dpr}`;
      if (key === sized) return;
      sized = key;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      pipeline?.setSize(w, h, dpr);
      const aspect = w / h;
      const portrait = smoother(
        clamp((TUNING.aspectLandscape - aspect) / (TUNING.aspectLandscape - TUNING.aspectPortrait), 0, 1),
      );
      // Portrait has no caption card beside the case: re-centre the centrepiece.
      stops.forEach((s, n) => {
        if (s.kind === 'centerpiece') looks[n].x = s.look[0] + 0.4 * portrait;
      });
      camera.aspect = aspect;
      baseFov = TUNING.fovLandscape + (TUNING.fovPortrait - TUNING.fovLandscape) * portrait;
      camera.fov = baseFov;
      viewW = w;
      viewH = h;
      portraitK = portrait;
      applyView();
      camera.updateProjectionMatrix();
      invalidate();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    cleanups.push(() => ro.disconnect());

    // ---- theme -------------------------------------------------------------

    const setTheme = (next: ThemeName) => {
      if (next === theme) return;
      theme = next;
      ctx.theme = next;
      renderer.toneMappingExposure = TUNING.exposure[next];
      for (const part of parts) part.setTheme(next);
      invalidateStatic();
    };
    const mo = new MutationObserver(() => setTheme(readTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-gtheme'] });
    cleanups.push(() => mo.disconnect());

    // ---- pointer -----------------------------------------------------------

    const raycaster = new T.Raycaster();
    const ndc = new T.Vector2();
    const owners = new Map<THREE.Object3D, string>();
    for (const part of parts) for (const h of part.hotspots ?? []) owners.set(h.object, h.stopId);
    const targets = [...owners.keys()];
    const picked = new T.Vector3();
    const nearestStop = () => {
      let best = 0;
      let d = Infinity;
      nodes.forEach((p, n) => {
        const dn = Math.hypot(p.x - picked.x, p.z - picked.z);
        if (dn < d) [best, d] = [n, dn];
      });
      return best;
    };
    let press: { id: number; x: number; y: number } | null = null;
    let hover: { x: number; y: number } | null = null;

    const pick = (clientX: number, clientY: number): string | null => {
      if (!targets.length) return null;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      // Raycaster ignores .visible, so faded-out markers must be skipped by hand.
      const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
      const hit = raycaster.intersectObjects(targets, true).find((h) => shown(h.object));
      if (hit) picked.copy(hit.point);
      for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
        const id = owners.get(o);
        if (id) return id;
      }
      return null;
    };
    const pickHover = () => {
      hoverRaf = 0;
      canvas.style.cursor = hover && pick(hover.x, hover.y) ? 'pointer' : '';
    };

    const listen = (el: EventTarget, type: string, fn: (e: never) => void, passive = true) => {
      el.addEventListener(type, fn as EventListener, { passive });
      cleanups.push(() => el.removeEventListener(type, fn as EventListener));
    };

    listen(canvas, 'pointerdown', (e: PointerEvent) => {
      press = e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
    });
    listen(canvas, 'pointercancel', () => {
      press = null;
    });
    listen(canvas, 'pointerup', (e: PointerEvent) => {
      const p = press;
      press = null;
      if (!p || p.id !== e.pointerId || Math.hypot(e.clientX - p.x, e.clientY - p.y) >= TUNING.clickSlop) return;
      const id = pick(e.clientX, e.clientY);
      if (id) opts.onHotspot?.(id === 'nav:floor' ? `nav:goto:${nearestStop()}` : id);
    });
    listen(canvas, 'pointermove', (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      hover = { x: e.clientX, y: e.clientY };
      if (!hoverRaf) hoverRaf = requestAnimationFrame(pickHover);
    });
    listen(canvas, 'pointerleave', () => {
      hover = null;
      canvas.style.cursor = '';
    });
    listen(window, 'pointermove', (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || reduced || !finePointer.matches) return;
      look.tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      look.ty = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
      invalidate();
    });

    // ---- lifecycle ---------------------------------------------------------

    // Pinch zoom changes the visual viewport without resizing the canvas.
    if (window.visualViewport) listen(window.visualViewport, 'resize', resize);

    listen(motion, 'change', () => {
      reduced = motion.matches;
      if (reduced) look.x = look.y = look.tx = look.ty = 0;
      invalidate();
    });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        lastT = 0;
      } else {
        invalidate();
      }
    });
    listen(
      canvas,
      'webglcontextlost',
      (e: Event) => {
        e.preventDefault();
        lost = true;
        cancelAnimationFrame(raf);
        raf = 0;
        lastT = 0;
      },
      false,
    );
    listen(canvas, 'webglcontextrestored', () => {
      lost = false;
      invalidateStatic();
    });

    resize();
    invalidate();

    return {
      setFocusTarget: (f) => {
        target = f;
        invalidate();
      },
      setFace: (on) => {
        face = on;
        invalidate();
      },
      setTheme,
      resize,
      invalidate,
      dispose: destroy,
    };
  }

  return {
    setFocusTarget: (f) => {
      target = clamp(f, 0, last);
      live?.setFocusTarget(target);
    },
    setFace: (on) => {
      face = on;
      live?.setFace(on);
    },
    setTheme: (t) => live?.setTheme(t),
    resize: () => live?.resize(),
    invalidate: () => live?.invalidate(),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      live?.dispose();
      live = null;
    },
  };
}
