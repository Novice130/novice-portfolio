// Street-View-style navigation: grey translucent discs with dark chevrons lying on the
// floor (forward, side-to-work), screen-anchored chevrons (back, and the facing pair),
// plus a mouse-only surface cursor (floor ring / wall-bay square).
import * as THREE from 'three';
import {
  CORRIDOR,
  SALON,
  STAND_BACK,
  pieceSlot,
  stops,
  type Hotspot,
  type SceneCtx,
  type ScenePart,
  type Stop,
  type ThemeName,
} from '../contract';
import { arrowFloorX, arrowHittable, arrowOpacity } from '../logic/arrowFade';

const LAST = stops.length - 1;
const ORDER = 30;
const FADE_OUT = 0.16;
const FADE_IN = 0.32;
const SPREAD = 0.55;
const ARROW_DIST = 5;
// -90deg is flat on the floor; easing off 24deg toward the visitor keeps screen chevrons readable.
const ARROW_TILT = -Math.PI / 2 + (24 * Math.PI) / 180;
const FLOOR_Y = 0.02;
const HALF_W = CORRIDOR.width / 2;
const BAY = 1.35;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const at = (i: number) => stops[i] as Stop;
const node = (i: number): [number, number] => {
  const s = at(i);
  const p = s.aheadCam ?? s.cam;
  return [p[0], p[2]];
};

type Palette = {
  disc: THREE.Color;
  discA: number;
  ring: THREE.Color;
  ringA: number;
  chev: THREE.Color;
  chevA: number;
  cursor: THREE.Color;
};
const PALETTES: Record<ThemeName, Palette> = {
  light: {
    disc: new THREE.Color('#ebebeb'),
    discA: 0.55,
    ring: new THREE.Color('#ffffff'),
    ringA: 0.9,
    chev: new THREE.Color('#4a4a4a'),
    chevA: 0.85,
    cursor: new THREE.Color('#ffffff'),
  },
  dark: {
    disc: new THREE.Color('#d9cfb8'),
    discA: 0.34,
    ring: new THREE.Color('#F3E6C4'),
    ringA: 0.85,
    chev: new THREE.Color('#1c1814'),
    chevA: 0.9,
    cursor: new THREE.Color('#F3E6C4'),
  },
};

// Blunt, thick chevron pointing toward local +X, unit width.
function chevronShape(): THREE.Shape {
  const w = 1;
  const h = 0.46;
  const t = 0.32;
  const o = -0.05;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + o, h);
  s.lineTo(-w / 2 + t + o, h);
  s.lineTo(w / 2 + o, 0);
  s.lineTo(-w / 2 + t + o, -h);
  s.lineTo(-w / 2 + o, -h);
  s.lineTo(w / 2 - t * 1.25 + o, 0);
  s.closePath();
  return s;
}

function roundedRect<T extends THREE.Path>(p: T, size: number, r: number): T {
  const h = size / 2;
  p.moveTo(-h + r, -h);
  p.lineTo(h - r, -h);
  p.quadraticCurveTo(h, -h, h, -h + r);
  p.lineTo(h, h - r);
  p.quadraticCurveTo(h, h, h - r, h);
  p.lineTo(-h + r, h);
  p.quadraticCurveTo(-h, h, -h, h - r);
  p.lineTo(-h, -h + r);
  p.quadraticCurveTo(-h, -h, -h + r, -h);
  return p;
}

type Marker = {
  chev: THREE.Mesh;
  root: THREE.Group;
  body: THREE.Group;
  hit: THREE.Mesh;
  discMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
  chevMat: THREE.MeshBasicMaterial;
  dk: number;
  hasRing: boolean;
  on: boolean;
  hover: boolean;
};

const FWD_DIST = 5.2;

export function createNavArrows(ctx: SceneCtx): ScenePart {
  const group = new THREE.Group();
  group.name = 'navArrows';

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const geo = <G extends THREE.BufferGeometry>(g: G): G => (geos.push(g), g);
  const mat = (flat: boolean, order: number) => {
    const m = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: flat,
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide,
      polygonOffset: flat,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    m.userData.order = order;
    mats.push(m);
    return m;
  };

  const discGeo = geo(new THREE.CircleGeometry(1, 48));
  const ringGeo = geo(new THREE.RingGeometry(0.92, 1, 48));
  const chevGeo = geo(new THREE.ShapeGeometry(chevronShape()));
  const hitGeo = geo(new THREE.CircleGeometry(1, 24));
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  mats.push(hitMat);

  const make = (r: number, cw: number, hasRing: boolean, dk: number, flat: boolean): Marker => {
    const o = flat ? 0 : 10;
    const root = new THREE.Group();
    const body = new THREE.Group();
    body.rotation.x = -Math.PI / 2;
    root.add(body);
    const discMat = mat(flat, ORDER + o);
    const ringMat = mat(flat, ORDER + 1 + o);
    const chevMat = mat(flat, ORDER + 2 + o);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.scale.setScalar(r);
    disc.renderOrder = ORDER + o;
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.scale.setScalar(r);
    ring.position.z = 0.001;
    ring.renderOrder = ORDER + 1 + o;
    ring.visible = hasRing;
    const chev = new THREE.Mesh(chevGeo, chevMat);
    chev.scale.setScalar(cw);
    chev.position.z = 0.002;
    chev.renderOrder = ORDER + 2 + o;
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.scale.setScalar(Math.max(r + 0.15, 0.5));
    body.add(disc, ring, chev, hit);
    group.add(root);
    const m: Marker = { root, body, hit, chev, discMat, ringMat, chevMat, dk, hasRing, on: false, hover: false };
    hit.userData.setHover = (on: boolean) => {
      if (m.hover === on) return;
      m.hover = on;
      ctx.invalidate();
    };
    root.visible = false;
    return m;
  };

  const fwd = make(0.62, 0.62, true, 1, true);
  // Lies on the floor level with the work (depth-tested, like the forward disc).
  const side = make(0.4, 0.4, true, 1, true);
  const back = make(0.3, 0.34, false, 0.4, false);
  const fNext = make(0.3, 0.3, true, 1, false);
  const fPrev = make(0.3, 0.3, true, 1, false);
  const markers = [fwd, side, back, fNext, fPrev];

  // ---- cursors ----
  const cm = {
    ring: mat(true, ORDER + 6),
    fill: mat(true, ORDER + 5),
    wFill: mat(false, ORDER + 16),
    wEdge: mat(false, ORDER + 17),
  };
  const floorCur = new THREE.Group();
  const fRing = new THREE.Mesh(geo(new THREE.RingGeometry(0.31, 0.34, 48)), cm.ring);
  const fFill = new THREE.Mesh(geo(new THREE.CircleGeometry(0.31, 32)), cm.fill);
  for (const [m, o] of [[fFill, 5], [fRing, 6]] as const) {
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = ORDER + o;
    floorCur.add(m);
  }
  const wallCur = new THREE.Group();
  const wFillGeo = geo(new THREE.ShapeGeometry(roundedRect(new THREE.Shape(), 0.5, 0.08)));
  const edge = roundedRect(new THREE.Shape(), 0.5, 0.08);
  edge.holes.push(roundedRect(new THREE.Path(), 0.46, 0.06));
  const wFill = new THREE.Mesh(wFillGeo, cm.wFill);
  const wEdge = new THREE.Mesh(geo(new THREE.ShapeGeometry(edge)), cm.wEdge);
  wFill.renderOrder = ORDER + 16;
  wEdge.renderOrder = ORDER + 17;
  wallCur.add(wFill, wEdge);
  floorCur.visible = wallCur.visible = false;
  group.add(floorCur, wallCur);
  let cur: 0 | 1 | 2 = 0; // 0 none, 1 floor, 2 wall

  // ---- floor hotspot ----
  const zFar = CORRIDOR.zEnd - 2 * SALON.radius;
  const floorGeo = geo(new THREE.PlaneGeometry(6.4, CORRIDOR.zStart - zFar));
  const floorPlane = new THREE.Mesh(floorGeo, hitMat);
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.set(0, 0.005, (zFar + CORRIDOR.zStart) / 2);
  group.add(floorPlane);

  const hotspots: Hotspot[] = [
    { object: fwd.hit, stopId: 'nav:next' },
    { object: side.hit, stopId: 'nav:face' },
    { object: back.hit, stopId: 'nav:prev' },
    { object: fNext.hit, stopId: 'nav:next' },
    { object: fPrev.hit, stopId: 'nav:prev' },
    { object: floorPlane, stopId: 'nav:floor' },
  ];

  const reduced =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let pal = PALETTES[ctx.theme];
  let vis = 0;
  let settled = false;
  let lastKey = -1;
  let curIdx = 0;
  let curFacing = false;
  let sideIdx = -1;
  let sideVis = 0;
  let sideAspect = NaN;
  const lastPos = new THREE.Vector3(NaN, NaN, NaN);
  const lastQuat = new THREE.Quaternion(NaN, NaN, NaN, NaN);
  let lastAspect = NaN;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const cam = new THREE.Vector3();
  const fwdV = new THREE.Vector3();
  const rightV = new THREE.Vector3();
  const slots = stops.filter((s) => s.kind === 'piece').map((s) => pieceSlot(s.pieceIndex ?? 0));
  let pointerActive = false;

  const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx);

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

  function layout(idx: number, facing: boolean) {
    curIdx = idx;
    curFacing = facing;
    const s = at(idx);
    fwd.on = !facing && idx < LAST;
    // No back marker while looking ahead: that way lies behind the camera (the HUD arrow and \u2193 cover it).
    back.on = false;
    fNext.on = facing && idx < LAST;
    fPrev.on = facing && idx > 0;

    if (fwd.on) {
      const [cx, cz] = node(idx);
      const [nx, nz] = node(idx + 1);
      let dx = nx - cx;
      let dz = nz - cz;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) fwd.on = false;
      else {
        dx /= len;
        dz /= len;
        const d = s.kind === 'centerpiece' || s.kind === 'door' ? Math.min(3.4, 0.6 * len) : FWD_DIST;
        let px = cx + dx * d;
        let pz = cz + dz * d;
        if (s.kind === 'centerpiece' || s.kind === 'door') {
          const near = (x: number, z: number) => Math.hypot(x - SALON.center[0], z - SALON.center[2]) < 3.2;
          for (let k = 0.25; near(px, pz) && k <= 4; k += 0.25) {
            const a: [number, number] = [px - dz * k, pz + dx * k];
            const b: [number, number] = [px + dz * k, pz - dx * k];
            const pick = !near(a[0], a[1]) ? a : !near(b[0], b[1]) ? b : null;
            if (pick) [px, pz] = pick;
          }
        }
        fwd.root.position.set(px, FLOOR_Y, pz);
        fwd.root.rotation.y = yawOf(dx, dz);
      }
    }
    group.updateMatrixWorld(true);
  }

  function placeScreen() {
    const c = ctx.camera;
    const portrait = clamp((1.3 - c.aspect) / 0.7, 0, 1);
    c.getWorldPosition(cam);
    fwdV.set(0, 0, -1).transformDirection(c.matrixWorld);
    fwdV.y = 0;
    if (fwdV.lengthSq() < 1e-6) fwdV.set(0, 0, -1);
    fwdV.normalize();
    rightV.set(-fwdV.z, 0, fwdV.x);

    const anchor = (x: number, y: number, out: THREE.Vector3) => {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, c);
      return out.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, ARROW_DIST);
    };

    if (back.on) {
      anchor(0, lerp(-0.8, -0.3, portrait), tmp);
      back.root.position.copy(tmp);
      back.root.rotation.y = yawOf(-fwdV.x, -fwdV.z);
      back.body.rotation.x = ARROW_TILT;
    }
    if (curFacing) {
      anchor(lerp(0.12, 0, portrait), lerp(-0.8, -0.26, portrait), tmp);
      const ns = rightV.z < 0 ? 1 : -1; // screen side (along right) that points toward -Z
      fNext.root.position.copy(tmp).addScaledVector(rightV, SPREAD * ns);
      fPrev.root.position.copy(tmp).addScaledVector(rightV, -SPREAD * ns);
      fNext.root.rotation.y = fPrev.root.rotation.y = yawOf(rightV.x, rightV.z);
      fNext.chev.rotation.z = ns > 0 ? 0 : Math.PI;
      fPrev.chev.rotation.z = ns > 0 ? Math.PI : 0;
      fNext.body.rotation.x = fPrev.body.rotation.x = ARROW_TILT;
    }
    group.updateMatrixWorld(true);
  }

  function applyAll() {
    const shown = vis > 0.001;
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
    floorCur.visible = cur === 1 && shown;
    wallCur.visible = cur === 2 && shown;
    cm.ring.opacity = 0.7 * vis;
    cm.fill.opacity = 0.12 * vis;
    cm.wFill.opacity = 0.28 * vis;
    cm.wEdge.opacity = 0.6 * vis;
  }

  function setHoverTo(target: Marker | null) {
    for (const m of markers) {
      const on = m === target;
      if (m.hover !== on) {
        m.hover = on;
        ctx.invalidate();
      }
    }
  }

  function setCursor(k: 0 | 1 | 2) {
    if (cur !== k) {
      cur = k;
      ctx.invalidate();
    }
  }

  function evalPointer() {
    if (!settled || !pointerActive) {
      setCursor(0);
      setHoverTo(null);
      return;
    }
    raycaster.setFromCamera(ndc, ctx.camera);
    const { origin: o, direction: d } = raycaster.ray;
    const hits = raycaster
      .intersectObjects(markers.filter((m) => m.on && m.hit.visible).map((m) => m.hit), false)
      .map((h) => h.object);
    setHoverTo(markers.find((m) => m.hit === hits[0]) ?? null);

    const tFloor = d.y < -1e-6 ? -o.y / d.y : Infinity;
    let tWall = Infinity;
    let ws: -1 | 1 = 1;
    if (Math.abs(d.x) > 1e-6) {
      ws = d.x > 0 ? 1 : -1;
      const t = (ws * HALF_W - o.x) / d.x;
      if (t > 0) tWall = t;
    }
    if (tWall < tFloor) {
      const y = o.y + d.y * tWall;
      const z = o.z + d.z * tWall;
      if (y > 0.55 && y < 3.85 && slots.some((s) => s.side === ws && Math.abs(z - s.position[2]) < BAY)) {
        wallCur.position.set(ws * (HALF_W - 0.14), y, z);
        wallCur.rotation.y = -ws * Math.PI / 2;
        setCursor(2);
      } else setCursor(0);
      return;
    }
    if (tFloor === Infinity) return setCursor(0);
    const x = o.x + d.x * tFloor;
    const z = o.z + d.z * tFloor;
    const walk =
      (Math.abs(x) < 3.2 && z > CORRIDOR.zEnd && z < CORRIDOR.zStart) ||
      Math.hypot(x - SALON.center[0], z - SALON.center[2]) < SALON.radius - 0.6;
    const nearMarker = [fwd, side].some(
      (m) => m.on && Math.hypot(x - m.root.position.x, z - m.root.position.z) < 0.7,
    );
    if (!walk || nearMarker) return setCursor(0);
    floorCur.position.set(x, 0.03, z);
    setCursor(1);
  }

  const el = ctx.renderer.domElement;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerActive = true;
    evalPointer();
    applyAll();
    ctx.invalidate();
  };
  const onLeave = () => {
    pointerActive = false;
    evalPointer();
    applyAll();
    ctx.invalidate();
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);

  function setTheme(t: ThemeName) {
    pal = PALETTES[t];
    for (const m of markers) {
      m.discMat.color.copy(pal.disc);
      m.ringMat.color.copy(pal.ring);
      m.chevMat.color.copy(pal.chev);
    }
    for (const m of Object.values(cm)) m.color.copy(pal.cursor);
    applyAll();
    ctx.invalidate();
  }

  function update(dt: number, _elapsed: number, focus: number): boolean {
    const idx = Math.round(focus);
    const nowSettled = Math.abs(focus - idx) <= 0.06;
    const face = document.documentElement.dataset.g3face !== undefined;
    const key = idx * 2 + (face ? 1 : 0);
    const facing = face && at(idx).kind === 'piece';

    if (nowSettled) {
      let dirty = false;
      if (key !== lastKey) {
        lastKey = key;
        if (!reduced) vis = 0;
        layout(idx, facing);
        dirty = true;
      }
      const c = ctx.camera;
      c.updateMatrixWorld();
      const moved =
        c.position.distanceToSquared(lastPos) > 1e-10 ||
        Math.abs(c.quaternion.dot(lastQuat)) < 1 - 1e-10 ||
        c.aspect !== lastAspect;
      if (moved || dirty) {
        placeScreen();
        lastPos.copy(c.position);
        lastQuat.copy(c.quaternion);
        lastAspect = c.aspect;
      }
      if (!settled || dirty) {
        settled = true;
        if (pointerActive) evalPointer();
      }
    } else if (settled) {
      settled = false;
      cur = 0;
      setHoverTo(null);
    }

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
  }

  function dispose() {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    group.parent?.remove(group);
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
  }

  setTheme(ctx.theme);

  return { group, hotspots, setTheme, update, dispose };
}
