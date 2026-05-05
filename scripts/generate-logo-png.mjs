import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'public/logos/eagle-flags-dark.svg');
const OUT = 'C:\\Users\\Beast\\Desktop\\yourmajor-logo-navy-1024.png';
const NAVY = '#1A3260';
const SIZE = 1024;

// Source viewBox is "-85 -95 170 170" — geometric center (0, -10), but the
// gold rings are centered at (0, 10). Override with a square viewBox centered
// on the rings so contain-fit gives equal padding on all four sides.
const svgText = (await readFile(SRC, 'utf8'))
  .replace(/viewBox="[^"]*"/, 'viewBox="-110 -100 220 220"');

await sharp(Buffer.from(svgText), { density: 768 })
  .resize(SIZE, SIZE, { fit: 'contain', background: NAVY })
  .flatten({ background: NAVY })
  .png()
  .toFile(OUT);

console.log(`Wrote ${OUT}`);
