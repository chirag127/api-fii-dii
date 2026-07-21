// Generate data/index.json — a manifest of every available dated payload so
// the browser can discover and fetch them client-side (it can't list a dir).
// Fully dynamic: derived from whatever data/*.json files exist. No hardcoding.
// Run: node scripts/manifest.mjs  (invoked by scrape.yml and build-site.mjs)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');

const dates = readdirSync(dataDir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

let latestDate = null;
try {
  latestDate = JSON.parse(readFileSync(join(dataDir, 'latest.json'), 'utf8')).date;
} catch {
  latestDate = dates[dates.length - 1] ?? null;
}

const manifest = { count: dates.length, latest: latestDate, dates };
writeFileSync(join(dataDir, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote data/index.json (${dates.length} dates, latest ${latestDate}).`);
