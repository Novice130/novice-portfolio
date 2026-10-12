// Shared contract for the 3D gallery. Every scene module builds against this
// file and nothing else, so the room, the artworks, the centrepiece and the
// controller can be written independently.
//
// World: metres, Y up. The visitor enters at z = +4 and walks toward -Z down
// the Grande Galerie, which opens into a round salon holding the centrepiece.
import type * as THREE from 'three';
import { centerpiece, pieces } from '@/data/gallery';

export type ThemeName = 'light' | 'dark';
export type Quality = 'low' | 'high';

export const EYE = 1.65;

export const CORRIDOR = {
  width: 7, // walls at x = ±3.5
  wallHeight: 5.4, // vault springs from here
  vaultRise: 1.9, // barrel vault apex = wallHeight + vaultRise
  zStart: 6, // entrance wall (behind the visitor)
  zEnd: -42, // mouth of the salon
} as const;

export const SALON = {
  center: [0, 0, -52] as const,
  radius: 10,
  wallHeight: 7,
  domeRise: 5,
} as const;

// Hanging rules for the corridor walls.
export const HANG = {
  firstZ: -4,
  spacing: 4,
  centerY: 2.15, // centre line of every canvas
  maxWidth: 1.7, // frame + wall label must fit between the pilasters (clear wall is 3.4m)
  maxHeight: 2.9,
} as const;

export type Slot = {
  index: number;
  side: -1 | 1; // -1 = left wall (x < 0), +1 = right wall
  /** Point on the wall surface at the canvas centre. */
  position: [number, number, number];
  /** Unit vector pointing from the wall into the room. */
  normal: [number, number, number];
};

export function pieceSlot(index: number): Slot {
  const side: -1 | 1 = index % 2 === 0 ? -1 : 1;
  return {
    index,
    side,
    position: [side * (CORRIDOR.width / 2), HANG.centerY, HANG.firstZ - index * HANG.spacing],
    normal: [-side, 0, 0],
  };
}

export type StopKind = 'intro' | 'piece' | 'centerpiece' | 'door';

export type Stop = {
  id: string;
  kind: StopKind;
  /** Index into `pieces` for kind === 'piece'. */
  pieceIndex?: number;
  /** Where the visitor stands, and what they look at, when attending to this stop. */
  cam: [number, number, number];
  look: [number, number, number];
  /**
   * Pieces only: the spot on the corridor centre line the visitor walks to
   * first, looking straight down the gallery. `cam` / `look` are then the
   * step-and-turn to face the work.
   */
  aheadCam?: [number, number, number];
  title: string;
  meta: string;
  blurb: string;
  href?: string;
};

// Far wall of the salon: the doorway to Room 2 (the school site).
export const DOOR = {
  position: [0, 0, SALON.center[2] - SALON.radius] as [number, number, number],
  width: 2.4,
  height: 4.2,
  href: '/school/',
} as const;

export const stops: Stop[] = [
  {
    id: 'intro',
    kind: 'intro',
    cam: [0, EYE, 3.2],
    look: [0, EYE + 0.35, -20],
    title: 'Collected works',
    meta: 'Novice Gallery',
    blurb: 'Nine works line the gallery. One waits in the salon with its case smashed open.',
  },
  ...pieces.map((p, i): Stop => {
    const s = pieceSlot(i);
    return {
      id: p.id,
      kind: 'piece',
      pieceIndex: i,
      aheadCam: [0, EYE, s.position[2] + 3.2],
      // Facing the work: square on, from the far side of the centre line.
      cam: [-s.side * 2.5, EYE, s.position[2] + 0.3],
      look: [s.position[0], HANG.centerY - 0.1, s.position[2]],
      title: p.title,
      meta: `${p.no} · ${p.year ? `${p.year} · ` : ''}${p.medium}`,
      blurb: p.blurb,
      href: p.href,
    };
  }),
  {
    id: 'centerpiece',
    kind: 'centerpiece',
    cam: [1.2, EYE, SALON.center[2] + 5.2],
    // Aim left of the plinth so it sits clear of the caption card.
    look: [-0.3, 1.5, SALON.center[2]],
    title: centerpiece.title,
    meta: `${centerpiece.no} · Centrepiece · ${centerpiece.medium}`,
    blurb: centerpiece.blurb,
    href: centerpiece.href,
  },
  {
    id: 'door',
    kind: 'door',
    cam: [-2.6, EYE, SALON.center[2] - 3.5],
    look: [0, 2.4, DOOR.position[2]],
    title: 'Room 2 — Novice Schools',
    meta: 'Managed IT and platforms for schools',
    blurb: 'Through the arch: the school side of the practice.',
    href: DOOR.href,
  },
];

// The centrepiece stands on the salon centre. Its plinth top is at this height.
export const PLINTH = { width: 2.2, depth: 1.3, height: 0.95, caseHeight: 1.7 } as const;

export type SceneCtx = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  theme: ThemeName;
  quality: Quality;
  /** Call when async work (a texture arriving) needs a new frame. */
  invalidate: () => void;
};

/** A clickable object. The controller raycasts these and walks to `stopId`. */
export type Hotspot = { object: THREE.Object3D; stopId: string };

export type ScenePart = {
  group: THREE.Group;
  hotspots?: Hotspot[];
  /** Swap materials / lights for the theme. Must be cheap and idempotent. */
  setTheme: (theme: ThemeName) => void;
  /**
   * Per-frame hook. `focus` is the fractional index into `stops` the camera is
   * currently at (2.4 = 40% of the way from stop 2 to stop 3).
   * Return true to request another frame (i.e. something is still animating).
   */
  update?: (dt: number, elapsed: number, focus: number) => boolean | void;
  dispose: () => void;
};

// Module signatures (one file each, default-free named exports):
//   scene/room.ts         export function createRoom(ctx: SceneCtx): ScenePart
//   scene/artworks.ts     export function createArtworks(ctx: SceneCtx): ScenePart
//   scene/centerpiece.ts  export function createCenterpiece(ctx: SceneCtx): ScenePart
//
// Ownership:
//   room        — floor, walls, vault, salon, dome, doorway, benches, fog,
//                 scene.background, ALL general lighting (ambient / hemi / sun).
//   artworks    — frames, canvases, wall labels, picture lights and their glow.
//   centerpiece — plinth, screen, broken glass case, shards, rope, its own spot.
//
// Budget: no real-time shadow maps; at most 3 real lights in room, 0 in
// artworks (fake the pools of light with emissive + additive planes), 1 in
// centerpiece. Fake contact shadows with gradient planes. Share geometries and
// materials. Target 60fps on a 2020 phone at devicePixelRatio 1.5.
