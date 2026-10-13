import { describe, expect, it } from 'vitest';
import { ARROW_FADE, arrowFloorX, arrowHittable, arrowOpacity } from './arrowFade';

describe('arrowOpacity', () => {
  it('is fully visible at the stand point (4m back, 3.5m across)', () => {
    expect(arrowOpacity(Math.hypot(3.5, 4), 4)).toBe(1);
  });
  it('is invisible from the previous stand point', () => {
    expect(arrowOpacity(Math.hypot(3.5, 8), 8)).toBe(0);
  });
  it('is half visible midway through the distance ramp', () => {
    expect(arrowOpacity((ARROW_FADE.near + ARROW_FADE.far) / 2, 4.6)).toBeCloseTo(0.5, 5);
  });
  it('fades out while walking past the work', () => {
    expect(arrowOpacity(3.6, 1.0)).toBe(0);
    expect(arrowOpacity(4.0, (ARROW_FADE.aheadMin + ARROW_FADE.aheadFull) / 2)).toBeCloseTo(0.5, 5);
  });
  it('never increases as distance grows', () => {
    let last = 1;
    for (let d = 4; d <= 9; d += 0.1) {
      const o = arrowOpacity(d, 5);
      expect(o).toBeLessThanOrEqual(last + 1e-9);
      last = o;
    }
  });
  it('is zero for non-finite input', () => {
    expect(arrowOpacity(NaN, 3)).toBe(0);
    expect(arrowOpacity(5, Infinity)).toBe(0);
  });
  it('is all or nothing under reduced motion', () => {
    expect(arrowOpacity(5.0, 3.6, true)).toBe(1);
    expect(arrowOpacity(6.2, 5, true)).toBe(0);
    expect(arrowOpacity(3.6, 1.0, true)).toBe(0);
  });
});

describe('arrowHittable', () => {
  it('needs at least 0.3 opacity', () => {
    expect(arrowHittable(0.29)).toBe(false);
    expect(arrowHittable(0.3)).toBe(true);
  });
});

describe('arrowFloorX', () => {
  it('is capped at 2.4m on an ultra-wide screen', () => {
    expect(arrowFloorX(21 / 9, 4)).toBe(ARROW_FADE.maxX);
  });
  it('sits a little over 2m out at 16:9, clear of the screen corner', () => {
    expect(arrowFloorX(16 / 9, 4)).toBeCloseTo(2.17, 1);
  });
  it('moves in on a narrower landscape window', () => {
    expect(arrowFloorX(1.3, 4)).toBeCloseTo(1.59, 1);
  });
  it('keeps the whole 0.4m disc inside the visible floor on a portrait phone', () => {
    const aspect = 390 / 844;
    const halfVisible = 4 * Math.tan((76 / 2) * (Math.PI / 180)) * aspect;
    const x = arrowFloorX(aspect, 4);
    expect(x).toBeGreaterThan(0.5);
    expect(x + 0.4).toBeLessThan(halfVisible);
  });
});
