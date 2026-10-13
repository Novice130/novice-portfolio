// Which image file a work shows. Every work gets the 1200px image; only the
// work the visitor is at and its two neighbours hold the 2400px one.
import type { Quality } from '../contract';

export const MAX_LARGE = 3;

export function artworkSources(image: string): { small: string; large: string; fallback: string } {
  const stem = image.replace(/\.[a-z0-9]+$/i, '');
  return { small: `${stem}-1200.webp`, large: `${stem}.webp`, fallback: image };
}

/** Piece indices that should hold a 2400px texture, most wanted first. Piece i is stop i + 1. */
export function wantedLarge(focus: number, pieceCount: number, quality: Quality): number[] {
  if (quality === 'low' || !Number.isFinite(focus) || pieceCount <= 0) return [];
  const current = Math.round(focus) - 1;
  return [current, current + 1, current - 1].filter((i) => i >= 0 && i < pieceCount).slice(0, MAX_LARGE);
}

export function planLarge(live: readonly number[], wanted: readonly number[]): { load: number[]; drop: number[] } {
  return {
    load: wanted.filter((i) => !live.includes(i)),
    drop: live.filter((i) => !wanted.includes(i)),
  };
}
