// Stills at fixed stops in both themes, for before / after comparison.
// Usage: node scripts/shots.mjs --out=.stills/baseline [--base=http://localhost:4173] [--q=low] [--center]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const base = arg('base', 'http://localhost:4173');
const out = arg('out', '.stills/current');
const quality = arg('q', '');
const center = flag('center');
const STOPS = ['', 'citcd', 'phet-remaster', 'centerpiece', 'door'];
const PIECES = new Set(['citcd', 'phet-remaster']);

await mkdir(out, { recursive: true });
// Wait until the on-demand renderer has drawn nothing for a second (or 25s at most).
const settle = async (page) => {
  const frames = () => page.evaluate(() => Number(document.querySelector('canvas')?.dataset.g3frames ?? 0));
  let last = await frames();
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const now = await frames();
    if (now === last && now > 0) return;
    last = now;
  }
};

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const stop of STOPS) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        reducedMotion: 'no-preference',
      });
      await context.addInitScript((t) => {
        localStorage.setItem('gtheme', t);
        localStorage.removeItem('gmode');
      }, theme);
      const page = await context.newPage();
      const query = `?g3debug${quality ? `&g3q=${quality}` : ''}`;
      await page.goto(`${base}/${query}${stop ? `#${stop}` : ''}`);
      await page.waitForSelector('html[data-g3="live"]', { timeout: 30000 });
      // The centrepiece animates by design and never goes idle: a fixed wait there.
      if (stop === 'centerpiece' || stop === 'door') await page.waitForTimeout(9000);
      else await settle(page);
      // A work's link opens facing it; --center steps back to the centre line.
      if (center && PIECES.has(stop)) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(500);
        await settle(page);
      }
      const file = path.join(out, `${theme}-${stop || 'intro'}${center && PIECES.has(stop) ? '-center' : ''}.png`);
      await page.screenshot({ path: file });
      console.log(file);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
