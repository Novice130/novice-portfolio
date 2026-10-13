import { describe, expect, it } from 'vitest';
import { FULL_BUDGET, createFrameMonitor, stepDown } from './qualityStepDown';

describe('stepDown', () => {
  it('gives up extra pixel ratio first, while it is above 2', () => {
    expect(stepDown(FULL_BUDGET, 3)).toEqual({ ...FULL_BUDGET, dprPenalty: 1 });
  });
  it('then drops ambient occlusion, then the sun shadow map size', () => {
    const a = stepDown(FULL_BUDGET, 2);
    expect(a).toEqual({ ...FULL_BUDGET, gtao: false });
    const b = stepDown(a!, 2);
    expect(b).toEqual({ dprPenalty: 0, gtao: false, sunShadow: 2048 });
  });
  it('returns null when nothing is left to give up', () => {
    expect(stepDown({ dprPenalty: 0, gtao: false, sunShadow: 2048 }, 2)).toBeNull();
  });
});

describe('createFrameMonitor', () => {
  it('fires after eight consecutive slow frames, then starts over', () => {
    const monitor = createFrameMonitor();
    const results = Array.from({ length: 9 }, () => monitor.push(30));
    expect(results).toEqual([false, false, false, false, false, false, false, true, false]);
  });
  it('is reset by one fast frame', () => {
    const monitor = createFrameMonitor();
    for (let i = 0; i < 7; i++) monitor.push(30);
    monitor.push(10);
    expect(monitor.push(30)).toBe(false);
  });
  it('ignores hiccups and nonsense: a tab switch is not a slow GPU', () => {
    const monitor = createFrameMonitor();
    for (let i = 0; i < 7; i++) monitor.push(30);
    expect(monitor.push(900)).toBe(false);
    expect(monitor.push(NaN)).toBe(false);
    expect(monitor.push(0)).toBe(false);
    expect(monitor.push(30)).toBe(false);
  });
});
