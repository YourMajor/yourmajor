import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'public/icons/icon-master.svg');
const OUT = join(ROOT, 'public/icons');
const NAVY = '#1A3260';

const svg = await readFile(SRC);

const ANY = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png',     size: 192 },
  { name: 'icon-512x512.png',     size: 512 },
  { name: 'favicon-32x32.png',    size: 32  },
];

const MASKABLE = [
  { name: 'icon-maskable-192.png', size: 192 },
  { name: 'icon-maskable-512.png', size: 512 },
];

for (const { name, size } of ANY) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(OUT, name));
  console.log(`✓ ${name} (${size}×${size})`);
}

for (const { name, size } of MASKABLE) {
  const inner = Math.round(size * 0.8);
  const pad = Math.round((size - inner) / 2);
  await sharp(svg, { density: 384 })
    .resize(inner, inner)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: NAVY })
    .png()
    .toFile(join(OUT, name));
  console.log(`✓ ${name} (${size}×${size}, maskable safe zone)`);
}

console.log(`\nGenerated ${ANY.length + MASKABLE.length} icons in ${OUT}`);
