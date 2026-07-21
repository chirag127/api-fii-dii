// Regenerate docs/screenshot.png from the live GitHub Pages site (or a local
// build). Uses the Playwright CLI via npx so no package install is required.
//   node scripts/screenshot.mjs                              # live site
//   SITE=http://localhost:5055 node scripts/screenshot.mjs   # local build
// For a local build first: `node scripts/build-site.mjs && npx serve -l 5055 dist`.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'screenshot.png');
const url = process.env.SITE || 'https://chirag127.github.io/fii-dii-activity-api/';

mkdirSync(join(root, 'docs'), { recursive: true });

// The chart renders client-side, so wait for network idle before capturing.
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(
  npx,
  ['--yes', 'playwright', 'screenshot', '--full-page', '--viewport-size=1000,900', '--wait-for-timeout=3000', url, out],
  { stdio: 'inherit' }
);
console.log(`Wrote ${out} from ${url}`);
