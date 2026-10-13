// Recaptures every site in data/gallery.ts at 2400px wide.
// Usage: node scripts/capture-gallery.mjs [--base=http://localhost:4173] [--only=id,id]
// Relative hrefs are resolved against --base, so serve ./out first.
// A site that fails is skipped and its old files are kept; exit code 1 lists the failures.
import { rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { centerpiece, pieces } from '../data/gallery.ts';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const base = arg('base', 'http://localhost:4173');
const only = arg('only', '').split(',').filter(Boolean);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LARGE = 2400;
const SMALL = 1200;
const MIN_BYTES = 4_000;

const jobs = [...pieces, centerpiece]
  .map((p) => ({ id: path.basename(p.image, path.extname(p.image)), href: p.href, image: p.image }))
  .filter((j) => !only.length || only.includes(j.id));

const failures = [];
const browser = await chromium.launch();
try {
  for (const job of jobs) {
    const url = new URL(job.href, base).toString();
    const dir = path.join(root, 'public', path.dirname(job.image));
    const large = path.join(dir, `${job.id}.webp`);
    const small = path.join(dir, `${job.id}-1200.webp`);
    const tmpLarge = `${large}.tmp`;
    const tmpSmall = `${small}.tmp`;
    try {
      // Same viewport width and crop height as the image being replaced.
      const old = await sharp(path.join(root, 'public', job.image)).metadata();
      const scale = LARGE / old.width;
      const context = await browser.newContext({
        viewport: { width: old.width, height: Math.min(old.height, 1400) },
        deviceScaleFactor: scale,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      if (!response || !response.ok()) throw new Error(`HTTP ${response ? response.status() : 'no response'}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      const shot = await page.screenshot({ type: 'png', fullPage: true });
      await context.close();

      const meta = await sharp(shot).metadata();
      // A blank frame (flat colour) is a failed capture however large the file is.
      const { channels } = await sharp(shot).stats();
      if (channels.slice(0, 3).every((c) => c.stdev < 2)) throw new Error('capture is a blank frame');
      const height = Math.min(meta.height, Math.round(old.height * scale));
      if (height < Math.round(old.height * scale)) {
        console.warn(`  ${job.id}: page is shorter than the old crop (${meta.height}px < ${Math.round(old.height * scale)}px)`);
      }
      const cropped = sharp(shot).extract({ left: 0, top: 0, width: Math.min(meta.width, LARGE), height });
      await cropped.clone().webp({ quality: 82 }).toFile(tmpLarge);
      await cropped.clone().resize({ width: SMALL }).webp({ quality: 80 }).toFile(tmpSmall);
      for (const file of [tmpLarge, tmpSmall]) {
        if ((await stat(file)).size < MIN_BYTES) throw new Error('capture is nearly empty');
      }
      await rename(tmpLarge, large);
      await rename(tmpSmall, small);
      console.log(`${job.id}: ${url}\n  ${large} (${Math.round((await stat(large)).size / 1024)} KB)\n  ${small}`);
    } catch (err) {
      await rm(tmpLarge, { force: true });
      await rm(tmpSmall, { force: true });
      failures.push(`${job.id} (${url}): ${err.message}`);
      console.error(`${job.id}: FAILED, old image kept. ${err.message}`);
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`\n${failures.length} capture(s) failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
