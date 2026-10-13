import { describe, expect, it } from 'vitest';
import { MAX_LARGE, artworkSources, planLarge, wantedLarge } from './artworkTiers';

describe('artworkSources', () => {
  it('derives the WebP tiers from the JPEG path', () => {
    expect(artworkSources('/gallery/citcd.jpg')).toEqual({
      small: '/gallery/citcd-1200.webp',
      large: '/gallery/citcd.webp',
      fallback: '/gallery/citcd.jpg',
    });
  });
});

describe('wantedLarge', () => {
  it('wants the current work and its neighbours, current first', () => {
    expect(wantedLarge(3, 9, 'high')).toEqual([2, 3, 1]);
  });
  it('follows the nearest stop while walking', () => {
    expect(wantedLarge(3.4, 9, 'high')).toEqual([2, 3, 1]);
    expect(wantedLarge(3.6, 9, 'high')).toEqual([3, 4, 2]);
  });
  it('wants only the first work at the intro', () => {
    expect(wantedLarge(0, 9, 'high')).toEqual([0]);
  });
  it('wants only the last work at the centrepiece, none at the door', () => {
    expect(wantedLarge(10, 9, 'high')).toEqual([8]);
    expect(wantedLarge(11, 9, 'high')).toEqual([]);
  });
  it('wants nothing on the low tier or for bad input', () => {
    expect(wantedLarge(3, 9, 'low')).toEqual([]);
    expect(wantedLarge(NaN, 9, 'high')).toEqual([]);
    expect(wantedLarge(3, 0, 'high')).toEqual([]);
  });
});

describe('planLarge', () => {
  it('loads what is newly wanted and drops what is not', () => {
    expect(planLarge([1, 2, 3], [2, 3, 4])).toEqual({ load: [4], drop: [1] });
  });
  it('never leaves more than MAX_LARGE alive, whatever the route', () => {
    let live: number[] = [];
    const route = [0, 1, 2, 3, 11, 0, 10, 5, 5.5, 6, 2, 9, 11, 1];
    for (const focus of route) {
      const wanted = wantedLarge(focus, 9, 'high');
      const { load, drop } = planLarge(live, wanted);
      live = live.filter((i) => !drop.includes(i)).concat(load);
      expect(live.length).toBeLessThanOrEqual(MAX_LARGE);
      expect([...live].sort()).toEqual([...wanted].sort());
    }
  });
});
