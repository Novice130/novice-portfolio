// How many device pixels per CSS pixel the canvas renders at.
//
// Browser zoom raises devicePixelRatio and shrinks the CSS size by the same
// factor, so rendering at the full device ratio costs the same pixels as
// before. The cap is therefore a pixel budget, not a ratio.
import type { Quality } from '../contract';

export const DPR = {
  low: 1.5,
  max: 4,
  pixels: 8_000_000,
  /** Budget while the page is pinch-zoomed: sharper at a cost the frame monitor can take back. */
  pixelsZoomed: 12_000_000,
  /** Ratio given up per step-down. */
  step: 0.25,
} as const;

export type DprInput = {
  device: number;
  /** window.visualViewport.scale: above 1 while pinch-zoomed. */
  viewportScale: number;
  quality: Quality;
  cssWidth: number;
  cssHeight: number;
  /** Step-downs applied so far (see qualityStepDown.ts). */
  penalty?: number;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

export function pickPixelRatio(input: DprInput): number {
  const device = Number.isFinite(input.device) && input.device > 0 ? input.device : 1;
  if (input.quality === 'low') return Math.min(device, DPR.low);
  const scale = Number.isFinite(input.viewportScale) && input.viewportScale > 1 ? input.viewportScale : 1;
  const area = Math.max(1, input.cssWidth * input.cssHeight || 0);
  const budget = scale > 1.05 ? DPR.pixelsZoomed : DPR.pixels;
  const wanted = Math.min(device * scale, DPR.max, Math.sqrt(budget / area));
  return round2(Math.max(Math.min(device, 1), wanted - (input.penalty ?? 0) * DPR.step));
}
