// The nine works hung along the Grande Galerie: canvases, mats, mouldings,
// cartels, contact shadows and (after hours) their picture lights.
//
// No real lights live here. By day the frames catch the room's lighting and
// the canvases are unlit so screenshots stay true to colour. By night every
// pool of light is faked: a falloff baked into the canvas shader, an emissive
// lambert term injected into the frame materials, and additive gradient planes
// on the wall, in the air and on the floor.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  HANG,
  pieceSlot,
  type Hotspot,
  type ScenePart,
  type SceneCtx,
  type ThemeName,
} from '@/components/gallery3d/contract';
import { pieces, type FrameStyle, type Piece } from '@/data/gallery';

// ── Tunables ────────────────────────────────────────────────────────────────

const DEFAULT_ASPECT = 0.74; // most works are tall portrait screenshots
const MAT = 0.045; // passe-partout width
const CANVAS_Z = 0.02;
const LABEL_W = 0.5;
const LABEL_H = 0.267;
const LABEL_Y = 1.25; // world height of the cartel centre
const LABEL_GAP = 0.1;
// Pilasters stand 2m either side of a work and are 0.6m wide; keep the cartel clear of them.
const LABEL_MAX_X = 1.66 - LABEL_W / 2;
const LABEL_PX: readonly [number, number] = [510, 272]; // logical px, same ratio as the plaque
const TEX_PER_METRE = 4; // moulding ornament repeats every 25cm

const REVEAL_SECONDS = 0.6;
const RESIZE_SECONDS = 0.5;
const FOCUS_RATE = 4.5;
const MAX_STEP = 0.05;
const CONCURRENT_LOADS = 2;

/** The hardware stays on the wall by day; only its light goes out. */
const FIXTURE_IN_LIGHT = true;

const NIGHT = {
  wall: 0.42,
  floor: 0.14,
  frame: 1.5,
  // Fog is only partly applied at night so the far picture lights still read
  // as a receding row instead of dissolving into the gloom.
  fog: 0.4,
  farLevel: 0.85,
} as const;

/** Picture lights stay on by day, just far less visible. */
const DAY = { wall: 0.05, frame: 0.12 } as const;

const SERIF = 'Georgia, "Times New Roman", Times, serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

// ── Moulding profiles ───────────────────────────────────────────────────────
// [distance outward from the inner edge, height off the wall], inner → outer.

type Profile = { pts: readonly (readonly [number, number])[]; width: number; depth: number; gain: number };

const PROFILES: Record<FrameStyle, Profile> = {
  gilt: {
    pts: [
      [0, 0.016],
      [0, 0.05],
      [0.012, 0.057],
      [0.028, 0.05],
      [0.048, 0.04],
      [0.07, 0.045],
      [0.092, 0.061],
      [0.112, 0.077],
      [0.126, 0.08],
      [0.14, 0.07],
      [0.14, 0],
    ],
    width: 0.14,
    depth: 0.08,
    gain: 1,
  },
  walnut: {
    pts: [
      [0, 0.016],
      [0, 0.045],
      [0.015, 0.051],
      [0.04, 0.058],
      [0.08, 0.065],
      [0.1, 0.062],
      [0.11, 0.052],
      [0.11, 0],
    ],
    width: 0.11,
    depth: 0.065,
    gain: 1.5, // dark timber needs more of the fake light to stay readable
  },
  brass: {
    pts: [
      [0, 0.016],
      [0, 0.05],
      [0.006, 0.055],
      [0.054, 0.055],
      [0.06, 0.05],
      [0.06, 0],
    ],
    width: 0.06,
    depth: 0.055,
    gain: 0.9,
  },
};

// Outward direction and tangent of each bar; o × t = +z for all four, so one
// winding rule serves every side.
const SIDES: readonly { o: readonly [number, number]; t: readonly [number, number] }[] = [
  { o: [1, 0], t: [0, 1] },
  { o: [0, 1], t: [-1, 0] },
  { o: [-1, 0], t: [0, -1] },
  { o: [0, -1], t: [1, 0] },
];

type Sweep = { geometry: THREE.BufferGeometry; write: (hx: number, hy: number) => void };

/**
 * A mitred frame: the profile swept round a rectangle. Vertex count and
 * normals never change, so resizing only rewrites positions and uvs in place.
 */
function createSweep(profile: Profile): Sweep {
  const pts = profile.pts;
  const segs = pts.length - 1;
  const count = SIDES.length * segs * 6;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);

  const segN: [number, number][] = [];
  const arc: number[] = [0];
  for (let j = 0; j < segs; j++) {
    const dd = pts[j + 1][0] - pts[j][0];
    const dz = pts[j + 1][1] - pts[j][1];
    const len = Math.hypot(dd, dz) || 1;
    segN.push([-dz / len, dd / len]);
    arc.push(arc[j] + len);
  }
  const total = arc[segs] || 1;

  // Smooth across gentle bends, keep hard arrises where the profile turns.
  const blend = (a: [number, number], b: [number, number] | undefined): [number, number] => {
    if (!b || a[0] * b[0] + a[1] * b[1] < 0.76) return a;
    const x = a[0] + b[0];
    const y = a[1] + b[1];
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const startN = segN.map((n, j) => blend(n, segN[j - 1]));
  const endN = segN.map((n, j) => blend(n, segN[j + 1]));

  let n = 0;
  for (const side of SIDES) {
    for (let j = 0; j < segs; j++) {
      // Vertex order per quad: A0, A1, B1, A0, B1, B0 → profile index offsets.
      for (const k of [0, 1, 1, 0, 1, 0]) {
        const pn = k === 0 ? startN[j] : endN[j];
        normal[n++] = side.o[0] * pn[0];
        normal[n++] = side.o[1] * pn[0];
        normal[n++] = pn[1];
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(position, 3);
  const uvAttr = new THREE.BufferAttribute(uv, 2);
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', uvAttr);

  const ENDS = [-1, -1, 1, -1, 1, 1] as const;
  const STEP = [0, 1, 1, 0, 1, 0] as const;

  const write = (hx: number, hy: number) => {
    let p = 0;
    let q = 0;
    for (const side of SIDES) {
      const across = side.o[0] !== 0 ? hx : hy;
      const along = side.o[0] !== 0 ? hy : hx;
      for (let j = 0; j < segs; j++) {
        for (let v = 0; v < 6; v++) {
          const idx = j + STEP[v];
          const d = pts[idx][0];
          const run = ENDS[v] * (along + d); // the mitre: bars lengthen with d
          position[p++] = side.o[0] * (across + d) + side.t[0] * run;
          position[p++] = side.o[1] * (across + d) + side.t[1] * run;
          position[p++] = pts[idx][1];
          uv[q++] = run * TEX_PER_METRE;
          uv[q++] = arc[idx] / total;
        }
      }
    }
    posAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    geometry.computeBoundingSphere();
  };

  return { geometry, write };
}

// ── Shaders ─────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FOG_GLSL = /* glsl */ `
#include <fog_pars_fragment>
uniform float uFog;
float fogMix() {
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float f = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float f = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    return clamp(f * uFog, 0.0, 1.0);
  #else
    return 0.0;
  #endif
}`;

// Image + passe-partout in one quad: no second mesh, nothing to z-fight.
const CANVAS_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 uPlane;   // metres, image + mat
uniform vec2 uImage;   // metres, image only
uniform vec3 uPrimed;
uniform vec3 uMat;
uniform vec3 uWarm;
uniform float uReveal;
uniform float uDesat;
uniform float uDark;
uniform float uLevel;
uniform float uDay;
varying vec2 vUv;
${FOG_GLSL}
void main() {
  vec2 p = (vUv - 0.5) * uPlane;
  vec2 edge = abs(p) - uImage * 0.5;
  float outside = max(edge.x, edge.y);
  float inMat = smoothstep(-1.0, 1.0, outside / max(fwidth(outside), 1e-5));

  vec3 img = texture2D(map, p / uImage + 0.5, -0.6).rgb;
  img = mix(uPrimed, img, uReveal);
  float luma = dot(img, vec3(0.2126, 0.7152, 0.0722));
  img = mix(img, vec3(luma), uDesat * 0.15) * (1.0 - 0.03 * uDesat);
  // The mat sits proud of the sheet and shades its top edge.
  img *= 1.0 - 0.2 * step(0.0, p.y) * exp(edge.y / 0.006);

  // Bevel cut showing the board's white core, then the frame lip's shadow.
  vec3 board = mix(vec3(1.0, 0.99, 0.96), uMat, smoothstep(0.003, 0.007, outside));
  float lipTop = uPlane.y * 0.5 - p.y;
  float lipSide = uPlane.x * 0.5 - abs(p.x);
  board *= (1.0 - 0.24 * exp(-lipTop / 0.014)) * (1.0 - 0.1 * exp(-lipSide / 0.01));

  vec3 col = mix(img, board, inMat);

  // Picture light: a warm pool strongest at the top rail, easing down the sheet.
  // No vignette and no haze: the screenshot keeps its full contrast.
  float t = clamp((p.y / uPlane.y) + 0.5, 0.0, 1.0);
  float lamp = smoothstep(0.0, 1.0, t);
  vec3 tint = mix(vec3(1.0), uWarm, 0.3);
  vec3 night = tint * mix(0.92, 1.1, lamp) * uLevel;
  vec3 day = vec3(uDay * mix(0.98, 1.03, lamp));
  col *= mix(day, night, uDark);

  #ifdef USE_FOG
    col = mix(col, fogColor, fogMix());
  #endif
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

type FxKind = 'shadow' | 'wall' | 'floor';

const FX_BODY: Record<FxKind, string> = {
  // Soft rounded-box falloff, dropped a little because daylight comes from above.
  shadow: /* glsl */ `
    vec2 q = abs(p - vec2(0.0, -0.05)) - uHalf;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    a = 1.0 - smoothstep(-0.02, 0.3, d);
    a *= a;`,
  // Soft elliptical scallop centred above the top rail. It is zero well inside
  // the plane, so no rectangle edge can show.
  wall: /* glsl */ `
    vec2 g = vec2(p.x / (uPlane.x * 0.5), (p.y - uHalf.y * 0.45) / (uPlane.y * 0.5));
    float s = smoothstep(0.0, 0.9, length(g));
    a = (1.0 - s) * (1.0 - s);
    a *= 0.55 + 0.45 * smoothstep(-uHalf.y, uHalf.y + 0.3, p.y);`,
  floor: /* glsl */ `
    float x = (vUv.x - 0.5) * 2.0;
    float d = 1.0 - vUv.y;
    float z = (d - 0.3) / 0.36;
    a = exp(-x * x * 2.8) * exp(-z * z);
    vec2 e = smoothstep(vec2(1.0), vec2(0.7), abs(vUv - 0.5) * 2.0);
    a *= e.x * e.y;`,
};

function fxFragment(kind: FxKind): string {
  const out =
    kind === 'shadow'
      ? 'gl_FragColor = vec4(uColor, clamp(a * k, 0.0, 1.0));'
      : 'gl_FragColor = vec4(uColor * (a * k), 1.0);';
  return /* glsl */ `
uniform vec2 uPlane;
uniform vec2 uHalf;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTop;
varying vec2 vUv;
${FOG_GLSL}
void main() {
  vec2 p = (vUv - 0.5) * uPlane;
  float a = 0.0;
  ${FX_BODY[kind]}
  float k = uIntensity * (1.0 - fogMix());
  ${out}
  #include <colorspace_fragment>
  // Half an 8-bit step of noise: wide dark gradients band badly otherwise.
  float dn = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  ${kind === 'shadow' ? 'gl_FragColor.a' : 'gl_FragColor.rgb'} += dn * step(0.002, a);
}`;
}

type Uniforms = { [name: string]: THREE.IUniform };

function makeCanvasMaterial(restoration: boolean): THREE.ShaderMaterial {
  const uniforms: Uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      map: { value: null },
      uPlane: { value: new THREE.Vector2(1, 1) },
      uImage: { value: new THREE.Vector2(1, 1) },
      uPrimed: { value: new THREE.Color(0xddd6c6) },
      uMat: { value: new THREE.Color(0xefe8d8) },
      uWarm: { value: new THREE.Color().setRGB(1, 0.9, 0.74) },
      uReveal: { value: 0 },
      uDesat: { value: restoration ? 1 : 0 },
      uDark: { value: 0 },
      uLevel: { value: 1 },
      uDay: { value: 1 },
      uFog: { value: 1 },
    },
  ]);
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: CANVAS_FRAG,
    fog: true,
    toneMapped: false,
  });
}

function makeFxMaterial(kind: FxKind, color: THREE.Color): THREE.ShaderMaterial {
  const uniforms: Uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uPlane: { value: new THREE.Vector2(1, 1) },
      uHalf: { value: new THREE.Vector2(1, 1) },
      uColor: { value: color.clone() },
      uIntensity: { value: 0 },
      uTop: { value: 0.4 },
      uFog: { value: 1 },
    },
  ]);
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: fxFragment(kind),
    fog: true,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: kind === 'shadow' ? THREE.NormalBlending : THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

type FrameUniforms = { uPicLight: THREE.IUniform<THREE.Color>; uPicHalfH: THREE.IUniform<number> };

/**
 * Standard material plus a fake picture light: a per-vertex lambert from a
 * lamp above and in front, added as emissive. Zero by day. One material per
 * painting (so each can dim on its own) but all share one program per style.
 */
function makeFrameMaterial(
  params: THREE.MeshStandardMaterialParameters,
  uniforms: FrameUniforms,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial(params);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPicLight = uniforms.uPicLight;
    shader.uniforms.uPicHalfH = uniforms.uPicHalfH;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPicHalfH;\nvarying float vPicLit;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vPicLit = (0.22 + 0.78 * max(dot(normalize(objectNormal), vec3(0.0, 0.78, 0.62)), 0.0))
          * mix(0.3, 1.0, clamp(position.y / (2.0 * uPicHalfH) + 0.5, 0.0, 1.0));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uPicLight;\nvarying float vPicLit;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uPicLight * vPicLit;',
      );
  };
  return material;
}

// ── Procedural textures ─────────────────────────────────────────────────────

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return [canvas, canvas.getContext('2d')];
}

// Deterministic so the mouldings look the same on every visit.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mouldingTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Height field doubling as antiquing: beads on the sight edge, a leaf run on the cove. */
function giltTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const [canvas, g] = makeCanvas(W, H);
  if (g) {
    const rnd = seeded(7);
    const y = (v: number) => H * (1 - v); // v = 0 is the inner edge
    g.fillStyle = 'rgb(176,176,176)';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const c = 150 + Math.floor(rnd() * 80);
      g.fillStyle = `rgba(${c},${c},${c},0.5)`;
      g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    g.fillStyle = 'rgba(96,96,96,0.9)';
    g.fillRect(0, y(0.3), W, 3);
    g.fillRect(0, y(0.9), W, 3);
    for (let x = 8; x < W; x += 16) {
      const grad = g.createRadialGradient(x - 1, y(0.17) - 1, 0.5, x, y(0.17), 7);
      grad.addColorStop(0, 'rgb(255,255,255)');
      grad.addColorStop(0.7, 'rgb(190,190,190)');
      grad.addColorStop(1, 'rgba(110,110,110,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y(0.17), 7, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 8; i++) {
      const x = 16 + i * 32;
      g.save();
      g.translate(x, y(0.6));
      g.rotate(i % 2 === 0 ? -0.6 : 0.6);
      const grad = g.createRadialGradient(0, -2, 1, 0, 0, 17);
      grad.addColorStop(0, 'rgb(255,255,255)');
      grad.addColorStop(0.75, 'rgb(205,205,205)');
      grad.addColorStop(1, 'rgba(120,120,120,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, 0, 17, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(105,105,105,0.75)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-14, 0);
      g.lineTo(14, 0);
      g.stroke();
      g.restore();
    }
  }
  return mouldingTexture(canvas, false);
}

/** Full-width streaks, so the texture tiles along the bar for free. */
function grainTexture(base: string, lo: number, hi: number, streaks: number, srgb: boolean, seed: number): THREE.CanvasTexture {
  const W = 256;
  const H = 64;
  const [canvas, g] = makeCanvas(W, H);
  if (g) {
    const rnd = seeded(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < streaks; i++) {
      const dark = rnd() < 0.6;
      const a = lo + rnd() * (hi - lo);
      g.fillStyle = dark ? `rgba(0,0,0,${a})` : `rgba(255,236,205,${a * 0.6})`;
      g.fillRect(0, rnd() * H, W, 0.5 + rnd() * 1.6);
    }
  }
  return mouldingTexture(canvas, srgb);
}

function spacedText(g: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number): number {
  let cx = x;
  for (const ch of text) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + tracking;
  }
  return cx;
}

/** Largest size ≤ `size` at which `text` fits `maxWidth`; leaves the font set. */
function fitFont(
  g: CanvasRenderingContext2D,
  text: string,
  font: (px: number) => string,
  size: number,
  min: number,
  maxWidth: number,
): void {
  let px = size;
  g.font = font(px);
  while (px > min && g.measureText(text).width > maxWidth) {
    px -= 1;
    g.font = font(px);
  }
}

function drawLabel(piece: Piece, scale: number): HTMLCanvasElement {
  const [W, H] = LABEL_PX;
  const [canvas, g] = makeCanvas(W * scale, H * scale);
  if (!g) return canvas;
  g.scale(scale, scale);
  g.textBaseline = 'alphabetic';

  g.fillStyle = '#f1ebdd';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#c3b79d';
  g.lineWidth = 1.5;
  g.strokeRect(9, 9, W - 18, H - 18);

  const x = 36;
  const maxWidth = W - x * 2;

  g.fillStyle = '#8a7a5c';
  g.font = `600 17px ${MONO}`;
  spacedText(g, piece.no.toUpperCase(), x, 58, 3.5);

  g.fillStyle = '#1d1a16';
  fitFont(g, piece.title, (px) => `500 ${px}px ${SERIF}`, 48, 26, maxWidth);
  g.fillText(piece.title, x, 118);

  g.fillStyle = '#b08d4c';
  g.fillRect(x, 140, 44, 2);

  const meta = piece.year ? `${piece.year} · ${piece.medium}` : piece.medium;
  g.fillStyle = '#4f483d';
  fitFont(g, meta, (px) => `italic 400 ${px}px ${SERIF}`, 21, 13, maxWidth);
  g.fillText(meta, x, 182);

  const live = piece.status === 'live';
  g.beginPath();
  g.arc(x + 7, 222, 6, 0, Math.PI * 2);
  if (live) {
    g.fillStyle = '#2f7d4f';
    g.fill();
  } else {
    g.strokeStyle = '#a8742a';
    g.lineWidth = 2;
    g.stroke();
  }
  g.fillStyle = live ? '#2f5f43' : '#8a6226';
  g.font = `600 17px ${MONO}`;
  spacedText(g, live ? 'Live' : 'Under restoration', x + 24, 228, 0.6);
  return canvas;
}

function drawTag(scale: number): HTMLCanvasElement {
  const W = 200;
  const H = 84;
  const [canvas, g] = makeCanvas(W * scale, H * scale);
  if (!g) return canvas;
  g.scale(scale, scale);
  g.fillStyle = '#ece3cf';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#9c8a66';
  g.lineWidth = 2;
  g.strokeRect(5, 5, W - 10, H - 10);
  g.beginPath();
  g.arc(20, H / 2, 5, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#5c4a2a';
  g.textBaseline = 'alphabetic';
  g.font = `700 15px ${MONO}`;
  spacedText(g, 'UNDER', 38, 37, 3);
  spacedText(g, 'RESTORATION', 38, 60, 1.6);
  return canvas;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fitSize(aspect: number): [number, number] {
  const w = Math.min(HANG.maxWidth, HANG.maxHeight * aspect);
  return [w, w / aspect];
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function nearness(distance: number): number {
  const t = Math.min(Math.max((Math.abs(distance) - 0.2) / 1.4, 0), 1);
  return 1 - t * t * (3 - 2 * t);
}

type Painting = {
  piece: Piece;
  index: number;
  profile: Profile;
  root: THREE.Group;
  hung: THREE.Group;
  canvas: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  sweep: Sweep;
  frameUniforms: FrameUniforms;
  hit: THREE.Mesh;
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  wall: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  fixture: THREE.Group;
  tag: THREE.Mesh | null;
  floorY: number;
  size: [number, number];
  from: [number, number];
  to: [number, number];
  sizeT: number;
  reveal: number;
  loaded: boolean;
  near: number;
};

// ── Module ──────────────────────────────────────────────────────────────────

export function createArtworks(ctx: SceneCtx): ScenePart {
  const group = new THREE.Group();
  group.name = 'artworks';

  const high = ctx.quality === 'high';
  const maxAniso = Math.min(16, ctx.renderer.capabilities.getMaxAnisotropy());
  const labelScale = 3;

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  let theme: ThemeName = ctx.theme;
  let disposed = false;

  // Shared geometry.
  const unitPlane = track(new THREE.PlaneGeometry(1, 1));
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  const tagGeo = track(new THREE.PlaneGeometry(0.2, 0.084));
  const lampGeo = track(new THREE.BoxGeometry(0.94, 0.006, 0.026).translate(0, -0.021, 0.254));
  const fixtureGeo = track(buildFixtureGeometry());

  // Shared textures and materials.
  const frameTex: Record<FrameStyle, THREE.CanvasTexture> = {
    gilt: track(giltTexture()),
    walnut: track(grainTexture('#3d2516', 0.05, 0.3, 90, true, 11)),
    brass: track(grainTexture('#f2f2f2', 0.02, 0.1, 120, false, 23)),
  };
  const frameParams: Record<FrameStyle, THREE.MeshStandardMaterialParameters> = {
    // Metalness is kept moderate on purpose: with no environment map a full
    // metal has no diffuse response and would render black under ambient light.
    gilt: { color: 0xcfa552, metalness: 0.5, roughness: 0.42, map: frameTex.gilt, bumpMap: frameTex.gilt, bumpScale: 1.4 },
    walnut: { color: 0xffffff, metalness: 0, roughness: 0.56, map: frameTex.walnut },
    brass: { color: 0xb9955c, metalness: 0.55, roughness: 0.36, map: frameTex.brass },
  };

  const hitMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const fixtureMat = track(new THREE.MeshStandardMaterial({ color: 0x9a7b45, metalness: 0.55, roughness: 0.4 }));
  const lampMat = track(new THREE.MeshBasicMaterial({ toneMapped: false }));
  const tagTex = track(new THREE.CanvasTexture(drawTag(high ? 2 : 1)));
  tagTex.colorSpace = THREE.SRGBColorSpace;
  tagTex.anisotropy = maxAniso;
  const tagMat = track(new THREE.MeshBasicMaterial({ map: tagTex, toneMapped: false }));

  const glowColor = new THREE.Color().setRGB(1, 0.74, 0.44);
  const shadowColor = new THREE.Color().setRGB(0.05, 0.04, 0.03);
  const picLight = new THREE.Color().setRGB(1, 0.84, 0.6);

  const paintings = pieces.map(buildPainting);
  const hotspots: Hotspot[] = paintings.map((p) => ({ object: p.hit, stopId: p.piece.id }));

  loadNearestFirst();
  setTheme(theme);

  return { group, hotspots, setTheme, update, dispose };

  // ── Construction ──────────────────────────────────────────────────────────

  function buildFixtureGeometry(): THREE.BufferGeometry {
    // Unit-length tube along x; the group is scaled in x to suit each frame.
    const tube = new THREE.CylinderGeometry(0.022, 0.022, 1, 12).rotateZ(Math.PI / 2).translate(0, 0, 0.26);
    const arm = new THREE.BoxGeometry(0.03, 0.02, 0.25).translate(0, 0.006, 0.125);
    const plate = new THREE.BoxGeometry(0.13, 0.11, 0.012).translate(0, 0, 0.006);
    const merged = mergeGeometries([tube, arm, plate]);
    arm.dispose();
    plate.dispose();
    if (!merged) return tube;
    tube.dispose();
    return merged;
  }

  function fxPlane(kind: FxKind, color: THREE.Color): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    return new THREE.Mesh(unitPlane, track(makeFxMaterial(kind, color)));
  }

  function buildPainting(piece: Piece, index: number): Painting {
    const slot = pieceSlot(index);
    const profile = PROFILES[piece.frame];

    const root = new THREE.Group();
    root.name = `artwork:${piece.id}`;
    root.position.set(slot.position[0], slot.position[1], slot.position[2]);
    // Local +z is the wall normal, so local +x is the viewer's right.
    root.rotation.y = Math.atan2(slot.normal[0], slot.normal[2]);
    group.add(root);

    const hung = new THREE.Group();
    root.add(hung);

    const canvas = new THREE.Mesh(unitPlane, track(makeCanvasMaterial(piece.status === 'restoration')));
    canvas.position.z = CANVAS_Z;
    hung.add(canvas);

    const sweep = createSweep(profile);
    track(sweep.geometry);
    const frameUniforms: FrameUniforms = { uPicLight: { value: new THREE.Color(0, 0, 0) }, uPicHalfH: { value: 1 } };
    hung.add(new THREE.Mesh(sweep.geometry, track(makeFrameMaterial(frameParams[piece.frame], frameUniforms))));

    const hit = new THREE.Mesh(unitBox, hitMat);
    hit.name = `hotspot:${piece.id}`;
    hit.userData = { stopId: piece.id, pieceIndex: index };
    hung.add(hit);

    let tag: THREE.Mesh | null = null;
    if (piece.status === 'restoration') {
      tag = new THREE.Mesh(tagGeo, tagMat);
      tag.rotation.z = -0.07;
      hung.add(tag);
    }

    const shadow = fxPlane('shadow', shadowColor);
    shadow.position.z = 0.003;
    const wall = fxPlane('wall', glowColor);
    wall.position.z = 0.004;
    const floor = fxPlane('floor', glowColor);
    floor.rotation.x = -Math.PI / 2;
    root.add(shadow, wall, floor);

    const labelTex = track(new THREE.CanvasTexture(drawLabel(piece, labelScale)));
    labelTex.colorSpace = THREE.SRGBColorSpace;
    labelTex.anisotropy = maxAniso;
    const label = new THREE.Mesh(unitPlane, track(new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false })));
    label.scale.set(LABEL_W, LABEL_H, 1);
    root.add(label);

    const fixture = new THREE.Group();
    fixture.add(new THREE.Mesh(fixtureGeo, fixtureMat), new THREE.Mesh(lampGeo, lampMat));
    root.add(fixture);

    const size = fitSize(DEFAULT_ASPECT);
    const painting: Painting = {
      piece,
      index,
      profile,
      root,
      hung,
      canvas,
      sweep,
      frameUniforms,
      hit,
      shadow,
      wall,
      floor,
      label,
      fixture,
      tag,
      floorY: -slot.position[1],
      size,
      from: size,
      to: size,
      sizeT: 1,
      reveal: 0,
      loaded: false,
      near: nearness(index + 1),
    };
    applySize(painting, size[0], size[1]);
    return painting;
  }

  /** Lays out everything that depends on the image size (metres). */
  function applySize(p: Painting, w: number, h: number): void {
    const hxIn = w / 2 + MAT;
    const hyIn = h / 2 + MAT;
    const hxOut = hxIn + p.profile.width;
    const hyOut = hyIn + p.profile.width;
    p.size = [w, h];

    p.canvas.scale.set(hxIn * 2, hyIn * 2, 1);
    const cu = p.canvas.material.uniforms;
    (cu.uPlane.value as THREE.Vector2).set(hxIn * 2, hyIn * 2);
    (cu.uImage.value as THREE.Vector2).set(w, h);

    p.sweep.write(hxIn, hyIn);
    p.frameUniforms.uPicHalfH.value = hyOut;

    p.hit.scale.set(hxOut * 2, hyOut * 2, p.profile.depth);
    p.hit.position.z = p.profile.depth / 2;

    if (p.tag) p.tag.position.set(-hxOut + 0.12, -hyOut + 0.065, p.profile.depth + 0.004);

    sizeFx(p.shadow, (hxOut + 0.42) * 2, (hyOut + 0.42) * 2, hxOut, hyOut);
    sizeFx(p.wall, Math.min(2.9, (hxOut + 0.9) * 2), (hyOut + 1.15) * 2, hxOut, hyOut);

    const lampLen = Math.min(Math.max(w * 0.55, 0.36), 1.1);
    const lampY = hyOut + 0.15;
    p.fixture.position.y = lampY;
    p.fixture.scale.x = lampLen;

    const floorDepth = 2.4;
    sizeFx(p.floor, (hxOut + 1.1) * 2, floorDepth, hxOut, hyOut);
    p.floor.position.set(0, p.floorY + 0.01, floorDepth / 2 + 0.02);

    p.label.position.set(Math.min(hxOut + LABEL_GAP + LABEL_W / 2, LABEL_MAX_X), LABEL_Y - HANG.centerY, 0.008);
  }

  function sizeFx(mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>, w: number, h: number, hx: number, hy: number): void {
    mesh.scale.set(w, h, 1);
    const u = mesh.material.uniforms;
    (u.uPlane.value as THREE.Vector2).set(w, h);
    (u.uHalf.value as THREE.Vector2).set(hx, hy);
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  function loadNearestFirst(): void {
    const loader = new THREE.TextureLoader();
    const eye = ctx.camera.position;
    const queue = paintings.slice().sort((a, b) => a.root.position.distanceToSquared(eye) - b.root.position.distanceToSquared(eye));
    let cursor = 0;

    const next = (): void => {
      if (disposed || cursor >= queue.length) return;
      const p = queue[cursor++];
      loader.load(
        p.piece.image,
        (tex) => {
          if (disposed) {
            tex.dispose();
            return;
          }
          track(tex);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = maxAniso;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          p.canvas.material.uniforms.map.value = tex;
          p.loaded = true;

          const image = tex.image as { width?: number; height?: number } | undefined;
          const aspect = image?.width && image?.height ? image.width / image.height : DEFAULT_ASPECT;
          p.from = p.size;
          p.to = fitSize(aspect);
          p.sizeT = 0;
          ctx.invalidate();
          next();
        },
        undefined,
        // A missing image leaves a primed canvas on the wall; keep the queue moving.
        () => next(),
      );
    };
    for (let i = 0; i < CONCURRENT_LOADS; i++) next();
  }

  // ── Theme and focus ───────────────────────────────────────────────────────

  /** Writes every theme- and focus-dependent value for one painting. */
  function applyLook(p: Painting): void {
    const dark = theme === 'dark';
    const level = NIGHT.farLevel + (1 - NIGHT.farLevel) * p.near;
    const fog = dark ? NIGHT.fog : 1;

    const cu = p.canvas.material.uniforms;
    cu.uDark.value = dark ? 1 : 0;
    cu.uLevel.value = 0.9 + 0.1 * p.near; // image never dims below 0.9 at the centre
    cu.uDay.value = 0.94 + 0.06 * p.near;
    cu.uFog.value = fog;

    p.shadow.visible = !dark;
    p.shadow.material.uniforms.uIntensity.value = 0.36;
    p.wall.visible = true;
    p.wall.material.uniforms.uIntensity.value = (dark ? NIGHT.wall * level : DAY.wall) * (dark ? 0.6 + 0.4 * p.near : 1);
    p.wall.material.uniforms.uFog.value = fog;
    p.floor.visible = dark;
    p.floor.material.uniforms.uIntensity.value = NIGHT.floor * level;
    p.floor.material.uniforms.uFog.value = fog;

    p.frameUniforms.uPicLight.value.copy(picLight).multiplyScalar((dark ? NIGHT.frame * level : DAY.frame) * p.profile.gain);

    if (dark) {
      const l = 0.2 + 0.3 * p.near;
      p.label.material.color.setRGB(l, l * 0.88, l * 0.7);
    } else {
      p.label.material.color.setScalar(0.9 + 0.1 * p.near);
    }

    p.fixture.visible = dark || FIXTURE_IN_LIGHT;
    // The old hang was never quite level; it only shows once the lights go down.
    p.hung.rotation.z = dark ? THREE.MathUtils.degToRad(p.piece.tilt) : 0;
  }

  function setTheme(next: ThemeName): void {
    theme = next;
    const dark = next === 'dark';
    if (dark) {
      lampMat.color.setRGB(1, 0.86, 0.62);
      fixtureMat.emissive.setRGB(0.1, 0.07, 0.03);
      tagMat.color.setRGB(0.6, 0.52, 0.4);
    } else {
      lampMat.color.setRGB(0.62, 0.52, 0.36);
      fixtureMat.emissive.setRGB(0.04, 0.03, 0.015);
      tagMat.color.setRGB(1, 1, 1);
    }
    for (const p of paintings) applyLook(p);
  }

  function update(dt: number, _elapsed: number, focus: number): boolean {
    if (disposed) return false;
    // Clamped so a long idle gap between on-demand frames cannot skip a fade.
    const step = Math.min(Math.max(dt, 0), MAX_STEP);
    const ease = 1 - Math.exp(-step * FOCUS_RATE);
    let busy = false;

    for (const p of paintings) {
      const target = nearness(focus - (p.index + 1)); // piece i is stop i + 1
      const diff = target - p.near;
      if (Math.abs(diff) > 0.003) {
        p.near += diff * ease;
        applyLook(p);
        busy = true;
      } else if (diff !== 0) {
        p.near = target;
        applyLook(p);
      }

      if (p.loaded && p.reveal < 1) {
        p.reveal = Math.min(1, p.reveal + step / REVEAL_SECONDS);
        p.canvas.material.uniforms.uReveal.value = easeInOut(p.reveal);
        busy = true;
      }

      if (p.sizeT < 1) {
        p.sizeT = Math.min(1, p.sizeT + step / RESIZE_SECONDS);
        const k = easeInOut(p.sizeT);
        applySize(p, p.from[0] + (p.to[0] - p.from[0]) * k, p.from[1] + (p.to[1] - p.from[1]) * k);
        busy = true;
      }
    }
    return busy;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    group.clear();
    for (const item of disposables) item.dispose();
    disposables.length = 0;
    hotspots.length = 0;
  }
}
