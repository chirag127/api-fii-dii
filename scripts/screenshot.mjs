// Regenerate docs/screenshot.png from the live GitHub Pages site.
// Requires Playwright (already a transitive dev tool). Run:
//   node scripts/screenshot.mjs            # shoots the live site
//   SITE=http://localhost:8000 node scripts/screenshot.mjs   # shoot a local build
// To screenshot a local build first: `node scripts/build-site.mjs && npx serve dist`.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'screenshot.png');
const url = process.env.SITE || 'https://chirag127.github.io/fii-dii-activity-api/';

mkdirSync(join(root, 'docs'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500); // let the inline SVG settle
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`Wrote ${out} from ${url}`);
