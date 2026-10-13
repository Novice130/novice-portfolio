// What the high tier gives up, and in what order, when frames run slow.

export type Budget = {
  /** Pixel-ratio steps given up (see pixelRatio.ts). */
  dprPenalty: number;
  gtao: boolean;
  sunShadow: 4096 | 2048;
};

export const FULL_BUDGET: Budget = { dprPenalty: 0, gtao: true, sunShadow: 4096 };

/** The next cheaper budget, or null when nothing is left. `pixelRatio` is the ratio in use now. */
export function stepDown(budget: Budget, pixelRatio: number): Budget | null {
  if (pixelRatio > 2) return { ...budget, dprPenalty: budget.dprPenalty + 1 };
  if (budget.gtao) return { ...budget, gtao: false };
  if (budget.sunShadow === 4096) return { ...budget, sunShadow: 2048 };
  return null;
}

/** Longer than this is a hiccup (tab switch, garbage collection), not a slow GPU. */
const HICCUP_MS = 250;

/** `push` returns true once `run` consecutive frames took longer than `slowMs`. */
export function createFrameMonitor(slowMs = 24, run = 8) {
  let slow = 0;
  return {
    push(ms: number): boolean {
      if (!Number.isFinite(ms) || ms <= 0 || ms > HICCUP_MS) {
        slow = 0;
        return false;
      }
      if (ms <= slowMs) {
        slow = 0;
        return false;
      }
      if (++slow < run) return false;
      slow = 0;
      return true;
    },
    reset() {
      slow = 0;
    },
  };
}
