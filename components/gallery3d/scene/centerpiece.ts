// The centrepiece: "Apache Tandoori" on a plinth in the middle of the salon,
// inside a museum vitrine whose front pane has been smashed open.
//
// Everything is built in the group's local space: origin on the floor at
// SALON.center, +Z toward the corridor (the side the visitor arrives from).
import * as THREE from 'three';
import {
  PLINTH,
  SALON,
  stops,
  type Hotspot,
  type SceneCtx,
  type ScenePart,
  type ThemeName,
} from '@/components/gallery3d/contract';
import { centerpiece } from '@/data/gallery';

// ---------------------------------------------------------------- dimensions

const CASE = { w: PLINTH.width - 0.12, d: PLINTH.depth - 0.12, h: PLINTH.caseHeight, edge: 0.022 };
const SCREEN = { w: 1.7, h: (1.7 * 747) / 1600, tilt: -0.1, z: -0.1, standH: 0.22 };
const PLAQUE = { w: 1.7, h: 0.68, tilt: -0.32 };
/** Impact point on the front pane, in pane space (x from centre, y from plinth top). */
const IMPACT = { x: 0.42, y: 1.02 };
const LIGHT_POS = new THREE.Vector3(0.2, 8.6, 0.9);
const LIGHT_AIM = new THREE.Vector3(0, 1.2, 0.1);
const SPOT_ANGLE = 0.24;

const GRAVITY = 9.81;
const RESTITUTION = 0.26;
const ARRIVAL_SECONDS = 1.5;
const CRACK_PRE = 0.3; // how far the cracks have already run before the case gives way
const ARRIVE_WITHIN = 0.6;
const NEAR_WITHIN = 1.5;

const ORDER = {
  shadow: 1,
  halo: 2,
  glassBack: 10,
  cracks: 12,
  shards: 13,
  glassFront: 14,
  beam: 20,
  motes: 21,
} as const;

// -------------------------------------------------------------------- themes

type ThemeSpec = {
  spot: number;
  spotColor: number;
  beam: number;
  beamColor: number;
  motes: number;
  glassTint: number;
  glassOpacity: number;
  glassFresnel: number;
  glassSheen: number;
  crackColor: number;
  crackGain: number;
  crackOpacity: number;
  crackAdditive: boolean;
  shardTint: number;
  shardBody: number;
  shardEdge: number;
  shardTwinkle: number;
  halo: number;
  haloColor: number;
  plinth: number;
  brass: number;
  brassEmissive: number;
  rope: number;
  shadow: number;
  plaque: number;
};

const THEMES: Record<ThemeName, ThemeSpec> = {
  light: {
    spot: 70,
    spotColor: 0xfff1dc,
    beam: 0.05,
    beamColor: 0xfff4e0,
    motes: 0.12,
    glassTint: 0xcfe6f2,
    glassOpacity: 0.09,
    glassFresnel: 0.38,
    glassSheen: 0.05,
    crackColor: 0xf3f6f8,
    crackGain: 1,
    crackOpacity: 0.9,
    crackAdditive: false,
    shardTint: 0xe2eff5,
    shardBody: 0.24,
    shardEdge: 0.7,
    shardTwinkle: 0.5,
    halo: 0.16,
    haloColor: 0xcfe0ff,
    plinth: 0x2b2927,
    brass: 0xb9924c,
    brassEmissive: 0x000000,
    rope: 0x8a1220,
    shadow: 0.5,
    plaque: 1,
  },
  dark: {
    spot: 260,
    spotColor: 0xffd9a0,
    beam: 0.2,
    beamColor: 0xffd49a,
    motes: 0.7,
    glassTint: 0xffe7c2,
    glassOpacity: 0.035,
    glassFresnel: 0.3,
    glassSheen: 0.03,
    crackColor: 0xffdf9e,
    crackGain: 1.5,
    crackOpacity: 1,
    crackAdditive: true,
    shardTint: 0xffe3b0,
    shardBody: 0.1,
    shardEdge: 1,
    shardTwinkle: 1,
    halo: 0.42,
    haloColor: 0x9fc4ff,
    plinth: 0x1a1918,
    brass: 0xa9803c,
    brassEmissive: 0x2a1c08,
    rope: 0x5e0c16,
    shadow: 0.75,
    plaque: 0.85,
  },
};

// ------------------------------------------------------------------- helpers

type Vec2 = { x: number; y: number };

/** Seeded PRNG so the break looks identical on every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** White radial falloff in alpha: halo, contact shadow and dust motes share it. */
function makeGlowTexture(size: number): THREE.CanvasTexture {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  if (g) {
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.14)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Thin transparent things just fade out with fog; correct for both normal and
// additive blending, and avoids glowing lines showing through a fogged corridor.
const FOG_FADE = /* glsl */ `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFade = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  #else
    float fogFade = 1.0;
  #endif
`;

function shader(
  uniforms: Record<string, THREE.IUniform>,
  vertexShader: string,
  fragmentShader: string,
  extra: THREE.ShaderMaterialParameters = {},
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]),
    vertexShader,
    fragmentShader,
    fog: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    ...extra,
  });
}

// --------------------------------------------------------- fracture pattern

type Crack = { pts: Vec2[]; radii: number[]; angle: number };
type Polyline = { pts: Vec2[]; t: number[]; w0: number; w1: number; closed?: boolean };
type Fracture = { hole: Vec2[]; lines: Polyline[] };

/** Radial cracks from the impact point, fracture rings between them, and the hole. */
function buildFracture(rand: () => number, radialCount: number): Fracture {
  const halfW = CASE.w / 2;
  const inside = (p: Vec2) => p.x >= -halfW && p.x <= halfW && p.y >= 0 && p.y <= CASE.h;
  const maxR = Math.max(
    Math.hypot(IMPACT.x + halfW, IMPACT.y),
    Math.hypot(IMPACT.x + halfW, CASE.h - IMPACT.y),
    Math.hypot(halfW - IMPACT.x, IMPACT.y),
    Math.hypot(halfW - IMPACT.x, CASE.h - IMPACT.y),
  );
  const timeAt = (r: number) => 0.04 + (r / maxR) * 0.88;

  const cracks: Crack[] = [];
  for (let i = 0; i < radialCount; i++) {
    const angle = ((i + (rand() - 0.5) * 0.55) / radialCount) * Math.PI * 2 + 0.2;
    const r0 = 0.15 + rand() * 0.12;
    const limit = rand() < 0.3 ? 0.5 + rand() * 0.4 : Infinity;
    const pts: Vec2[] = [];
    const radii: number[] = [];
    let a = angle;
    let r = r0;
    let prev: Vec2 = { x: IMPACT.x + Math.cos(a) * r, y: IMPACT.y + Math.sin(a) * r };
    pts.push(prev);
    radii.push(r);
    for (let k = 0; k < 24 && r < limit; k++) {
      r += 0.1 + rand() * 0.12;
      a += (rand() - 0.5) * 0.24;
      const next: Vec2 = { x: IMPACT.x + Math.cos(a) * r, y: IMPACT.y + Math.sin(a) * r };
      if (!inside(next)) {
        // Clip the last segment to the pane edge so the crack runs into the frame.
        let lo = 0;
        let hi = 1;
        for (let s = 0; s < 12; s++) {
          const mid = (lo + hi) / 2;
          if (inside({ x: lerp(prev.x, next.x, mid), y: lerp(prev.y, next.y, mid) })) lo = mid;
          else hi = mid;
        }
        const edge = { x: lerp(prev.x, next.x, lo), y: lerp(prev.y, next.y, lo) };
        pts.push(edge);
        radii.push(Math.hypot(edge.x - IMPACT.x, edge.y - IMPACT.y));
        break;
      }
      pts.push(next);
      radii.push(r);
      prev = next;
    }
    cracks.push({ pts, radii, angle });
  }

  const lines: Polyline[] = [];
  for (const c of cracks) {
    lines.push({ pts: c.pts, t: c.radii.map(timeAt), w0: 0.011, w1: 0.0035 });
  }

  // Fracture rings: short chords joining neighbouring radial cracks.
  for (let ring = 1; ring <= 3; ring++) {
    for (let i = 0; i < cracks.length; i++) {
      const a = cracks[i];
      const b = cracks[(i + 1) % cracks.length];
      const pa = a?.pts[ring];
      const pb = b?.pts[ring];
      const ra = a?.radii[ring];
      const rb = b?.radii[ring];
      if (!pa || !pb || ra === undefined || rb === undefined) continue;
      if (rand() > 0.72 - ring * 0.12) continue;
      const mid = {
        x: lerp(pa.x, pb.x, 0.5) + (rand() - 0.5) * 0.05,
        y: lerp(pa.y, pb.y, 0.5) + (rand() - 0.5) * 0.05,
      };
      const t = timeAt(Math.max(ra, rb)) + 0.04;
      lines.push({ pts: [pa, mid, pb], t: [t, t, t], w0: 0.005, w1: 0.005 });
    }
  }

  // Hairline branches peeling off the radial cracks.
  for (const c of cracks) {
    if (c.pts.length < 3 || rand() > 0.65) continue;
    const k = 1 + Math.floor(rand() * (c.pts.length - 2));
    const from = c.pts[k];
    const before = c.pts[k - 1];
    const r = c.radii[k];
    if (!from || !before || r === undefined) continue;
    let dir = Math.atan2(from.y - before.y, from.x - before.x) + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.4);
    const pts: Vec2[] = [from];
    const t: number[] = [timeAt(r)];
    let p = from;
    let travelled = 0;
    for (let s = 0; s < 2; s++) {
      const len = 0.08 + rand() * 0.12;
      const next = { x: p.x + Math.cos(dir) * len, y: p.y + Math.sin(dir) * len };
      if (!inside(next)) break;
      travelled += len;
      pts.push(next);
      t.push(timeAt(r + travelled));
      p = next;
      dir += (rand() - 0.5) * 0.5;
    }
    if (pts.length > 1) lines.push({ pts, t, w0: 0.005, w1: 0.002 });
  }

  // The hole: one vertex where each radial crack starts, one jagged vertex between.
  const hole: Vec2[] = [];
  for (let i = 0; i < cracks.length; i++) {
    const a = cracks[i];
    const b = cracks[(i + 1) % cracks.length];
    const start = a?.pts[0];
    const ra = a?.radii[0];
    const rb = b?.radii[0];
    if (!a || !b || !start || ra === undefined || rb === undefined) continue;
    hole.push(start);
    const nextAngle = b.angle > a.angle ? b.angle : b.angle + Math.PI * 2;
    const midAngle = lerp(a.angle, nextAngle, 0.35 + rand() * 0.3);
    const midR = ((ra + rb) / 2) * (0.62 + rand() * 0.4);
    hole.push({ x: IMPACT.x + Math.cos(midAngle) * midR, y: IMPACT.y + Math.sin(midAngle) * midR });
  }
  lines.push({ pts: hole, t: hole.map(() => 0), w0: 0.008, w1: 0.008, closed: true });

  return { hole, lines };
}

/** Turns polylines into one mesh of tapered ribbons with a reveal-time attribute. */
function buildCrackGeometry(lines: Polyline[]): THREE.BufferGeometry {
  const position: number[] = [];
  const reveal: number[] = [];
  const side: number[] = [];
  const index: number[] = [];

  for (const line of lines) {
    const n = line.pts.length;
    if (n < 2) continue;
    const base = position.length / 3;
    const at = (i: number): Vec2 => {
      const j = line.closed ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i));
      return line.pts[j] as Vec2;
    };
    const count = line.closed ? n + 1 : n;
    for (let i = 0; i < count; i++) {
      const p = at(i);
      const a = at(i - 1);
      const b = at(i + 1);
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      const half = lerp(line.w0, line.w1, n > 1 ? Math.min(1, i / (n - 1)) : 0) / 2;
      const nx = (-ty / len) * half;
      const ny = (tx / len) * half;
      const t = line.t[line.closed ? i % n : i] ?? 0;
      position.push(p.x + nx, p.y + ny, 0, p.x - nx, p.y - ny, 0);
      reveal.push(t, t);
      side.push(1, -1);
      if (i < count - 1) {
        const v = base + i * 2;
        index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('aReveal', new THREE.Float32BufferAttribute(reveal, 1));
  geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  geo.setIndex(index);
  return geo;
}

function toShapePoints(pts: Vec2[]): THREE.Vector2[] {
  return pts.map((p) => new THREE.Vector2(p.x, p.y));
}

/** ShapeGeometry leaves raw x/y in uv; the glass shader wants 0..1 across the pane. */
function normalisePaneUv(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + CASE.w / 2) / CASE.w, pos.getY(i) / CASE.h);
  }
  uv.needsUpdate = true;
}

/** Back, left, right and top panes as one mesh (one draw call). */
function buildClosedPanes(): THREE.BufferGeometry {
  const hw = CASE.w / 2;
  const hd = CASE.d / 2;
  const h = CASE.h;
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const quad = (c: number[][], n: [number, number, number]) => {
    const base = position.length / 3;
    for (const v of c) position.push(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
    for (let i = 0; i < 4; i++) normal.push(n[0], n[1], n[2]);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  quad([[hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd]], [0, 0, -1]);
  quad([[-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd]], [-1, 0, 0]);
  quad([[hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd]], [1, 0, 0]);
  quad([[-hw, h, hd], [hw, h, hd], [hw, h, -hd], [-hw, h, -hd]], [0, 1, 0]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

// -------------------------------------------------------------------- shards

type Fall = {
  startPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  delay: number;
  fallTime: number;
  total: number;
  spinAxis: THREE.Vector3;
  turns: number;
};

type Shard = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
  fall?: Fall;
};

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Pane space -> group space. */
function paneToLocal(x: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x, PLINTH.height + y, CASE.d / 2);
}

function buildShards(
  rand: () => number,
  hole: Vec2[],
  counts: { hanging: number; plinth: number; floor: number },
): Shard[] {
  const shards: Shard[] = [];

  // Still clinging to the rim of the hole, pointing in at the impact.
  const step = Math.max(1, Math.floor(hole.length / counts.hanging));
  for (let i = 0; i < counts.hanging; i++) {
    const a = hole[(i * step) % hole.length];
    const b = hole[(i * step + 1) % hole.length];
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
    const toImpact = Math.atan2(IMPACT.y - my, IMPACT.x - mx);
    const quat = new THREE.Quaternion()
      .setFromAxisAngle(AXIS_Z, toImpact - Math.PI / 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, (rand() - 0.35) * 0.7));
    shards.push({
      pos: paneToLocal(mx, my).add(new THREE.Vector3(0, 0, 0.004)),
      quat,
      scale: new THREE.Vector3(edgeLen * 0.95, 0.06 + rand() * 0.07, 1),
    });
  }

  const lying = (surfaceY: number, x: number, z: number, size: number) => {
    const tilt = (rand() - 0.5) * 0.3;
    const quat = new THREE.Quaternion()
      .setFromAxisAngle(AXIS_Y, rand() * Math.PI * 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, -Math.PI / 2 + tilt))
      .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, (rand() - 0.5) * 0.25));
    const scale = new THREE.Vector3(size * (0.7 + rand() * 0.6), size * (0.8 + rand() * 0.8), 1);
    // Lift by the tilt so a canted shard never dips through the surface.
    const pos = new THREE.Vector3(x, surfaceY + 0.006 + Math.abs(tilt) * scale.y, z);

    const startAngle = rand() * Math.PI * 2;
    const startR = rand() * 0.16;
    const startPos = paneToLocal(IMPACT.x + Math.cos(startAngle) * startR, IMPACT.y + Math.sin(startAngle) * startR);
    const fallTime = Math.sqrt((2 * Math.max(0.05, startPos.y - pos.y)) / GRAVITY);
    const fall: Fall = {
      startPos,
      startQuat: new THREE.Quaternion().setFromAxisAngle(AXIS_Z, rand() * Math.PI * 2),
      delay: rand() * 0.3,
      fallTime,
      total: fallTime * (1 + 2 * RESTITUTION * (1 + RESTITUTION)),
      spinAxis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      turns: (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 2)),
    };
    shards.push({ pos, quat, scale, fall });
  };

  // Inside the case, in front of the screen's foot.
  for (let i = 0; i < counts.plinth; i++) {
    const x = Math.min(0.95, Math.max(-0.95, IMPACT.x - 0.55 + rand() * 1.0));
    lying(PLINTH.height, x, 0.12 + rand() * 0.38, 0.05 + rand() * 0.05);
  }
  // On the floor toward the visitor, clear of the plaque.
  for (let i = 0; i < counts.floor; i++) {
    const z = 1.05 + rand() * rand() * 1.3;
    lying(0, IMPACT.x - 0.9 + rand() * 1.7, z, 0.07 + rand() * 0.08);
  }
  return shards;
}

const scratch = {
  m: new THREE.Matrix4(),
  p: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  spin: new THREE.Quaternion(),
};

/** Closed-form drop + two bounces, so the settled pose is exact and deterministic. */
function shardMatrix(shard: Shard, time: number): THREE.Matrix4 {
  const { m, p, q, spin } = scratch;
  const fall = shard.fall;
  if (!fall || time >= fall.delay + fall.total) return m.compose(shard.pos, shard.quat, shard.scale);

  const tau = Math.max(0, time - fall.delay);
  const k = clamp01(tau / fall.total);
  const travel = 1 - Math.pow(1 - k, 1.6);
  p.lerpVectors(fall.startPos, shard.pos, travel);

  if (tau < fall.fallTime) {
    p.y = fall.startPos.y - 0.5 * GRAVITY * tau * tau;
  } else {
    let tb = tau - fall.fallTime;
    let v = GRAVITY * fall.fallTime * RESTITUTION;
    p.y = shard.pos.y;
    for (let bounce = 0; bounce < 2; bounce++) {
      const duration = (2 * v) / GRAVITY;
      if (tb < duration) {
        p.y = shard.pos.y + v * tb - 0.5 * GRAVITY * tb * tb;
        break;
      }
      tb -= duration;
      v *= RESTITUTION;
    }
  }

  // Whole turns, so the tumble starts and ends exactly on the keyed poses.
  spin.setFromAxisAngle(fall.spinAxis, Math.PI * 2 * fall.turns * k);
  q.copy(fall.startQuat).slerp(shard.quat, smooth(k)).premultiply(spin);
  return m.compose(p, q, shard.scale);
}

// --------------------------------------------------------------------- plaque

function cssFont(variable: string, fallback: string): string {
  const value = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

function drawPlaque(canvas: HTMLCanvasElement, logo: HTMLImageElement | null): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const s = canvas.width / 1600;
  const serif = cssFont('--font-display', "'Newsreader', 'Iowan Old Style', Georgia, serif");
  const sans = cssFont('--font-body', "'Public Sans', system-ui, sans-serif");
  const brass = '#c9a35a';

  g.setTransform(s, 0, 0, s, 0, 0);
  g.fillStyle = '#0d0c0b';
  g.fillRect(0, 0, 1600, 640);
  g.strokeStyle = brass;
  g.lineWidth = 6;
  g.strokeRect(18, 18, 1564, 604);
  g.lineWidth = 1.5;
  g.strokeRect(32, 32, 1536, 576);

  const logoSize = 300;
  const logoX = 78;
  const logoY = (640 - logoSize) / 2;
  if (logo) {
    g.drawImage(logo, logoX, logoY, logoSize, logoSize);
  } else {
    g.lineWidth = 3;
    g.beginPath();
    g.arc(logoX + logoSize / 2, 320, logoSize / 2 - 8, 0, Math.PI * 2);
    g.stroke();
  }

  const left = 440;
  const maxWidth = 1600 - left - 70;
  const fit = (text: string, weight: number, size: number, family: string) => {
    let px = size;
    g.font = `${weight} ${px}px ${family}`;
    const width = g.measureText(text).width;
    if (width > maxWidth) {
      px = Math.floor((px * maxWidth) / width);
      g.font = `${weight} ${px}px ${family}`;
    }
  };

  g.textBaseline = 'alphabetic';
  g.fillStyle = brass;
  fit(`${centerpiece.no} · CENTREPIECE`, 600, 46, sans);
  g.fillText(`${centerpiece.no} · CENTREPIECE`, left, 136);

  g.fillStyle = '#f5efe2';
  fit(centerpiece.title, 600, 156, serif);
  g.fillText(centerpiece.title, left - 4, 290);

  g.fillStyle = '#bdb6a8';
  fit(centerpiece.medium, 400, 54, sans);
  g.fillText(centerpiece.medium, left, 378);

  g.fillStyle = brass;
  g.fillRect(left, 424, maxWidth, 2);

  g.fillStyle = '#58d68d';
  g.beginPath();
  g.arc(left + 20, 512, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ecc97f';
  fit('Please touch — open source', 600, 60, sans);
  g.fillText('Please touch — open source', left + 58, 532);
}

// ----------------------------------------------------------------- the piece

export function createCenterpiece(ctx: SceneCtx): ScenePart {
  const low = ctx.quality === 'low';
  const rand = mulberry32(0x7a4d00);
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stopIndex = Math.max(
    0,
    stops.findIndex((s) => s.id === 'centerpiece'),
  );
  const maxAnisotropy = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());

  let disposed = false;
  const disposables: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const group = new THREE.Group();
  group.name = 'centerpiece';
  group.position.set(SALON.center[0], SALON.center[1], SALON.center[2]);

  const add = <T extends THREE.Object3D>(object: T, parent: THREE.Object3D = group): T => {
    parent.add(object);
    return object;
  };

  const glowTex = own(makeGlowTexture(low ? 64 : 128));

  // ---- plinth, base step, contact shadow

  const plinthMat = own(new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 }));
  const unitBox = own(new THREE.BoxGeometry(1, 1, 1));

  const plinth = add(new THREE.Mesh(unitBox, plinthMat));
  plinth.scale.set(PLINTH.width, PLINTH.height, PLINTH.depth);
  plinth.position.y = PLINTH.height / 2;

  const step = add(new THREE.Mesh(unitBox, plinthMat));
  step.scale.set(PLINTH.width + 0.16, 0.07, PLINTH.depth + 0.16);
  step.position.y = 0.035;

  const flatPlane = own(new THREE.PlaneGeometry(1, 1));
  const shadowMat = own(
    new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0x000000,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const shadow = add(new THREE.Mesh(flatPlane, shadowMat));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(PLINTH.width * 2.3, PLINTH.depth * 3, 1);
  shadow.position.y = 0.004;
  shadow.renderOrder = ORDER.shadow;

  // ---- the artwork: a slim monitor showing the dashboard

  const display = add(new THREE.Group());
  display.position.set(0, PLINTH.height, SCREEN.z);

  const bezelMat = own(new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4, metalness: 0.3 }));
  const foot = add(new THREE.Mesh(unitBox, bezelMat), display);
  foot.scale.set(0.5, 0.02, 0.26);
  foot.position.y = 0.01;
  const neck = add(new THREE.Mesh(unitBox, bezelMat), display);
  neck.scale.set(0.09, SCREEN.standH + 0.1, 0.035);
  neck.position.set(0, (SCREEN.standH + 0.1) / 2, -0.03);

  const panel = add(new THREE.Group(), display);
  panel.position.y = SCREEN.standH;
  panel.rotation.x = SCREEN.tilt;

  const slab = add(new THREE.Mesh(unitBox, bezelMat), panel);
  slab.scale.set(SCREEN.w + 0.06, SCREEN.h + 0.06, 0.04);
  slab.position.y = SCREEN.h / 2 + 0.03;

  const screenMat = own(new THREE.MeshBasicMaterial({ color: 0x11161c, toneMapped: false }));
  const screen = add(new THREE.Mesh(flatPlane, screenMat), panel);
  screen.scale.set(SCREEN.w, SCREEN.h, 1);
  screen.position.set(0, SCREEN.h / 2 + 0.03, 0.0215);

  const haloMat = own(
    new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
  );
  const halo = add(new THREE.Mesh(flatPlane, haloMat), panel);
  halo.scale.set(SCREEN.w * 1.75, SCREEN.h * 2.3, 1);
  halo.position.set(0, SCREEN.h / 2 + 0.03, -0.06);
  halo.renderOrder = ORDER.halo;

  const loader = new THREE.TextureLoader();
  let screenTex: THREE.Texture | null = null;
  loader.load(centerpiece.image, (tex) => {
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
  });

  // ---- vitrine: brass profiles, four whole panes, one broken pane

  const brassMat = own(new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.55 }));
  const edges = add(new THREE.InstancedMesh(unitBox, brassMat, 12));
  {
    const e = CASE.edge;
    const hw = CASE.w / 2;
    const hd = CASE.d / 2;
    const y0 = PLINTH.height;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let i = 0;
    const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      m.compose(new THREE.Vector3(x, y0 + y, z), q, new THREE.Vector3(sx, sy, sz));
      edges.setMatrixAt(i++, m);
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(sx * hw, CASE.h / 2, sz * hd, e, CASE.h, e);
    for (const y of [e / 2, CASE.h - e / 2]) {
      for (const sz of [-1, 1]) put(0, y, sz * hd, CASE.w + e, e, e);
      for (const sx of [-1, 1]) put(sx * hw, y, 0, e, e, CASE.d + e);
    }
    edges.instanceMatrix.needsUpdate = true;
  }

  const glassVertex = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    #include <fog_pars_vertex>
    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalMatrix * normal;
      vView = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;
  const glassFragment = /* glsl */ `
    uniform vec3 uTint;
    uniform float uOpacity;
    uniform float uFresnel;
    uniform float uSheen;
    uniform float uGlint;
    uniform float uGlintStrength;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    #include <fog_pars_fragment>
    void main() {
      ${FOG_FADE}
      float facing = abs(dot(normalize(vNormal), normalize(vView)));
      float fresnel = pow(1.0 - facing, 2.5);
      float diag = vUv.x * 0.8 + vUv.y * 0.45;
      float sheen = pow(0.5 + 0.5 * sin(diag * 6.0 + 1.0), 6.0);
      float band = (diag - uGlint) / 0.07;
      float glint = exp(-band * band) * uGlintStrength;
      float alpha = uOpacity + fresnel * uFresnel + sheen * uSheen + glint;
      gl_FragColor = vec4(uTint + vec3(glint), clamp(alpha, 0.0, 1.0) * fogFade);
      #include <colorspace_fragment>
    }
  `;
  const glassUniforms = () => ({
    uTint: { value: new THREE.Color() },
    uOpacity: { value: 0.08 },
    uFresnel: { value: 0.3 },
    uSheen: { value: 0.04 },
    uGlint: { value: -1 },
    uGlintStrength: { value: 0 },
  });
  const glassMat = own(shader(glassUniforms(), glassVertex, glassFragment, { side: THREE.DoubleSide }));
  const frontMat = own(shader(glassUniforms(), glassVertex, glassFragment, { side: THREE.DoubleSide }));

  const closedPanes = add(new THREE.Mesh(own(buildClosedPanes()), glassMat));
  closedPanes.position.y = PLINTH.height;
  closedPanes.renderOrder = ORDER.glassBack;

  const fracture = buildFracture(rand, low ? 9 : 12);

  const paneShape = new THREE.Shape([
    new THREE.Vector2(-CASE.w / 2, 0),
    new THREE.Vector2(CASE.w / 2, 0),
    new THREE.Vector2(CASE.w / 2, CASE.h),
    new THREE.Vector2(-CASE.w / 2, CASE.h),
  ]);
  paneShape.holes.push(new THREE.Path(toShapePoints(fracture.hole)));
  const frontGeo = own(new THREE.ShapeGeometry(paneShape));
  normalisePaneUv(frontGeo);
  const frontPane = add(new THREE.Mesh(frontGeo, frontMat));
  paneToLocal(0, 0, frontPane.position);
  frontPane.renderOrder = ORDER.glassFront;

  // The piece that is about to drop out; removed the moment the case gives way.
  const plugGeo = own(new THREE.ShapeGeometry(new THREE.Shape(toShapePoints(fracture.hole))));
  normalisePaneUv(plugGeo);
  const plug = add(new THREE.Mesh(plugGeo, frontMat));
  plug.position.copy(frontPane.position);
  plug.renderOrder = ORDER.glassFront;

  const crackMat = own(
    shader(
      {
        uColor: { value: new THREE.Color() },
        uGain: { value: 1 },
        uOpacity: { value: 1 },
        uProgress: { value: CRACK_PRE },
        uTip: { value: 0 },
        uTime: { value: 0 },
        uShimmer: { value: reduced ? 0 : 0.22 },
      },
      /* glsl */ `
        attribute float aReveal;
        attribute float aSide;
        varying float vReveal;
        varying float vSide;
        #include <fog_pars_vertex>
        void main() {
          vReveal = aReveal;
          vSide = aSide;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      /* glsl */ `
        uniform vec3 uColor;
        uniform float uGain;
        uniform float uOpacity;
        uniform float uProgress;
        uniform float uTip;
        uniform float uTime;
        uniform float uShimmer;
        varying float vReveal;
        varying float vSide;
        #include <fog_pars_fragment>
        void main() {
          if (vReveal > uProgress) discard;
          ${FOG_FADE}
          float tip = smoothstep(uProgress - 0.14, uProgress, vReveal) * uTip;
          float shimmer = uShimmer * sin(vReveal * 22.0 - uTime * 0.7);
          float core = 1.0 - vSide * vSide * 0.65;
          vec3 color = uColor * uGain * (1.0 + shimmer + tip * 1.6);
          gl_FragColor = vec4(color, clamp(core * uOpacity * (1.0 + tip), 0.0, 1.0) * fogFade);
          #include <colorspace_fragment>
        }
      `,
      { side: THREE.DoubleSide },
    ),
  );
  const cracks = add(new THREE.Mesh(own(buildCrackGeometry(fracture.lines)), crackMat));
  paneToLocal(0, 0, cracks.position).z += 0.003;
  cracks.renderOrder = ORDER.cracks;

  // ---- shards

  const shardSpecs = buildShards(
    rand,
    fracture.hole,
    low ? { hanging: 4, plinth: 6, floor: 10 } : { hanging: 6, plinth: 9, floor: 20 },
  );
  const shardGeo = own(new THREE.BufferGeometry());
  shardGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.12, 0.9, 0], 3),
  );
  shardGeo.setAttribute('aBary', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  shardGeo.setAttribute(
    'aSeed',
    new THREE.InstancedBufferAttribute(new Float32Array(shardSpecs.map(() => rand())), 1),
  );
  const shardMat = own(
    shader(
      {
        uTint: { value: new THREE.Color() },
        uBody: { value: 0.2 },
        uEdge: { value: 0.8 },
        uTwinkle: { value: 1 },
        uTime: { value: 0 },
      },
      /* glsl */ `
        attribute vec3 aBary;
        attribute float aSeed;
        varying vec3 vBary;
        varying float vSeed;
        #include <fog_pars_vertex>
        void main() {
          vBary = aBary;
          vSeed = aSeed;
          vec4 local = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            local = instanceMatrix * local;
          #endif
          vec4 mvPosition = modelViewMatrix * local;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      /* glsl */ `
        uniform vec3 uTint;
        uniform float uBody;
        uniform float uEdge;
        uniform float uTwinkle;
        uniform float uTime;
        varying vec3 vBary;
        varying float vSeed;
        #include <fog_pars_fragment>
        void main() {
          ${FOG_FADE}
          float nearest = min(vBary.x, min(vBary.y, vBary.z));
          float edge = 1.0 - smoothstep(0.0, 0.05 + fwidth(nearest) * 1.5, nearest);
          float twinkle = pow(max(0.0, sin(uTime * (0.35 + vSeed * 0.5) + vSeed * 40.0)), 24.0) * uTwinkle;
          float alpha = uBody * (0.6 + vSeed * 0.8) + edge * uEdge + twinkle;
          gl_FragColor = vec4(uTint * (1.0 + edge * 0.4 + twinkle), clamp(alpha, 0.0, 1.0) * fogFade);
          #include <colorspace_fragment>
        }
      `,
      { side: THREE.DoubleSide },
    ),
  );
  const shards = add(new THREE.InstancedMesh(shardGeo, shardMat, shardSpecs.length));
  shards.renderOrder = ORDER.shards;
  // Instances travel from the pane to the floor; the base triangle's bounds say nothing.
  shards.frustumCulled = false;

  const poseShards = (time: number) => {
    for (let i = 0; i < shardSpecs.length; i++) {
      const spec = shardSpecs[i];
      if (spec) shards.setMatrixAt(i, shardMatrix(spec, time));
    }
    shards.instanceMatrix.needsUpdate = true;
  };

  // ---- rope barrier, left open

  const postProfile = [
    [0, 0], [0.17, 0], [0.17, 0.02], [0.15, 0.035], [0.05, 0.05], [0.024, 0.08], [0.024, 0.9],
    [0.04, 0.915], [0.04, 0.93], [0.024, 0.945], [0.05, 0.975], [0.058, 1.0], [0.05, 1.03], [0, 1.05],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const postGeo = own(new THREE.LatheGeometry(postProfile, low ? 12 : 20));
  const POST = { x: 1.55, z: 1.7 };
  for (const side of [-1, 1]) {
    const post = add(new THREE.Mesh(postGeo, brassMat));
    post.position.set(side * POST.x, 0, POST.z);
  }

  // Hooked on the left post, dropped on the floor on the right: the way in is open.
  const ropeR = 0.027;
  const ropeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POST.x + 0.03, 0.925, POST.z + 0.01),
    new THREE.Vector3(-POST.x + 0.1, 0.55, POST.z + 0.05),
    new THREE.Vector3(-POST.x + 0.2, 0.12, POST.z + 0.12),
    new THREE.Vector3(-POST.x + 0.42, ropeR + 0.004, POST.z + 0.28),
    new THREE.Vector3(-0.62, ropeR + 0.004, POST.z + 0.44),
    new THREE.Vector3(-0.18, ropeR + 0.004, POST.z + 0.3),
    new THREE.Vector3(0.22, ropeR + 0.004, POST.z + 0.42),
  ]);
  const ropeMat = own(new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }));
  add(new THREE.Mesh(own(new THREE.TubeGeometry(ropeCurve, low ? 28 : 48, ropeR, low ? 6 : 8, false)), ropeMat));

  const ropeEnd = ropeCurve.getPoint(1);
  const ropeDir = ropeCurve.getTangent(1).normalize();
  const cap = add(new THREE.Mesh(own(new THREE.CylinderGeometry(0.033, 0.033, 0.08, 12)), brassMat));
  cap.position.copy(ropeEnd).addScaledVector(ropeDir, 0.03);
  cap.quaternion.setFromUnitVectors(AXIS_Y, ropeDir);
  const hook = add(new THREE.Mesh(own(new THREE.TorusGeometry(0.036, 0.008, 6, 16)), brassMat));
  hook.position.copy(ropeEnd).addScaledVector(ropeDir, 0.105);
  hook.position.y = 0.012;
  hook.rotation.x = -Math.PI / 2;

  // ---- plaque

  const plaque = add(new THREE.Group());
  plaque.position.set(0, 0.5, PLINTH.depth / 2 + 0.13);
  plaque.rotation.x = PLAQUE.tilt;
  const plaqueBack = add(new THREE.Mesh(unitBox, brassMat), plaque);
  plaqueBack.scale.set(PLAQUE.w + 0.04, PLAQUE.h + 0.04, 0.03);

  const plaqueCanvas = makeCanvas(low ? 1024 : 1600, low ? 410 : 640);
  const plaqueTex = own(new THREE.CanvasTexture(plaqueCanvas));
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  plaqueTex.anisotropy = maxAnisotropy;
  const plaqueMat = own(new THREE.MeshBasicMaterial({ map: plaqueTex, toneMapped: false }));
  const plaqueFace = add(new THREE.Mesh(flatPlane, plaqueMat), plaque);
  plaqueFace.scale.set(PLAQUE.w, PLAQUE.h, 1);
  plaqueFace.position.z = 0.0165;

  let logoImage: HTMLImageElement | null = null;
  const repaintPlaque = () => {
    if (disposed) return;
    drawPlaque(plaqueCanvas, logoImage);
    plaqueTex.needsUpdate = true;
    ctx.invalidate();
  };
  repaintPlaque();
  new THREE.ImageLoader().load(centerpiece.logo, (image) => {
    logoImage = image;
    repaintPlaque();
  });
  // The first paint may land before the webfonts do.
  if (typeof document !== 'undefined' && document.fonts) {
    void document.fonts.ready.then(repaintPlaque).catch(() => undefined);
  }

  // ---- hero light, beam and dust

  const spot = add(new THREE.SpotLight(0xffffff, 100, 0, SPOT_ANGLE, 0.7, 2));
  spot.position.copy(LIGHT_POS);
  spot.castShadow = false;
  add(spot.target);
  spot.target.position.copy(LIGHT_AIM);

  // Beam axis runs from the lamp through the aim point down to the floor.
  const beamDir = LIGHT_AIM.clone().sub(LIGHT_POS).normalize();
  const beamLength = -LIGHT_POS.y / beamDir.y;
  const beamTopR = 0.16;
  const beamBottomR = Math.tan(SPOT_ANGLE) * beamLength * 0.85;
  const beamGeo = own(new THREE.CylinderGeometry(beamTopR, beamBottomR, beamLength, low ? 24 : 40, 1, true));
  const beamMat = own(
    shader(
      { uColor: { value: new THREE.Color() }, uOpacity: { value: 0.1 } },
      /* glsl */ `
        varying float vHeight;
        varying vec3 vNormal;
        varying vec3 vView;
        #include <fog_pars_vertex>
        void main() {
          vHeight = uv.y;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalMatrix * normal;
          vView = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vHeight;
        varying vec3 vNormal;
        varying vec3 vView;
        #include <fog_pars_fragment>
        void main() {
          ${FOG_FADE}
          // Fade toward the silhouette so the cone reads as a volume, not a shell.
          float facing = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.5);
          float fall = mix(0.06, 1.0, pow(vHeight, 1.7)) * smoothstep(0.0, 0.14, vHeight);
          gl_FragColor = vec4(uColor, uOpacity * facing * fall * fogFade);
          #include <colorspace_fragment>
        }
      `,
      { blending: THREE.AdditiveBlending, side: THREE.FrontSide },
    ),
  );
  const beam = add(new THREE.Mesh(beamGeo, beamMat));
  beam.position.copy(LIGHT_POS).addScaledVector(beamDir, beamLength / 2);
  beam.quaternion.setFromUnitVectors(AXIS_Y, beamDir.clone().negate());
  beam.renderOrder = ORDER.beam;

  const moteCount = low ? 60 : 110;
  const moteSeed = new Float32Array(moteCount * 4); // along-axis offset, angle, radial fraction, speed
  for (let i = 0; i < moteCount; i++) {
    moteSeed[i * 4] = rand();
    moteSeed[i * 4 + 1] = rand() * Math.PI * 2;
    moteSeed[i * 4 + 2] = Math.sqrt(rand());
    moteSeed[i * 4 + 3] = (rand() < 0.5 ? -1 : 1) * (1 / 90 + rand() / 70);
  }
  const motePos = new THREE.BufferAttribute(new Float32Array(moteCount * 3), 3);
  const moteCol = new THREE.BufferAttribute(new Float32Array(moteCount * 3), 3);
  motePos.setUsage(THREE.DynamicDrawUsage);
  moteCol.setUsage(THREE.DynamicDrawUsage);
  const moteGeo = own(new THREE.BufferGeometry());
  moteGeo.setAttribute('position', motePos);
  moteGeo.setAttribute('color', moteCol);
  const moteMat = own(
    new THREE.PointsMaterial({
      map: glowTex,
      size: 0.04,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
  );
  const motes = add(new THREE.Points(moteGeo, moteMat));
  motes.frustumCulled = false;
  motes.renderOrder = ORDER.motes;

  // Positions are a pure function of time, so the scene can sleep and resume freely.
  const poseMotes = (time: number) => {
    for (let i = 0; i < moteCount; i++) {
      const offset = moteSeed[i * 4] ?? 0;
      const angle0 = moteSeed[i * 4 + 1] ?? 0;
      const radial = moteSeed[i * 4 + 2] ?? 0;
      const speed = moteSeed[i * 4 + 3] ?? 0;
      const cycle = offset + time * speed;
      const phase = cycle - Math.floor(cycle);
      const along = 0.32 + phase * 0.64;
      const angle = angle0 + Math.sin(time * 0.11 + offset * 20) * 0.35;
      const r = lerp(beamTopR, beamBottomR, along) * 0.8 * radial;
      motePos.setXYZ(
        i,
        LIGHT_POS.x + beamDir.x * beamLength * along + Math.cos(angle) * r,
        LIGHT_POS.y + beamDir.y * beamLength * along + Math.sin(time * 0.23 + offset * 31) * 0.03,
        LIGHT_POS.z + beamDir.z * beamLength * along + Math.sin(angle) * r,
      );
      // Fade in and out across the wrap so no mote ever pops.
      const fade = Math.sin(Math.PI * phase) * (0.45 + 0.55 * radial);
      moteCol.setXYZ(i, fade, fade * 0.92, fade * 0.78);
    }
    motePos.needsUpdate = true;
    moteCol.needsUpdate = true;
  };
  poseMotes(17);

  // ---- hotspot

  const hotspotMat = own(new THREE.MeshBasicMaterial({ visible: false }));
  const hotspotMesh = add(new THREE.Mesh(unitBox, hotspotMat));
  const hotspotH = PLINTH.height + PLINTH.caseHeight;
  hotspotMesh.scale.set(PLINTH.width + 0.1, hotspotH, PLINTH.depth + 0.1);
  hotspotMesh.position.y = hotspotH / 2;
  hotspotMesh.name = 'centerpiece-hotspot';
  const hotspots: Hotspot[] = [{ object: hotspotMesh, stopId: 'centerpiece' }];

  // ---- state

  type Phase = 'waiting' | 'breaking' | 'settled';
  let phase: Phase = 'waiting';
  let clock = 0;
  let spec = THEMES[ctx.theme];

  const setCrackProgress = (value: number) => {
    (crackMat.uniforms.uProgress as THREE.IUniform<number>).value = value;
  };
  const setUniform = (material: THREE.ShaderMaterial, name: string, value: number) => {
    const uniform = material.uniforms[name];
    if (uniform) uniform.value = value;
  };

  const settle = () => {
    phase = 'settled';
    plug.visible = false;
    shards.visible = true;
    poseShards(Infinity);
    setCrackProgress(1.1);
    setUniform(crackMat, 'uTip', 0);
    setUniform(frontMat, 'uGlintStrength', 0);
  };

  const startBreaking = () => {
    phase = 'breaking';
    clock = 0;
    plug.visible = false;
    shards.visible = true;
    poseShards(0);
  };

  const stepBreaking = (dt: number) => {
    // Frames arrive on demand; a long gap must not skip the whole beat.
    clock += Math.min(dt, 1 / 20);
    if (clock >= ARRIVAL_SECONDS) {
      settle();
      return;
    }
    const run = clamp01(clock / 0.9);
    setCrackProgress(lerp(CRACK_PRE, 1.1, 1 - Math.pow(1 - run, 3)));
    setUniform(crackMat, 'uTip', 1 - smooth(clamp01((clock - 0.8) / 0.6)));
    const sweep = clamp01((clock - 0.15) / 0.95);
    setUniform(frontMat, 'uGlint', lerp(-0.2, 1.5, sweep));
    setUniform(frontMat, 'uGlintStrength', Math.sin(Math.PI * sweep) * 0.5);
    poseShards(clock);
  };

  const stepIdle = (elapsed: number) => {
    setUniform(crackMat, 'uTime', elapsed);
    setUniform(shardMat, 'uTime', elapsed);
    haloMat.opacity = spec.halo * (0.9 + 0.1 * Math.sin(elapsed * 0.8));
    poseMotes(elapsed);
    if (phase === 'settled') {
      // A faint band of light crossing the pane every dozen seconds.
      const cycle = elapsed / 12;
      const sweep = cycle - Math.floor(cycle);
      setUniform(frontMat, 'uGlint', lerp(-0.4, 2.2, sweep));
      setUniform(frontMat, 'uGlintStrength', 0.1);
    }
  };

  const setTheme = (theme: ThemeName) => {
    if (disposed) return;
    spec = THEMES[theme];

    spot.intensity = spec.spot;
    spot.color.setHex(spec.spotColor);
    (beamMat.uniforms.uColor as THREE.IUniform<THREE.Color>).value.setHex(spec.beamColor);
    setUniform(beamMat, 'uOpacity', spec.beam);
    moteMat.opacity = spec.motes;

    for (const material of [glassMat, frontMat]) {
      (material.uniforms.uTint as THREE.IUniform<THREE.Color>).value.setHex(spec.glassTint);
      setUniform(material, 'uOpacity', spec.glassOpacity);
      setUniform(material, 'uFresnel', spec.glassFresnel);
      setUniform(material, 'uSheen', spec.glassSheen);
    }

    (crackMat.uniforms.uColor as THREE.IUniform<THREE.Color>).value.setHex(spec.crackColor);
    setUniform(crackMat, 'uGain', spec.crackGain);
    setUniform(crackMat, 'uOpacity', spec.crackOpacity);
    crackMat.blending = spec.crackAdditive ? THREE.AdditiveBlending : THREE.NormalBlending;

    (shardMat.uniforms.uTint as THREE.IUniform<THREE.Color>).value.setHex(spec.shardTint);
    setUniform(shardMat, 'uBody', spec.shardBody);
    setUniform(shardMat, 'uEdge', spec.shardEdge);
    setUniform(shardMat, 'uTwinkle', spec.shardTwinkle);

    haloMat.color.setHex(spec.haloColor);
    haloMat.opacity = spec.halo;
    plinthMat.color.setHex(spec.plinth);
    brassMat.color.setHex(spec.brass);
    brassMat.emissive.setHex(spec.brassEmissive);
    ropeMat.color.setHex(spec.rope);
    shadowMat.opacity = spec.shadow;
    plaqueMat.color.setScalar(spec.plaque);
    ctx.invalidate();
  };

  shards.visible = false;
  setTheme(ctx.theme);
  if (reduced) settle();

  const update = (dt: number, elapsed: number, focus: number): boolean => {
    if (disposed || reduced) return false;
    const distance = Math.abs(focus - stopIndex);
    if (phase === 'waiting' && distance < ARRIVE_WITHIN) startBreaking();
    if (phase === 'breaking') stepBreaking(dt);
    const near = distance < NEAR_WITHIN;
    if (near) stepIdle(elapsed);
    return near || phase === 'breaking';
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const item of disposables) item.dispose();
    disposables.length = 0;
    screenTex?.dispose();
    screenTex = null;
    screenMat.map = null;
    edges.dispose();
    shards.dispose();
    spot.dispose();
  };

  return { group, hotspots, setTheme, update, dispose };
}
