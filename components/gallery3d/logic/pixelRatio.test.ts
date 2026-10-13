import { describe, expect, it } from 'vitest';
import { pickPixelRatio } from './pixelRatio';

const hi = { quality: 'high' as const, viewportScale: 1, cssWidth: 1440, cssHeight: 900 };

describe('pickPixelRatio', () => {
  it('caps the low tier at 1.5', () => {
    expect(pickPixelRatio({ ...hi, quality: 'low', device: 3 })).toBe(1.5);
    expect(pickPixelRatio({ ...hi, quality: 'low', device: 1 })).toBe(1);
  });
  it('renders a retina laptop at its device ratio', () => {
    expect(pickPixelRatio({ ...hi, device: 2 })).toBe(2);
  });
  it('follows browser zoom, which shrinks the CSS size as it raises the ratio', () => {
    expect(pickPixelRatio({ ...hi, device: 4, cssWidth: 720, cssHeight: 450 })).toBe(4);
  });
  it('never exceeds 4', () => {
    expect(pickPixelRatio({ ...hi, device: 6, cssWidth: 480, cssHeight: 300 })).toBe(4);
  });
  it('holds a large window to 8 megapixels', () => {
    expect(pickPixelRatio({ ...hi, device: 2, cssWidth: 1920, cssHeight: 1080 })).toBe(1.96);
  });
  it('allows 12 megapixels while pinch-zoomed', () => {
    expect(pickPixelRatio({ ...hi, device: 2, viewportScale: 2 })).toBe(3.04);
  });
  it('steps down by 0.25 per penalty, never below min(device, 1)', () => {
    expect(pickPixelRatio({ ...hi, device: 4, cssWidth: 720, cssHeight: 450, penalty: 2 })).toBe(3.5);
    expect(pickPixelRatio({ ...hi, device: 1, penalty: 10 })).toBe(1);
    expect(pickPixelRatio({ ...hi, device: 0.8, penalty: 10 })).toBe(0.8);
  });
  it('survives a zero-size canvas and a missing device ratio', () => {
    const r = pickPixelRatio({ quality: 'high', device: NaN, viewportScale: NaN, cssWidth: 0, cssHeight: 0 });
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBe(1);
  });
});
