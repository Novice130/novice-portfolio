// Behaviour of the gallery's company: a couple of people looking at the works,
// who move on to another work when the visitor comes near, and a cat that
// leads the way. Pure: positions on the floor plane (x, z), no three.js.
//
// Yaw is rotation about Y with 0 facing +z, so heading = atan2(dx, dz).

export type Point = { x: number; z: number };
/** A place to stand and look at a work. */
export type Spot = Point & { yaw: number };
export type Actor = Point & {
  yaw: number;
  /** Metres per second right now; 0 means standing (or sitting). */
  speed: number;
  /** People: the spot they stand at or are walking to. Unused (-1) for the cat. */
  spot: number;
};

export const VISITOR = {
  /** A person moves on when the visitor comes within this distance (m). */
  notice: 5.5,
  /** A new spot must be at least this far from the visitor. */
  clear: 7,
  speed: 1.15,
  turn: 5,
} as const;

export const CAT = {
  /** How far ahead of the visitor the cat waits (m), and how far off the centre line. */
  lead: 6,
  side: 0.9,
  speed: 2.2,
  /** Close enough to the goal to sit; it gets up again only beyond `rise`. */
  arrive: 0.25,
  rise: 0.9,
  turn: 7,
} as const;

const TAU = Math.PI * 2;
const wrap = (a: number) => a - TAU * Math.round(a / TAU);
const turnToward = (yaw: number, to: number, rate: number, dt: number) => {
  const diff = wrap(to - yaw);
  const step = rate * dt;
  return Math.abs(diff) <= step ? to : yaw + Math.sign(diff) * step;
};
const okDt = (dt: number) => Number.isFinite(dt) && dt > 0;

/** Advances one person. `taken` lists spots held by, or being walked to by, other people. */
export function stepVisitor(
  actor: Actor,
  spots: readonly Spot[],
  cam: Point,
  taken: readonly number[],
  dt: number,
): Actor {
  if (!okDt(dt) || !spots[actor.spot]) return actor;
  const here = spots[actor.spot];

  if (actor.speed === 0) {
    if (Math.hypot(actor.x - cam.x, actor.z - cam.z) < VISITOR.notice) {
      // Move on, away from the visitor, to the nearest work that is free and clear of them.
      const away = actor.z - cam.z <= 0 ? -1 : 1;
      let next = -1;
      let best = Infinity;
      spots.forEach((s, i) => {
        if (i === actor.spot || taken.includes(i)) return;
        if ((s.z - actor.z) * away <= 0) return;
        if (Math.hypot(s.x - cam.x, s.z - cam.z) < VISITOR.clear) return;
        const d = Math.hypot(s.x - actor.x, s.z - actor.z);
        if (d < best) [best, next] = [d, i];
      });
      if (next >= 0) return { ...actor, spot: next, speed: VISITOR.speed };
    }
    const yaw = turnToward(actor.yaw, here.yaw, VISITOR.turn, dt);
    return yaw === actor.yaw ? actor : { ...actor, yaw };
  }

  const dx = here.x - actor.x;
  const dz = here.z - actor.z;
  const dist = Math.hypot(dx, dz);
  const step = VISITOR.speed * dt;
  if (dist <= step) return { ...actor, x: here.x, z: here.z, speed: 0 };
  return {
    ...actor,
    x: actor.x + (dx / dist) * step,
    z: actor.z + (dz / dist) * step,
    yaw: turnToward(actor.yaw, Math.atan2(dx, dz), VISITOR.turn, dt),
    speed: VISITOR.speed,
  };
}

/** Where the cat wants to be: ahead of the visitor down the corridor, never past `zLimit`. */
export function catGoal(cam: Point, zLimit: number): Point {
  return { x: CAT.side, z: Math.max(cam.z - CAT.lead, zLimit) };
}

export function stepCat(cat: Actor, goal: Point, cam: Point, dt: number): Actor {
  if (!okDt(dt)) return cat;
  const dx = goal.x - cat.x;
  const dz = goal.z - cat.z;
  const dist = Math.hypot(dx, dz);

  if (dist <= CAT.arrive || (cat.speed === 0 && dist <= CAT.rise)) {
    // Sitting: look back at the visitor, as if waiting for them.
    const yaw = turnToward(cat.yaw, Math.atan2(cam.x - cat.x, cam.z - cat.z), CAT.turn, dt);
    return yaw === cat.yaw && cat.speed === 0 ? cat : { ...cat, yaw, speed: 0 };
  }
  // Eases in to the goal instead of stopping dead.
  const speed = Math.min(CAT.speed, 0.5 + dist * 1.6);
  const step = Math.min(speed * dt, dist);
  return {
    ...cat,
    x: cat.x + (dx / dist) * step,
    z: cat.z + (dz / dist) * step,
    yaw: turnToward(cat.yaw, Math.atan2(dx, dz), CAT.turn, dt),
    speed,
  };
}
