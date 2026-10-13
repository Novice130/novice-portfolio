// Downloads the CC0 texture sets from Poly Haven and writes WebP tiers.
// Usage: node scripts/fetch-textures.mjs
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'public', 'gallery', 'tex');
const BUDGET_HI = 3_300_000; // bytes, all hi-tier files together

const SETS = [
  { name: 'parquet', id: 'herringbone_parquet', hi: 2048, lo: 1024, use: 'corridor floor' },
  { name: 'marble', id: 'marble_01', hi: 1024, lo: 512, use: 'salon floor, dado, plinth' },
  { name: 'plaster', id: 'white_plaster_02', hi: 1024, lo: 512, use: 'walls, vault, dome' },
  { name: 'velvet', id: 'velour_velvet', hi: 512, lo: 512, use: 'salon walls, rope' },
  { name: 'walnut', id: 'walnut_veneer', hi: 1024, lo: 512, use: 'walnut frames' },
];
const MAPS = { color: 'Diffuse', normal: 'nor_gl', rough: 'Rough' };
const QUALITY = { color: 80, normal: 86, rough: 78 };

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
};
const getBuffer = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

let totalHi = 0;
let totalLo = 0;
const credits = ['# Texture credits', '', 'All sets are CC0 (public domain) from Poly Haven.', '', '| Folder | Asset | Used for | Source |', '|---|---|---|---|'];
for (const set of SETS) {
  const files = await getJson(`https://api.polyhaven.com/files/${set.id}`);
  const dir = path.join(outRoot, set.name);
  await mkdir(dir, { recursive: true });
  for (const [map, key] of Object.entries(MAPS)) {
    const url = files[key]?.['2k']?.jpg?.url;
    if (!url) throw new Error(`${set.id}: no 2k jpg for "${key}". Available: ${Object.keys(files).join(', ')}`);
    const source = await getBuffer(url);
    for (const [tier, px] of [['hi', set.hi], ['lo', set.lo]]) {
      const file = path.join(dir, `${map}-${tier}.webp`);
      await sharp(source).resize(px, px).webp({ quality: QUALITY[map] }).toFile(file);
      const { size } = await stat(file);
      if (tier === 'hi') totalHi += size;
      else totalLo += size;
      console.log(`${path.relative(root, file)}  ${px}px  ${Math.round(size / 1024)} KB`);
    }
  }
  credits.push(`| \`${set.name}/\` | ${set.id} | ${set.use} | https://polyhaven.com/a/${set.id} |`);
}
await writeFile(path.join(outRoot, 'CREDITS.md'), `${credits.join('\n')}\n`);
console.log(`\nhi tier: ${(totalHi / 1e6).toFixed(2)} MB   lo tier: ${(totalLo / 1e6).toFixed(2)} MB`);
if (totalHi > BUDGET_HI) {
  console.error(`hi tier is over the ${(BUDGET_HI / 1e6).toFixed(1)} MB budget: lower QUALITY and re-run.`);
  process.exit(1);
}
