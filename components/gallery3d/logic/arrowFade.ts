// When the side arrow (the floor marker that leads to a work) is visible, and
// where on the floor it lies. Pure: no three.js, no DOM.

export const ARROW_FADE = {
  /** Camera-to-work distance (m): invisible beyond `far`, fully visible within `near`. */
  far: 6.8,
  near: 5.6,
  /** Metres the work is still ahead of the camera: gone below `aheadMin`, full above `aheadFull`. */
  aheadMin: 1.5,
  aheadFull: 2.6,
  /** Opacity below which the arrow cannot be clicked. */
  hitMin: 0.3,
  /** Furthest the arrow lies from the corridor centre line (m). */
  maxX: 2.4,
} as const;

// Vertical field of view while looking down the gallery: landscape (50 + 8 ahead) and portrait.
const FOV_LANDSCAPE = 58;
const FOV_PORTRAIT = 76;
const ASPECT_LANDSCAPE = 1.3;
const ASPECT_PORTRAIT = 0.6;
/** Share of the visible half-width the arrow may use, leaving room for its own radius. */
const FRAME_SHARE = 0.55;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const ramp = (v: number, lo: number, hi: number) => smooth(clamp01((v - lo) / (hi - lo)));

export function arrowOpacity(distance: number, ahead: number, reducedMotion = false): number {
  if (!Number.isFinite(distance) || !Number.isFinite(ahead)) return 0;
  if (reducedMotion) return distance <= ARROW_FADE.near && ahead >= ARROW_FADE.aheadFull ? 1 : 0;
  return (1 - ramp(distance, ARROW_FADE.near, ARROW_FADE.far)) * ramp(ahead, ARROW_FADE.aheadMin, ARROW_FADE.aheadFull);
}

export function arrowHittable(opacity: number): boolean {
  return opacity >= ARROW_FADE.hitMin;
}

/** Distance from the centre line (m) at which the arrow lies, `depth` metres ahead of the camera. */
export function arrowFloorX(aspect: number, depth: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(depth) || depth <= 0) return ARROW_FADE.maxX;
  const portrait = clamp01((ASPECT_LANDSCAPE - aspect) / (ASPECT_LANDSCAPE - ASPECT_PORTRAIT));
  const fov = FOV_LANDSCAPE + (FOV_PORTRAIT - FOV_LANDSCAPE) * portrait;
  const halfVisible = depth * Math.tan((fov / 2) * (Math.PI / 180)) * aspect;
  return Math.min(ARROW_FADE.maxX, FRAME_SHARE * halfVisible);
}
