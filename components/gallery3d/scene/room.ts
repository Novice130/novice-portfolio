// The architecture: Grande Galerie corridor, portal, round salon with dome and
// oculus, the doorway to Room 2, benches, fog, background and general lights.
//
// Everything is built once. setTheme only mutates colours, intensities and
// opacities, so it is safe to call at any time.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  CORRIDOR,
  DOOR,
  HANG,
  SALON,
  type Hotspot,
  type ScenePart,
  type SceneCtx,
  type ThemeName,
} from '@/components/gallery3d/contract';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const HW = CORRIDOR.width / 2;
const WALL_H = CORRIDOR.wallHeight;
const VAULT_RISE = CORRIDOR.vaultRise;
const Z0 = CORRIDOR.zStart;
// The corridor stops short of the salon tangent so the portal arch has real
// thickness (0.4m at the crown, more at the jambs where the cylinder recedes).
const PORTAL_Z = CORRIDOR.zEnd + 0.4;
const CORRIDOR_LEN = Z0 - PORTAL_Z;
const CORRIDOR_MID = (Z0 + PORTAL_Z) / 2;

const SCX = SALON.center[0];
const SCZ = SALON.center[2];
const R = SALON.radius;

const DADO_H = 0.9;
const PORTAL = { half: 2.9, spring: 3.6, rise: 2.2 } as const;
const SKY_HALF = 0.95; // half width of the glazed strip at the vault apex
const PILASTER = { width: 0.6, depth: 0.16 } as const;
const RIB = { width: 0.5, depth: 0.16 } as const;
const OCULUS_R = 2.2;
const DECAL = 0.012; // offset of applied trim from the surface behind it

const DOOR_IMAGE = '/gallery/novice-schools.jpg';
const DOOR_SIGN = 'Room 2 — Novice Schools';

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

type ThemeSpec = {
  background: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sun: number;
  sunIntensity: number;
  oculus: number;
  oculusIntensity: number;
  glass: number;
  glassGain: number;
  pool: number;
  poolOpacity: number;
  oculusPoolOpacity: number;
  aoOpacity: number;
  giltEmissive: number;
  doorTint: number;
  doorGlowOpacity: number;
  signTint: number;
};

const THEMES: Record<ThemeName, ThemeSpec> = {
  light: {
    background: 0xefeae0,
    fogDensity: 0.007,
    hemiSky: 0xe9eff8,
    hemiGround: 0xa08c70,
    hemiIntensity: 1.3,
    sun: 0xffe2b8,
    sunIntensity: 2.6,
    oculus: 0xf4f0e8,
    oculusIntensity: 105,
    glass: 0xffffff,
    glassGain: 1.9,
    pool: 0xfff3da,
    poolOpacity: 0.3,
    oculusPoolOpacity: 0.32,
    aoOpacity: 0.7,
    giltEmissive: 0.05,
    doorTint: 0xffffff,
    doorGlowOpacity: 0.12,
    signTint: 0xffffff,
  },
  // After hours, but lit like a museum on a late opening: dim, not blacked out,
  // so frames, pilasters, the vault and the salon stay readable.
  dark: {
    background: 0x100e0c,
    fogDensity: 0.016,
    hemiSky: 0x56607c,
    hemiGround: 0x2a2219,
    hemiIntensity: 0.9,
    sun: 0x9fb0d0,
    sunIntensity: 0.6,
    oculus: 0xc9b08a,
    oculusIntensity: 44,
    glass: 0x16223c,
    glassGain: 1,
    pool: 0x5f7fbf,
    poolOpacity: 0.18,
    oculusPoolOpacity: 0.2,
    aoOpacity: 0.65,
    giltEmissive: 0.06,
    doorTint: 0xcfcfcf,
    doorGlowOpacity: 0.45,
    signTint: 0xd8d0c0,
  },
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

type V3 = readonly [number, number, number];
type V2 = readonly [number, number];
type Quad<T> = readonly [T, T, T, T];

const UV_NONE: Quad<V2> = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
];
const UP: V3 = [0, 1, 0];
const DOWN: V3 = [0, -1, 0];

function isV3(n: V3 | Quad<V3>): n is V3 {
  return typeof n[0] === 'number';
}

/**
 * Accumulates quads into one indexed geometry. Winding is derived from the
 * supplied normals, so callers never have to reason about vertex order.
 */
class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uvs: number[] = [];
  private readonly idx: number[] = [];

  quad(p: Quad<V3>, n: V3 | Quad<V3>, uv: Quad<V2> = UV_NONE): void {
    const normals: Quad<V3> = isV3(n) ? [n, n, n, n] : n;
    const [a, b, c, d] = p;
    // Newell's method: robust face normal even for slightly non-planar quads.
    let fx = 0;
    let fy = 0;
    let fz = 0;
    const edges: readonly (readonly [V3, V3])[] = [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ];
    for (const [s, e] of edges) {
      fx += (s[1] - e[1]) * (s[2] + e[2]);
      fy += (s[2] - e[2]) * (s[0] + e[0]);
      fz += (s[0] - e[0]) * (s[1] + e[1]);
    }
    let facing = 0;
    for (const m of normals) facing += fx * m[0] + fy * m[1] + fz * m[2];

    const base = this.pos.length / 3;
    p.forEach((v) => this.pos.push(v[0], v[1], v[2]));
    normals.forEach((v) => this.nor.push(v[0], v[1], v[2]));
    uv.forEach((v) => this.uvs.push(v[0], v[1]));
    if (facing >= 0) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.idx);
    return g;
  }
}

/** Axis-aligned boxes rendered as one InstancedMesh per material. */
class BoxBatch {
  private readonly boxes: { c: V3; s: V3 }[] = [];

  add(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void {
    this.boxes.push({ c: [cx, cy, cz], s: [sx, sy, sz] });
  }

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
}

function eachSegment<T>(pts: readonly T[], fn: (a: T, b: T) => void): void {
  let prev: T | undefined;
  for (const p of pts) {
    if (prev !== undefined) fn(prev, p);
    prev = p;
  }
}

function vaultY(x: number): number {
  return WALL_H + VAULT_RISE * Math.sqrt(Math.max(0, 1 - (x / HW) ** 2));
}

/** Arc length of the vault ellipse from the springing (t = 0) to t. */
function vaultArc(t: number): number {
  const steps = 48;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const m = (t * (i + 0.5)) / steps;
    sum += Math.hypot(HW * Math.sin(m), VAULT_RISE * Math.cos(m));
  }
  return (sum * t) / steps;
}

/** Point on the salon cylinder. theta = 0 faces the corridor (+Z). */
function cyl(r: number, theta: number, y: number): V3 {
  return [SCX + r * Math.sin(theta), y, SCZ + r * Math.cos(theta)];
}

function cylInward(theta: number): V3 {
  return [-Math.sin(theta), 0, -Math.cos(theta)];
}

/** z of the corridor-facing side of a cylinder of radius r at world x. */
function cylFrontZ(r: number, x: number): number {
  return SCZ + Math.sqrt(Math.max(0, r * r - (x - SCX) ** 2));
}

function cylBand(
  b: MeshBuilder,
  r: number,
  th0: number,
  th1: number,
  y0: number,
  y1: number,
  circleSegs: number,
  uv: (theta: number, y: number) => V2 = () => [0, 0],
): void {
  const segs = Math.max(1, Math.ceil((circleSegs * Math.abs(th1 - th0)) / (Math.PI * 2)));
  for (let i = 0; i < segs; i++) {
    const a = th0 + ((th1 - th0) * i) / segs;
    const c = th0 + ((th1 - th0) * (i + 1)) / segs;
    const na = cylInward(a);
    const nc = cylInward(c);
    b.quad(
      [cyl(r, a, y0), cyl(r, c, y0), cyl(r, c, y1), cyl(r, a, y1)],
      [na, nc, nc, na],
      [uv(a, y0), uv(c, y0), uv(c, y1), uv(a, y1)],
    );
  }
}

/** Horizontal annulus sector. UV v runs 0 at rA to 1 at rB. */
function flatRing(
  b: MeshBuilder,
  y: number,
  rA: number,
  rB: number,
  th0: number,
  th1: number,
  circleSegs: number,
  normal: V3,
): void {
  const segs = Math.max(1, Math.ceil((circleSegs * Math.abs(th1 - th0)) / (Math.PI * 2)));
  for (let i = 0; i < segs; i++) {
    const a = th0 + ((th1 - th0) * i) / segs;
    const c = th0 + ((th1 - th0) * (i + 1)) / segs;
    b.quad([cyl(rA, a, y), cyl(rA, c, y), cyl(rB, c, y), cyl(rB, a, y)], normal, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
  }
}

type ProfilePoint = { x: number; y: number; nx: number; ny: number };

/** Semi-elliptical arch head, left springing to right, with outward normals. */
function archHead(cx: number, half: number, spring: number, rise: number, segs: number): ProfilePoint[] {
  const pts: ProfilePoint[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = Math.PI - (Math.PI * i) / segs;
    const c = i === segs ? 1 : i === 0 ? -1 : Math.cos(t);
    const s = i === 0 || i === segs ? 0 : Math.sin(t);
    const len = Math.hypot(c / half, s / rise);
    pts.push({ x: cx + half * c, y: spring + rise * s, nx: c / half / len, ny: s / rise / len });
  }
  return pts;
}

/** Arch head plus both jambs down to the floor. */
function archProfile(cx: number, half: number, spring: number, rise: number, segs: number): ProfilePoint[] {
  return [
    { x: cx - half, y: 0, nx: -1, ny: 0 },
    ...archHead(cx, half, spring, rise, segs),
    { x: cx + half, y: 0, nx: 1, ny: 0 },
  ];
}

/** Flat moulding that follows an arch profile, offset outward by d0..d1. */
function archBand(
  b: MeshBuilder,
  profile: readonly ProfilePoint[],
  d0: number,
  d1: number,
  zOf: (x: number) => number,
  normal: V3,
): void {
  const at = (p: ProfilePoint, d: number): V3 => {
    const x = p.x + p.nx * d;
    return [x, p.y + p.ny * d, zOf(x)];
  };
  eachSegment(profile, (p, q) => {
    b.quad([at(p, d0), at(q, d0), at(q, d1), at(p, d1)], normal);
  });
}

function archShape(half: number, spring: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-half, 0);
  s.lineTo(-half, spring);
  s.absarc(0, spring, half, Math.PI, 0, true);
  s.lineTo(half, 0);
  s.closePath();
  return s;
}

/** Arched architrave as a single U-shaped outline (no holes to triangulate). */
function surroundShape(half: number, spring: number, border: number): THREE.Shape {
  const o = half + border;
  const s = new THREE.Shape();
  s.moveTo(-o, 0);
  s.lineTo(-o, spring);
  s.absarc(0, spring, o, Math.PI, 0, true);
  s.lineTo(o, 0);
  s.lineTo(half, 0);
  s.lineTo(half, spring);
  s.absarc(0, spring, half, 0, Math.PI, false);
  s.lineTo(-half, 0);
  s.closePath();
  return s;
}

/** z stations of the ribs and pilasters: midway between painting slots. */
function ribStations(): number[] {
  const first = HANG.firstZ + HANG.spacing / 2;
  const k = Math.floor((Z0 - 1.5 - first) / HANG.spacing);
  const zs: number[] = [];
  for (let z = first + k * HANG.spacing; z > CORRIDOR.zEnd + 1.5; z -= HANG.spacing) zs.push(z);
  return zs;
}

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------

type Ctx2D = CanvasRenderingContext2D;
type Rand = () => number;

function rng(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('gallery3d/room: 2D canvas is unavailable');
  return [canvas, g];
}

/** Fine per-pixel grain; random noise is inherently seamless. */
function speckle(g: Ctx2D, w: number, h: number, amount: number, rand: Rand): void {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = (d[i] ?? 0) + n;
    d[i + 1] = (d[i + 1] ?? 0) + n;
    d[i + 2] = (d[i + 2] ?? 0) + n;
  }
  g.putImageData(img, 0, 0);
}

/** Soft blotches, repeated across the edges so the tile wraps. */
function blotches(
  g: Ctx2D,
  w: number,
  h: number,
  count: number,
  rand: Rand,
  colors: readonly string[],
  rMin: number,
  rMax: number,
  wrapY = true,
): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rMin + rand() * (rMax - rMin);
    const color = colors[Math.floor(rand() * colors.length)] ?? '0,0,0';
    for (const ox of [-w, 0, w]) {
      for (const oy of wrapY ? [-h, 0, h] : [0]) {
        const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        grad.addColorStop(0, `rgba(${color},1)`);
        grad.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = grad;
        g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
}

function veins(g: Ctx2D, w: number, h: number, count: number, rand: Rand, style: string, wrap = true): void {
  g.strokeStyle = style;
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const pts: [number, number][] = [];
    let x = rand() * w;
    let y = rand() * h;
    let dir = rand() * Math.PI * 2;
    const step = (w / 30) * (0.6 + rand());
    for (let j = 0; j < 14; j++) {
      pts.push([x, y]);
      dir += (rand() - 0.5) * 1.1;
      x += Math.cos(dir) * step;
      y += Math.sin(dir) * step;
    }
    g.lineWidth = Math.max(0.6, (w / 700) * (0.5 + rand() * 1.6));
    for (const ox of wrap ? [-w, 0, w] : [0]) {
      g.beginPath();
      pts.forEach(([px, py], j) => (j === 0 ? g.moveTo(px + ox, py) : g.lineTo(px + ox, py)));
      g.stroke();
    }
  }
}

/** Point de Hongrie oak: 8 chevron columns of 45-degree planks, tileable. */
function drawParquet(g: Ctx2D, S: number): void {
  const cols = 8;
  const rows = 16;
  const cw = S / cols;
  const pitch = S / rows;
  g.fillStyle = '#7a5e3e';
  g.fillRect(0, 0, S, S);
  for (let c = 0; c < cols; c++) {
    const x0 = c * cw;
    const x1 = x0 + cw;
    const rising = c % 2 === 1;
    for (let k = -3; k < rows + 3; k++) {
      // Seed per wrapped plank so the copy crossing the tile edge is identical.
      const rand = rng(1009 + c * 131 + (((k % rows) + rows) % rows) * 17);
      const ya = k * pitch + (rising ? cw : 0);
      const yb = k * pitch + (rising ? 0 : cw);
      const tone = 0.94 + rand() * 0.12;
      const warm = rand() * 5 - 2.5;
      g.beginPath();
      g.moveTo(x0, ya);
      g.lineTo(x1, yb);
      g.lineTo(x1, yb + pitch);
      g.lineTo(x0, ya + pitch);
      g.closePath();
      g.fillStyle = `rgb(${Math.round(176 * tone + warm)},${Math.round(138 * tone)},${Math.round(94 * tone - warm * 0.5)})`;
      g.fill();
      g.save();
      g.clip();
      for (let j = 0; j < 9; j++) {
        const f = rand() * pitch;
        g.strokeStyle = rand() > 0.5 ? 'rgba(70,50,30,0.07)' : 'rgba(240,225,200,0.06)';
        g.lineWidth = Math.max(1, (S / 1024) * (0.5 + rand() * 1.2));
        g.beginPath();
        g.moveTo(x0, ya + f);
        g.lineTo(x1, yb + f + (rand() - 0.5) * pitch * 0.12);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(52,38,24,0.32)';
      g.lineWidth = Math.max(1.5, S / 700);
      g.stroke();
    }
  }
  speckle(g, S, S, 6, rng(7));
}

/** Neutral plaster; tinted by the material colour. */
function drawPlaster(g: Ctx2D, S: number): void {
  const rand = rng(21);
  g.fillStyle = '#f6f5f2';
  g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.5;
  blotches(g, S, S, 40, rand, ['255,255,255', '236,233,227'], S * 0.1, S * 0.3);
  g.globalAlpha = 1;
  // Faint ashlar joints (tile-aligned so they wrap).
  g.fillStyle = 'rgba(120,108,90,0.05)';
  const courses = 8;
  for (let i = 0; i < courses; i++) g.fillRect(0, (i * S) / courses, S, Math.max(1.5, S / 600));
  speckle(g, S, S, 5, rand);
}

/** Tone-on-tone damask for the salon; tinted red by the material colour. */
function drawDamask(g: Ctx2D, S: number): void {
  const rand = rng(33);
  g.fillStyle = '#efefef';
  g.fillRect(0, 0, S, S);
  

  const motif = (cx: number, cy: number): void => {
    g.save();
    g.translate(cx, cy);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    g.strokeStyle = 'rgba(0,0,0,0.03)';
    g.lineWidth = Math.max(1, S / 400);
    for (let i = 0; i < 8; i++) {
      g.save();
      g.rotate((i * Math.PI) / 4);
      g.beginPath();
      g.ellipse(0, -S * (i % 2 === 0 ? 0.2 : 0.14), S * 0.045, S * (i % 2 === 0 ? 0.13 : 0.08), 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, S * 0.06, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.03)';
    g.fill();
    g.beginPath();
    g.arc(0, 0, S * 0.03, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.fill();
    g.restore();
  };
  for (const [cx, cy] of [
    [0, 0],
    [S, 0],
    [0, S],
    [S, S],
    [S / 2, S / 2],
  ] as const) {
    motif(cx, cy);
  }
  // Ogee lattice linking the motifs.
  g.strokeStyle = 'rgba(0,0,0,0.025)';
  g.lineWidth = Math.max(1, S / 300);
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(S / 2, 0);
    g.quadraticCurveTo(S / 2 + sx * S * 0.42, S * 0.25, S / 2 + (sx * S) / 2, S / 2);
    g.quadraticCurveTo(S / 2 + sx * S * 0.42, S * 0.75, S / 2, S);
    g.stroke();
  }
  speckle(g, S, S, 4, rand);
}

/** Deep oxblood marble dado with its rail and plinth baked in. Tiles horizontally. */
function drawRedMarble(g: Ctx2D, w: number, h: number): void {
  const rand = rng(55);
  g.fillStyle = '#4a1418';
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.35;
  blotches(g, w, h, 40, rand, ['38,10,12', '66,22,24', '56,16,18'], h * 0.08, h * 0.32, false);
  g.globalAlpha = 1;
  veins(g, w, h, 7, rand, 'rgba(200,180,170,0.10)');
  veins(g, w, h, 5, rand, 'rgba(18,4,6,0.16)');

  const rail = h * 0.05;
  const railGrad = g.createLinearGradient(0, 0, 0, rail);
  railGrad.addColorStop(0, 'rgba(210,180,150,0.18)');
  railGrad.addColorStop(0.5, 'rgba(210,180,150,0.05)');
  railGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
  g.fillStyle = railGrad;
  g.fillRect(0, 0, w, rail);
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.fillRect(0, rail, w, h * 0.02);

  const plinth = h * 0.88;
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.fillRect(0, plinth, w, h - plinth);
  g.fillStyle = 'rgba(210,180,150,0.12)';
  g.fillRect(0, plinth, w, Math.max(1.5, h * 0.008));
  speckle(g, w, h, 5, rand);
}

/** One recessed coffer with a gilt rosette. */
function drawCoffer(g: Ctx2D, S: number): void {
  g.fillStyle = '#e9e3d4';
  g.fillRect(0, 0, S, S);
  const edge = S * 0.014;
  const steps: readonly (readonly [number, string])[] = [
    [0.1, '#e0d8c6'],
    [0.17, '#d8cfbb'],
    [0.25, '#d0c6b1'],
  ];
  for (const [inset, tone] of steps) {
    const x = inset * S;
    const w = S - x * 2;
    g.fillStyle = tone;
    g.fillRect(x, x, w, w);
    g.fillStyle = 'rgba(66,48,26,0.2)';
    g.fillRect(x, x, w, edge);
    g.fillRect(x, x, edge, w);
    g.fillStyle = 'rgba(255,250,236,0.4)';
    g.fillRect(x, x + w - edge, w, edge);
    g.fillRect(x + w - edge, x, edge, w);
  }
  g.strokeStyle = '#b9975b';
  g.lineWidth = S * 0.012;
  g.strokeRect(S * 0.055, S * 0.055, S * 0.89, S * 0.89);

  const c = S / 2;
  g.fillStyle = '#b9a070';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.beginPath();
    g.arc(c + Math.cos(a) * S * 0.085, c + Math.sin(a) * S * 0.085, S * 0.042, 0, Math.PI * 2);
    g.fill();
  }
  const gold = g.createRadialGradient(c - S * 0.02, c - S * 0.02, 0, c, c, S * 0.07);
  gold.addColorStop(0, '#e3cb98');
  gold.addColorStop(1, '#a08350');
  g.fillStyle = gold;
  g.beginPath();
  g.arc(c, c, S * 0.062, 0, Math.PI * 2);
  g.fill();
  speckle(g, S, S, 7, rng(77));
}

/** One glazing pane with its bars; repeated along the skylight. */
function drawPane(g: Ctx2D, S: number): void {
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.75);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#e6edf2');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#77736a';
  g.lineWidth = S * 0.09;
  g.strokeRect(0, 0, S, S);
}

/** Daylight falling through one skylight bay: soft across, dimmer at the ribs. */
function drawPoolStrip(g: Ctx2D, w: number, h: number): void {
  const across = g.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  across.addColorStop(0.5, 'rgba(255,255,255,1)');
  across.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = across;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  const along = g.createLinearGradient(0, 0, 0, h);
  along.addColorStop(0, 'rgba(0,0,0,0.3)');
  along.addColorStop(0.22, 'rgba(0,0,0,0.85)');
  along.addColorStop(0.5, 'rgba(0,0,0,1)');
  along.addColorStop(0.78, 'rgba(0,0,0,0.85)');
  along.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = along;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

/** White with an eased alpha ramp: opaque at v = 0, clear at v = 1. */
function drawRamp(g: Ctx2D, w: number, h: number): void {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.1)');
  grad.addColorStop(0.78, 'rgba(255,255,255,0.42)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function drawRadial(g: Ctx2D, S: number): void {
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
}

/** Salon floor: sunburst checker in two marbles, red border, centre medallion. */
function drawSalonFloor(g: Ctx2D, S: number): void {
  const rand = rng(91);
  const c = S / 2;
  const m = S / (2 * R); // pixels per metre
  const TAU = Math.PI * 2;
  const ring = (r0: number, r1: number, a0: number, a1: number, fill: string): void => {
    g.beginPath();
    g.arc(c, c, r1 * m, a0, a1);
    g.arc(c, c, r0 * m, a1, a0, true);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  const circleLine = (r: number, style: string, width: number): void => {
    g.beginPath();
    g.arc(c, c, r * m, 0, TAU);
    g.strokeStyle = style;
    g.lineWidth = width;
    g.stroke();
  };

  g.fillStyle = '#e8e1d2';
  g.fillRect(0, 0, S, S);

  // Restrained two-tone stone: ivory with alternating warm-grey bands.
  const bands = [2.2, 3.5, 5.0, 6.9, 9.1] as const;
  eachSegment(bands, (r0, r1) => {
    if (bands.indexOf(r0) % 2 === 1) ring(r0, r1, 0, TAU, '#c9c1b2');
  });
  const joint = 'rgba(90,76,62,0.18)';
  const hair = Math.max(1.5, S / 900);
  for (const r of bands) circleLine(r, joint, hair);

  ring(9.1, R + 0.2, 0, TAU, '#d6cebf');
  circleLine(9.1, '#3e1214', hair * 2.5);
  circleLine(9.55, 'rgba(62,18,20,0.0)', hair);
  circleLine(8.85, '#b39358', hair);

  // Medallion ring around the 3m clear circle where the plinth stands.
  ring(1.55, 2.2, 0, TAU, '#d6cebf');
  circleLine(2.2, '#3e1214', hair * 2.5);
  circleLine(1.55, '#b39358', hair);
  circleLine(1.875, '#3e1214', hair * 2);

  const star = (points: number, rOuter: number, rInner: number, fill: string, turn: number): void => {
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = turn + (i * Math.PI) / points;
      const r = (i % 2 === 0 ? rOuter : rInner) * m;
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = joint;
    g.lineWidth = hair;
    g.stroke();
  };
  star(16, 1.45, 0.78, '#d3cab8', 0);
  star(8, 1.0, 0.42, '#4a1418', Math.PI / 8);

  g.globalAlpha = 0.07;
  blotches(g, S, S, 50, rand, ['255,255,255', '150,134,116'], S * 0.04, S * 0.16);
  g.globalAlpha = 1;
  veins(g, S, S, 22, rand, 'rgba(110,92,74,0.07)', false);
  veins(g, S, S, 10, rand, 'rgba(255,250,240,0.08)', false);
  speckle(g, S, S, 5, rand);
}

function drawSign(g: Ctx2D, w: number, h: number, text: string): void {
  g.fillStyle = '#1c1713';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b9975b';
  g.lineWidth = h * 0.03;
  g.strokeRect(h * 0.09, h * 0.09, w - h * 0.18, h - h * 0.18);
  g.fillStyle = '#d9bf8c';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = h * 0.44;
  const font = (px: number): string => `600 ${px}px Georgia, 'Times New Roman', serif`;
  g.font = font(size);
  const maxWidth = w * 0.86;
  const measured = g.measureText(text).width;
  if (measured > maxWidth) {
    size *= maxWidth / measured;
    g.font = font(size);
  }
  g.fillText(text, w / 2, h / 2 + size * 0.04);
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

export function createRoom(ctx: SceneCtx): ScenePart {
  const high = ctx.quality === 'high';
  const TEX = high ? 1024 : 512;
  const SEG = {
    circle: high ? 96 : 48,
    arch: high ? 24 : 14,
    vault: high ? 8 : 5,
    rib: high ? 24 : 14,
  };
  const anisotropy = high ? Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy()) : 2;

  const group = new THREE.Group();
  group.name = 'room';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const instanced: THREE.Mesh[] = [];
  let disposed = false;

  const geo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const mat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const canvasTexture = (
    w: number,
    h: number,
    draw: (g: Ctx2D) => void,
    repeat = true,
  ): THREE.CanvasTexture => {
    const [canvas, g] = makeCanvas(w, h);
    draw(g);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    textures.push(t);
    return t;
  };
  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material, renderOrder = 0): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo(g), m);
    mesh.renderOrder = renderOrder;
    group.add(mesh);
    return mesh;
  };

  // --- Textures ------------------------------------------------------------
  const parquetTex = canvasTexture(TEX, TEX, (g) => drawParquet(g, TEX));
  const plasterTex = canvasTexture(TEX, TEX, (g) => drawPlaster(g, TEX));
  const damaskTex = canvasTexture(TEX / 2, TEX / 2, (g) => drawDamask(g, TEX / 2));
  const marbleTex = canvasTexture(TEX, TEX / 2, (g) => drawRedMarble(g, TEX, TEX / 2));
  const cofferTex = canvasTexture(TEX / 2, TEX / 2, (g) => drawCoffer(g, TEX / 2));
  const paneTex = canvasTexture(128, 128, (g) => drawPane(g, 128));
  const poolTex = canvasTexture(64, 256, (g) => drawPoolStrip(g, 64, 256));
  const rampTex = canvasTexture(8, 64, (g) => drawRamp(g, 8, 64), false);
  const radialTex = canvasTexture(256, 256, (g) => drawRadial(g, 256), false);
  const salonFloorTex = canvasTexture(TEX * 2, TEX * 2, (g) => drawSalonFloor(g, TEX * 2), false);
  const signTex = canvasTexture(1024, 192, (g) => drawSign(g, 1024, 192, DOOR_SIGN), false);

  // The dome reuses the coffer image (shared GPU source) at its own repeat.
  const domeTex = cofferTex.clone();
  domeTex.repeat.set(24, 5);
  domeTex.needsUpdate = true;
  textures.push(domeTex);

  // --- Materials -----------------------------------------------------------
  const STONE = 0xefe9dc;
  const floorMat = mat(new THREE.MeshStandardMaterial({ map: parquetTex, roughness: 0.3, metalness: 0 }));
  const wallMat = mat(new THREE.MeshStandardMaterial({ map: plasterTex, color: 0xe0d8c9, roughness: 0.94 }));
  const salonWallMat = mat(new THREE.MeshStandardMaterial({ map: damaskTex, color: 0x751c1f, roughness: 0.93 }));
  const dadoMat = mat(new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.34 }));
  const vaultMat = mat(new THREE.MeshStandardMaterial({ map: cofferTex, color: STONE, roughness: 0.9 }));
  const domeMat = mat(
    new THREE.MeshStandardMaterial({ map: domeTex, color: STONE, roughness: 0.9, side: THREE.BackSide }),
  );
  const stoneMat = mat(new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.8 }));
  const giltMat = mat(
    new THREE.MeshStandardMaterial({
      color: 0xb9975b,
      roughness: 0.38,
      metalness: 0.4,
      emissive: 0x5a4220,
    }),
  );
  const darkMat = mat(new THREE.MeshStandardMaterial({ color: 0x2b1c14, roughness: 0.55 }));
  const salonFloorMat = mat(new THREE.MeshStandardMaterial({ map: salonFloorTex, roughness: 0.3 }));
  const glassMat = mat(new THREE.MeshBasicMaterial({ map: paneTex, toneMapped: false }));

  const decal = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
  const glow = { ...decal, blending: THREE.AdditiveBlending };
  const poolMat = mat(new THREE.MeshBasicMaterial({ ...glow, map: poolTex }));
  const oculusPoolMat = mat(new THREE.MeshBasicMaterial({ ...glow, map: radialTex }));
  const doorGlowMat = mat(new THREE.MeshBasicMaterial({ ...glow, map: radialTex, color: 0xffe2b0 }));
  const aoMat = mat(new THREE.MeshBasicMaterial({ ...decal, map: rampTex, color: 0x000000 }));
  const doorMat = mat(new THREE.MeshBasicMaterial({ color: 0xf2d9a6, toneMapped: false }));
  const signMat = mat(new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }));

  // --- Builders ------------------------------------------------------------
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const salonWallB = new MeshBuilder();
  const dadoB = new MeshBuilder();
  const vaultB = new MeshBuilder();
  const glassB = new MeshBuilder();
  const stoneB = new MeshBuilder();
  const giltB = new MeshBuilder();
  const poolB = new MeshBuilder();
  const aoB = new MeshBuilder();
  const stoneBoxes = new BoxBatch();
  const marbleBoxes = new BoxBatch();
  const giltBoxes = new BoxBatch();
  const darkBoxes = new BoxBatch();

  const PLASTER_TILE = 2.5;
  const PARQUET_TILE = 2.8; // 8 chevron columns of 0.35m; x = 0 lands on a seam
  const DADO_TILE = 1.8;
  const plasterUV = (u: number, y: number): V2 => [u / PLASTER_TILE, y / PLASTER_TILE];
  const AO_UV: Quad<V2> = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];

  // --- Corridor ------------------------------------------------------------
  floorB.quad(
    [
      [-HW, 0, Z0],
      [HW, 0, Z0],
      [HW, 0, PORTAL_Z],
      [-HW, 0, PORTAL_Z],
    ],
    UP,
    [
      [-HW / PARQUET_TILE, Z0 / PARQUET_TILE],
      [HW / PARQUET_TILE, Z0 / PARQUET_TILE],
      [HW / PARQUET_TILE, PORTAL_Z / PARQUET_TILE],
      [-HW / PARQUET_TILE, PORTAL_Z / PARQUET_TILE],
    ],
  );

  for (const side of [-1, 1] as const) {
    const x = side * HW;
    const n: V3 = [-side, 0, 0];
    // The dado is flush with the wall (not proud of it) so large frames that
    // reach below 0.9m never intersect trim.
    wallB.quad(
      [
        [x, DADO_H, Z0],
        [x, DADO_H, PORTAL_Z],
        [x, WALL_H, PORTAL_Z],
        [x, WALL_H, Z0],
      ],
      n,
      [plasterUV(Z0, DADO_H), plasterUV(PORTAL_Z, DADO_H), plasterUV(PORTAL_Z, WALL_H), plasterUV(Z0, WALL_H)],
    );
    dadoB.quad(
      [
        [x, 0, Z0],
        [x, 0, PORTAL_Z],
        [x, DADO_H, PORTAL_Z],
        [x, DADO_H, Z0],
      ],
      n,
      [
        [Z0 / DADO_TILE, 0],
        [PORTAL_Z / DADO_TILE, 0],
        [PORTAL_Z / DADO_TILE, 1],
        [Z0 / DADO_TILE, 1],
      ],
    );

    // Cornice with a gilt fillet beneath it.
    stoneBoxes.add(side * (HW - 0.11), WALL_H - 0.14, CORRIDOR_MID, 0.22, 0.28, CORRIDOR_LEN);
    giltBoxes.add(side * (HW - 0.12), WALL_H - 0.305, CORRIDOR_MID, 0.24, 0.05, CORRIDOR_LEN);
    // Curb of the skylight.
    stoneBoxes.add(side * SKY_HALF, vaultY(SKY_HALF) - 0.05, CORRIDOR_MID, 0.12, 0.14, CORRIDOR_LEN);
    // Skirting board at the foot of the dado, and a picture rail above the frames
    // (tallest frame plus its lamp tops out near 3.85m; capitals start at 4.95m).
    stoneBoxes.add(side * (HW - 0.0125), 0.07, CORRIDOR_MID, 0.025, 0.14, CORRIDOR_LEN);
    giltBoxes.add(side * (HW - 0.015), 4.35, CORRIDOR_MID, 0.03, 0.045, CORRIDOR_LEN);

    // Contact shading: floor against the wall, wall foot, and under the cornice.
    const xin = side * (HW - 0.004);
    aoB.quad(
      [
        [x, 0.004, Z0],
        [x, 0.004, PORTAL_Z],
        [side * (HW - 0.9), 0.004, PORTAL_Z],
        [side * (HW - 0.9), 0.004, Z0],
      ],
      UP,
      AO_UV,
    );
    aoB.quad(
      [
        [xin, 0, Z0],
        [xin, 0, PORTAL_Z],
        [xin, 0.35, PORTAL_Z],
        [xin, 0.35, Z0],
      ],
      n,
      AO_UV,
    );
    aoB.quad(
      [
        [xin, WALL_H - 0.33, Z0],
        [xin, WALL_H - 0.33, PORTAL_Z],
        [xin, WALL_H - 0.95, PORTAL_Z],
        [xin, WALL_H - 0.95, Z0],
      ],
      n,
      AO_UV,
    );
  }
  aoB.quad(
    [
      [-HW, 0.004, Z0],
      [HW, 0.004, Z0],
      [HW, 0.004, Z0 - 0.9],
      [-HW, 0.004, Z0 - 0.9],
    ],
    UP,
    AO_UV,
  );

  // End walls are plain rectangles that overshoot the vault: the overshoot
  // sits outside the vault shell, so no sliver can open along the curve.
  const END_TOP = WALL_H + VAULT_RISE + 0.2;
  const endWall = (x0: number, x1: number, y0: number, y1: number, z: number, n: V3, yb1 = y0): void => {
    wallB.quad(
      [
        [x0, y0, z],
        [x1, yb1, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      n,
      [plasterUV(x0, y0), plasterUV(x1, yb1), plasterUV(x1, y1), plasterUV(x0, y1)],
    );
  };
  const BACK: V3 = [0, 0, -1];
  const FRONT: V3 = [0, 0, 1];
  endWall(-HW, HW, DADO_H, END_TOP, Z0, BACK);
  dadoB.quad(
    [
      [-HW, 0, Z0],
      [HW, 0, Z0],
      [HW, DADO_H, Z0],
      [-HW, DADO_H, Z0],
    ],
    BACK,
    [
      [0, 0],
      [CORRIDOR.width / DADO_TILE, 0],
      [CORRIDOR.width / DADO_TILE, 1],
      [0, 1],
    ],
  );

  // Portal wall: solid cheeks either side, then columns above the arch head.
  const portalHead = archHead(0, PORTAL.half, PORTAL.spring, PORTAL.rise, SEG.arch);
  const portalProfile = archProfile(0, PORTAL.half, PORTAL.spring, PORTAL.rise, SEG.arch);
  endWall(-HW, -PORTAL.half, 0, END_TOP, PORTAL_Z, FRONT);
  endWall(PORTAL.half, HW, 0, END_TOP, PORTAL_Z, FRONT);
  eachSegment(portalHead, (p, q) => endWall(p.x, q.x, p.y, END_TOP, PORTAL_Z, FRONT, q.y));

  // Barrel vault either side of the glazing, coffered by arc length.
  const tSky = Math.acos(SKY_HALF / HW);
  const arcSky = vaultArc(tSky);
  const COFFERS_ACROSS = 3;
  const vaultPoint = (t: number, z: number): V3 => [HW * Math.cos(t), WALL_H + VAULT_RISE * Math.sin(t), z];
  const vaultNormal = (t: number): V3 => {
    const nx = Math.cos(t) / HW;
    const ny = Math.sin(t) / VAULT_RISE;
    const len = Math.hypot(nx, ny);
    return [-nx / len, -ny / len, 0];
  };
  for (const mirror of [false, true]) {
    for (let i = 0; i < SEG.vault; i++) {
      const ta = (tSky * i) / SEG.vault;
      const tb = (tSky * (i + 1)) / SEG.vault;
      const ua = (COFFERS_ACROSS * vaultArc(ta)) / arcSky;
      const ub = (COFFERS_ACROSS * vaultArc(tb)) / arcSky;
      const a = mirror ? Math.PI - ta : ta;
      const b = mirror ? Math.PI - tb : tb;
      const na = vaultNormal(a);
      const nb = vaultNormal(b);
      // v = z: one coffer per metre, so every rib lands on a coffer joint.
      vaultB.quad(
        [vaultPoint(a, Z0), vaultPoint(b, Z0), vaultPoint(b, PORTAL_Z), vaultPoint(a, PORTAL_Z)],
        [na, nb, nb, na],
        [
          [ua, Z0],
          [ub, Z0],
          [ub, PORTAL_Z],
          [ua, PORTAL_Z],
        ],
      );
    }
  }
  const glassSegs = high ? 6 : 4;
  for (let i = 0; i < glassSegs; i++) {
    const ta = tSky + ((Math.PI - 2 * tSky) * i) / glassSegs;
    const tb = tSky + ((Math.PI - 2 * tSky) * (i + 1)) / glassSegs;
    glassB.quad(
      [vaultPoint(ta, Z0), vaultPoint(tb, Z0), vaultPoint(tb, PORTAL_Z), vaultPoint(ta, PORTAL_Z)],
      DOWN,
      [
        [(2 * i) / glassSegs, Z0],
        [(2 * (i + 1)) / glassSegs, Z0],
        [(2 * (i + 1)) / glassSegs, PORTAL_Z],
        [(2 * i) / glassSegs, PORTAL_Z],
      ],
    );
  }

  // Ribs and pilasters, midway between slots so no canvas ever sits on one.
  const stations = ribStations();
  const ribB = new MeshBuilder();
  {
    const hw = RIB.width / 2;
    const inner = (t: number, z: number): V3 => [
      (HW - RIB.depth) * Math.cos(t),
      WALL_H + (VAULT_RISE - RIB.depth) * Math.sin(t),
      z,
    ];
    // Slightly outside the vault shell so the rib is buried, never floating.
    const outer = (t: number, z: number): V3 => [
      (HW + 0.05) * Math.cos(t),
      WALL_H + (VAULT_RISE + 0.05) * Math.sin(t),
      z,
    ];
    for (let i = 0; i < SEG.rib; i++) {
      const ta = (Math.PI * i) / SEG.rib;
      const tb = (Math.PI * (i + 1)) / SEG.rib;
      const na = vaultNormal(ta);
      const nb = vaultNormal(tb);
      ribB.quad([inner(ta, -hw), inner(tb, -hw), inner(tb, hw), inner(ta, hw)], [na, nb, nb, na]);
      ribB.quad([inner(ta, hw), inner(tb, hw), outer(tb, hw), outer(ta, hw)], FRONT);
      ribB.quad([inner(ta, -hw), inner(tb, -hw), outer(tb, -hw), outer(ta, -hw)], BACK);
    }
  }
  const ribs = new THREE.InstancedMesh(geo(ribB.build()), stoneMat, stations.length);
  {
    const m = new THREE.Matrix4();
    stations.forEach((z, i) => ribs.setMatrixAt(i, m.makeTranslation(0, 0, z)));
    ribs.instanceMatrix.needsUpdate = true;
  }
  instanced.push(ribs);
  group.add(ribs);

  const CAPITAL_Y = WALL_H - 0.45;
  for (const z of stations) {
    for (const side of [-1, 1] as const) {
      marbleBoxes.add(side * (HW - 0.1), DADO_H / 2, z, 0.2, DADO_H, PILASTER.width + 0.12);
      stoneBoxes.add(
        side * (HW - PILASTER.depth / 2),
        (DADO_H + CAPITAL_Y) / 2,
        z,
        PILASTER.depth,
        CAPITAL_Y - DADO_H,
        PILASTER.width,
      );
      giltBoxes.add(side * (HW - 0.1), CAPITAL_Y + 0.06, z, 0.2, 0.12, PILASTER.width + 0.1);
    }
  }

  // Daylight pools down the centre line; one texture tile per bay.
  {
    const first = HANG.firstZ + HANG.spacing / 2;
    const v = (z: number): number => (z - first) / HANG.spacing;
    const zA = Z0 - 0.3;
    poolB.quad(
      [
        [-1.9, 0.006, zA],
        [1.9, 0.006, zA],
        [1.9, 0.006, PORTAL_Z],
        [-1.9, 0.006, PORTAL_Z],
      ],
      UP,
      [
        [0, v(zA)],
        [1, v(zA)],
        [1, v(PORTAL_Z)],
        [0, v(PORTAL_Z)],
      ],
    );
  }

  // --- Portal --------------------------------------------------------------
  const salonFaceZ = (x: number): number => cylFrontZ(R - DECAL, x);
  const corridorFaceZ = (): number => PORTAL_Z + DECAL;
  eachSegment(portalProfile, (p, q) => {
    const np: V3 = [-p.nx, -p.ny, 0];
    const nq: V3 = [-q.nx, -q.ny, 0];
    stoneB.quad(
      [
        [p.x, p.y, corridorFaceZ()],
        [q.x, q.y, corridorFaceZ()],
        [q.x, q.y, salonFaceZ(q.x)],
        [p.x, p.y, salonFaceZ(p.x)],
      ],
      [np, nq, nq, np],
    );
  });
  archBand(stoneB, portalProfile, 0, 0.32, corridorFaceZ, FRONT);
  archBand(giltB, portalProfile, 0.32, 0.37, corridorFaceZ, FRONT);
  archBand(stoneB, portalProfile, 0, 0.32, salonFaceZ, BACK);
  archBand(giltB, portalProfile, 0.32, 0.37, salonFaceZ, BACK);
  // Stone threshold covering the parquet / marble join.
  {
    const zBack = CORRIDOR.zEnd - 0.55;
    stoneBoxes.add(0, 0.001, (PORTAL_Z + zBack) / 2, PORTAL.half * 2, 0.014, PORTAL_Z - zBack);
  }

  // --- Salon ---------------------------------------------------------------
  const TAU = Math.PI * 2;
  const thA = Math.asin(PORTAL.half / R);
  const SALON_H = SALON.wallHeight;
  const DAMASK_TILES = 50; // whole number of tiles round the room: no seam
  const damaskTile = (TAU * R) / DAMASK_TILES;
  const damaskUV = (th: number, y: number): V2 => [(th * DAMASK_TILES) / TAU, y / damaskTile];
  const dadoUV = (th: number, y: number): V2 => [(th * R) / DADO_TILE, y / DADO_H];

  cylBand(salonWallB, R, thA, TAU - thA, DADO_H, SALON_H, SEG.circle, damaskUV);
  cylBand(dadoB, R, thA, TAU - thA, 0, DADO_H, SEG.circle, dadoUV);
  // Wall above the portal: columns share the arch samples so the cut is exact.
  eachSegment(portalHead, (p, q) => {
    const a = Math.asin((p.x - SCX) / R);
    const b = Math.asin((q.x - SCX) / R);
    const na = cylInward(a);
    const nb = cylInward(b);
    salonWallB.quad(
      [cyl(R, a, p.y), cyl(R, b, q.y), cyl(R, b, SALON_H), cyl(R, a, SALON_H)],
      [na, nb, nb, na],
      [damaskUV(a, p.y), damaskUV(b, q.y), damaskUV(b, SALON_H), damaskUV(a, SALON_H)],
    );
  });

  // Entablature: stone frieze, its soffit, and gilt fillets.
  const FRIEZE_Y = SALON_H - 0.45;
  cylBand(stoneB, R - 0.15, 0, TAU, FRIEZE_Y, SALON_H, SEG.circle);
  flatRing(stoneB, FRIEZE_Y, R - 0.15, R, 0, TAU, SEG.circle, DOWN);
  cylBand(giltB, R - 0.15 - DECAL, 0, TAU, FRIEZE_Y + 0.05, FRIEZE_Y + 0.13, SEG.circle);
  cylBand(giltB, R - 0.006, thA, TAU - thA, DADO_H, DADO_H + 0.04, SEG.circle);

  flatRing(aoB, 0.004, R, R - 1.3, thA, TAU - thA, SEG.circle, UP);
  cylBand(aoB, R - 0.005, thA, TAU - thA, 0, 0.8, SEG.circle, (_th, y) => [0, y / 0.8]);
  cylBand(aoB, R - 0.005, 0, TAU, FRIEZE_Y, FRIEZE_Y - 0.95, SEG.circle, (_th, y) => [0, (FRIEZE_Y - y) / 0.95]);

  const salonFloor = addMesh(new THREE.CircleGeometry(R, SEG.circle).rotateX(-Math.PI / 2), salonFloorMat);
  salonFloor.position.set(SCX, 0, SCZ);

  // Dome: a squashed sphere cap that stops at the oculus.
  const oculusTheta = Math.asin(OCULUS_R / R);
  const oculusY = SALON_H + SALON.domeRise * Math.cos(oculusTheta);
  const dome = addMesh(
    new THREE.SphereGeometry(
      R,
      SEG.circle,
      high ? 20 : 12,
      0,
      TAU,
      oculusTheta,
      Math.PI / 2 - oculusTheta,
    ).scale(1, SALON.domeRise / R, 1),
    domeMat,
  );
  dome.position.set(SCX, SALON_H, SCZ);

  const oculusGeo = new THREE.CircleGeometry(OCULUS_R, 40).rotateX(Math.PI / 2);
  {
    // Three panes across, using the skylight pane texture.
    const uv = oculusGeo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
  }
  addMesh(oculusGeo, glassMat).position.set(SCX, oculusY, SCZ);
  addMesh(new THREE.TorusGeometry(OCULUS_R, 0.1, 8, 48).rotateX(Math.PI / 2), giltMat).position.set(
    SCX,
    oculusY - 0.03,
    SCZ,
  );

  const oculusPool = addMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), oculusPoolMat, 1);
  oculusPool.position.set(SCX, 0.006, SCZ);

  // Benches against the side walls, clear of the door and the corridor mouth.
  for (const side of [-1, 1] as const) {
    const x = SCX + side * (R - 0.62);
    darkBoxes.add(x, 0.46, SCZ, 0.6, 0.12, 2.2);
    darkBoxes.add(x, 0.2, SCZ - 0.8, 0.5, 0.4, 0.14);
    darkBoxes.add(x, 0.2, SCZ + 0.8, 0.5, 0.4, 0.14);
  }

  // --- Doorway to Room 2 ---------------------------------------------------
  const [doorX, , doorZ] = DOOR.position;
  const doorHalf = DOOR.width / 2;
  const doorSpring = DOOR.height - doorHalf;
  const BORDER = 0.35;
  // How far the curved wall bulges toward the room at a given half-width.
  const bulge = (halfWidth: number): number => R - Math.sqrt(R * R - halfWidth * halfWidth);
  const imageZ = doorZ + bulge(doorHalf) + 0.03;
  const surroundFrontZ = imageZ + 0.3;

  const surroundBackZ = doorZ - 0.05;
  addMesh(
    new THREE.ExtrudeGeometry(surroundShape(doorHalf, doorSpring, BORDER), {
      depth: surroundFrontZ - surroundBackZ,
      bevelEnabled: false,
      curveSegments: SEG.arch,
    }).translate(doorX, 0, surroundBackZ),
    stoneMat,
  );
  archBand(
    giltB,
    archProfile(doorX, doorHalf, doorSpring, doorHalf, SEG.arch),
    0.04,
    0.1,
    () => surroundFrontZ + 0.006,
    FRONT,
  );

  const doorGeo = new THREE.ShapeGeometry(archShape(doorHalf, doorSpring), SEG.arch);
  {
    // ShapeGeometry UVs are raw shape coordinates; normalise to the door box.
    const pos = doorGeo.getAttribute('position');
    const uv = doorGeo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + doorHalf) / DOOR.width, pos.getY(i) / DOOR.height);
    }
  }
  const doorMesh = addMesh(doorGeo.translate(doorX, 0, imageZ), doorMat);
  doorMesh.name = 'door';

  const signY = DOOR.height + BORDER + 0.42;
  const signFrontZ = doorZ + bulge(1.15) + 0.14;
  darkBoxes.add(doorX, signY, signFrontZ - 0.12, 2.3, 0.44, 0.24);
  addMesh(new THREE.PlaneGeometry(2.3, 0.44), signMat).position.set(doorX, signY, signFrontZ + 0.006);

  const doorGlow = addMesh(new THREE.PlaneGeometry(5.5, 5.5).rotateX(-Math.PI / 2), doorGlowMat, 1);
  doorGlow.position.set(doorX, 0.007, doorZ + 1);

  let doorTexture: THREE.Texture | null = null;
  let themeName: ThemeName = ctx.theme;
  new THREE.TextureLoader().load(
    DOOR_IMAGE,
    (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      const img = tex.image as { width: number; height: number };
      const imageAspect = img.width / img.height;
      const doorAspect = DOOR.width / DOOR.height;
      // Cover-crop: fill the arch, trimming whichever axis overflows.
      if (imageAspect > doorAspect) tex.repeat.set(doorAspect / imageAspect, 1);
      else tex.repeat.set(1, imageAspect / doorAspect);
      tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = anisotropy;
      doorTexture = tex;
      doorMat.map = tex;
      doorMat.color.setHex(THEMES[themeName].doorTint);
      doorMat.needsUpdate = true;
      ctx.invalidate();
    },
    undefined,
    () => {
      // Keep the warm placeholder glow if the image cannot be fetched.
    },
  );

  // --- Scanned materials ---------------------------------------------------
  // Real sizes of the scans (m): parquet 3.4, marble 1.5, plaster 1.0, velvet 0.28.
  const lib = ctx.materials;
  lib.apply(floorMat, 'parquet', { repeat: [PARQUET_TILE / 3.4, PARQUET_TILE / 3.4], roughness: 0.7 });
  // The scan's colour is a dirty grey; the wall keeps its own paint and takes only relief and sheen.
  lib.apply(wallMat, 'plaster', { repeat: [PLASTER_TILE, PLASTER_TILE], keepMap: true, normalScale: 0.6 });
  lib.apply(dadoMat, 'marble', { repeat: [DADO_TILE / 1.5, DADO_H / 1.5], color: 0x6e2c2a, roughness: 0.55 });
  // Painted patterns stay as the colour; the scan supplies relief and sheen.
  lib.apply(salonWallMat, 'velvet', { repeat: [damaskTile / 0.28, damaskTile / 0.28], keepMap: true, normalScale: 0.5 });
  lib.apply(salonFloorMat, 'marble', { repeat: [(2 * R) / 1.5, (2 * R) / 1.5], keepMap: true, roughness: 0.45 });
  lib.apply(vaultMat, 'plaster', { repeat: [1, 1], keepMap: true, normalScale: 0.5 });
  lib.apply(domeMat, 'plaster', { repeat: [24, 5], keepMap: true, normalScale: 0.5 });

  // --- Reflections ---------------------------------------------------------
  // Rough surfaces take the map too: it is also their bounce light.
  if (ctx.env) {
    for (const m of [floorMat, wallMat, dadoMat, vaultMat, stoneMat, darkMat]) ctx.env.register(m, 'corridor');
    for (const m of [salonWallMat, domeMat, salonFloorMat]) ctx.env.register(m, 'salon');
    ctx.env.register(giltMat, 'corridor', { metalness: 1, roughness: 0.32 });
  }

  // --- Assemble ------------------------------------------------------------
  addMesh(floorB.build(), floorMat);
  addMesh(wallB.build(), wallMat);
  addMesh(salonWallB.build(), salonWallMat);
  addMesh(dadoB.build(), dadoMat);
  addMesh(vaultB.build(), vaultMat);
  addMesh(glassB.build(), glassMat);
  addMesh(stoneB.build(), stoneMat);
  addMesh(giltB.build(), giltMat);
  addMesh(poolB.build(), poolMat, 1);
  addMesh(aoB.build(), aoMat, 1).visible = !high;

  const unitBox = geo(new THREE.BoxGeometry(1, 1, 1));
  for (const [batch, material] of [
    [stoneBoxes, stoneMat],
    [marbleBoxes, dadoMat],
    [giltBoxes, giltMat],
    [darkBoxes, darkMat],
  ] as const) {
    const mesh = batch.build(unitBox, material, high ? 0.012 : 0);
    if (mesh.geometry !== unitBox) geometries.push(mesh.geometry);
    instanced.push(mesh);
    group.add(mesh);
  }

  // --- Lights, fog, background ---------------------------------------------
  const hemi = new THREE.HemisphereLight();
  // Low and from ahead, so the parquet catches a soft sheen in front of the visitor.
  const sun = new THREE.DirectionalLight();
  sun.position.set(0, 8, -9);
  const oculusLight = new THREE.PointLight(0xffffff, 1, 24, 2);
  oculusLight.position.set(SCX, SALON_H + 2.5, SCZ);
  group.add(hemi, sun, oculusLight);
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

  const background = new THREE.Color();
  // One FogExp2 for both themes: swapping fog types would recompile every shader.
  const fog = new THREE.FogExp2(0x000000, 0.01);
  ctx.scene.background = background;
  ctx.scene.fog = fog;

  const setTheme = (theme: ThemeName): void => {
    themeName = theme;
    const t = THEMES[theme];
    background.setHex(t.background);
    fog.color.setHex(t.background);
    fog.density = t.fogDensity;
    hemi.color.setHex(t.hemiSky);
    hemi.groundColor.setHex(t.hemiGround);
    hemi.intensity = t.hemiIntensity;
    sun.color.setHex(t.sun);
    sun.intensity = t.sunIntensity;
    oculusLight.color.setHex(t.oculus);
    oculusLight.intensity = t.oculusIntensity;
    // Above 1 on the high tier so the skylight feeds the bloom pass.
    glassMat.color.setHex(t.glass).multiplyScalar(high ? t.glassGain : 1);
    poolMat.color.setHex(t.pool);
    poolMat.opacity = t.poolOpacity;
    oculusPoolMat.color.setHex(t.pool);
    oculusPoolMat.opacity = t.oculusPoolOpacity;
    aoMat.opacity = t.aoOpacity;
    giltMat.emissiveIntensity = t.giltEmissive;
    if (doorTexture) doorMat.color.setHex(t.doorTint);
    doorGlowMat.opacity = t.doorGlowOpacity;
    signMat.color.setHex(t.signTint);
  };
  setTheme(ctx.theme);

  const hotspots: Hotspot[] = [{ object: doorMesh, stopId: 'door' }];

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (ctx.scene.fog === fog) ctx.scene.fog = null;
    if (ctx.scene.background === background) ctx.scene.background = null;
    group.removeFromParent();
    group.clear();
    instanced.forEach((m) => (m as THREE.InstancedMesh).isInstancedMesh && (m as THREE.InstancedMesh).dispose());
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    doorTexture?.dispose();
    doorTexture = null;
  };

  return { group, hotspots, setTheme, dispose };
}
