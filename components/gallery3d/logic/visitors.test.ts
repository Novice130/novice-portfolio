import { describe, expect, it } from 'vitest';
import { CAT, VISITOR, catGoal, stepCat, stepVisitor, type Actor, type Spot } from './visitors';

const SPOTS: Spot[] = [
  { x: -1.9, z: -4, yaw: -Math.PI / 2 },
  { x: 1.9, z: -8, yaw: Math.PI / 2 },
  { x: -1.9, z: -12, yaw: -Math.PI / 2 },
  { x: 1.9, z: -16, yaw: Math.PI / 2 },
  { x: -1.9, z: -20, yaw: -Math.PI / 2 },
];
const at = (spot: number): Actor => ({ x: SPOTS[spot].x, z: SPOTS[spot].z, yaw: SPOTS[spot].yaw, speed: 0, spot });
const run = (a: Actor, cam: { x: number; z: number }, seconds: number, taken: number[] = []) => {
  for (let t = 0; t < seconds; t += 1 / 60) a = stepVisitor(a, SPOTS, cam, taken, 1 / 60);
  return a;
};

describe('stepVisitor', () => {
  it('stays put, facing the work, while the visitor is far away', () => {
    const a = run(at(2), { x: 0, z: 4 }, 2);
    expect(a).toEqual(at(2));
  });
  it('walks off to another work when the visitor comes near', () => {
    const start = at(1);
    const moving = run(start, { x: 0, z: -4 }, 1);
    expect(moving.speed).toBeGreaterThan(0);
    expect(moving.spot).not.toBe(1);
    const done = run(moving, { x: 0, z: -4 }, 30);
    expect(done.speed).toBe(0);
    expect(done.x).toBeCloseTo(SPOTS[done.spot].x, 2);
    expect(done.z).toBeCloseTo(SPOTS[done.spot].z, 2);
    expect(Math.hypot(done.x, done.z + 4)).toBeGreaterThan(VISITOR.notice);
  });
  it('walks away from the visitor, not past them', () => {
    const a = run(at(1), { x: 0, z: -4 }, 1);
    expect(SPOTS[a.spot].z).toBeLessThan(SPOTS[1].z);
  });
  it('never takes a spot another person holds', () => {
    const a = run(at(1), { x: 0, z: -4 }, 1, [2]);
    expect(a.spot).not.toBe(2);
  });
  it('walks at a human pace', () => {
    let a = at(1);
    let prev = a;
    for (let i = 0; i < 600; i++) {
      a = stepVisitor(a, SPOTS, { x: 0, z: -4 }, [], 1 / 60);
      expect(Math.hypot(a.x - prev.x, a.z - prev.z)).toBeLessThanOrEqual((VISITOR.speed / 60) * 1.001);
      prev = a;
    }
  });
  it('stays where it is when every other spot is taken or near the visitor', () => {
    const a = run(at(1), { x: 0, z: -8 }, 2, [0, 2, 3, 4]);
    expect(a.spot).toBe(1);
    expect(a.speed).toBe(0);
  });
});

describe('cat', () => {
  it('aims a few metres ahead of the visitor, off the centre line', () => {
    const goal = catGoal({ x: 0, z: -10 }, -40);
    expect(goal.z).toBeCloseTo(-10 - CAT.lead, 5);
    expect(Math.abs(goal.x)).toBeGreaterThan(0.3);
  });
  it('does not lead past the end of the corridor', () => {
    expect(catGoal({ x: 0, z: -39 }, -40).z).toBe(-40);
  });
  it('trots to its goal, then sits and looks back at the visitor', () => {
    let cat: Actor = { x: 0.5, z: 0, yaw: 0, speed: 0, spot: -1 };
    const cam = { x: 0, z: -6 };
    const goal = catGoal(cam, -40);
    for (let i = 0; i < 60 * 20; i++) cat = stepCat(cat, goal, cam, 1 / 60);
    expect(cat.speed).toBe(0);
    expect(Math.hypot(cat.x - goal.x, cat.z - goal.z)).toBeLessThan(CAT.arrive + 0.01);
    // yaw 0 faces +z in this convention (atan2(dx, dz)); the visitor is behind, at +z.
    expect(Math.cos(cat.yaw - Math.atan2(cam.x - cat.x, cam.z - cat.z))).toBeGreaterThan(0.95);
  });
  it('never outruns its top speed', () => {
    let cat: Actor = { x: 0.5, z: 0, yaw: 0, speed: 0, spot: -1 };
    let prev = cat;
    for (let i = 0; i < 300; i++) {
      cat = stepCat(cat, { x: 0.5, z: -30 }, { x: 0, z: -26 }, 1 / 60);
      expect(Math.hypot(cat.x - prev.x, cat.z - prev.z)).toBeLessThanOrEqual((CAT.speed / 60) * 1.001);
      prev = cat;
    }
  });
  it('holds still for a bad time step', () => {
    const cat: Actor = { x: 0.5, z: 0, yaw: 0, speed: 0, spot: -1 };
    expect(stepCat(cat, { x: 0.5, z: -30 }, { x: 0, z: -26 }, NaN)).toEqual(cat);
  });
});
