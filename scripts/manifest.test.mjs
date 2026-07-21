// The data/index.json manifest must be dynamically derived from the actual
// data files — never stale, never hardcoded. Regenerating it must produce no
// change (CI enforces this too).
// Run: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');

const actualDates = readdirSync(dataDir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

test('index.json exists and lists exactly the dated files present', () => {
  const manifest = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'));
  assert.deepEqual(manifest.dates, actualDates, 'manifest dates drifted from data/ — run node scripts/manifest.mjs');
  assert.equal(manifest.count, actualDates.length);
});

test('manifest.latest matches latest.json', () => {
  const manifest = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'));
  const latest = JSON.parse(readFileSync(join(dataDir, 'latest.json'), 'utf8'));
  assert.equal(manifest.latest, latest.date);
});

test('every manifest date resolves to a real, loadable payload', () => {
  const manifest = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'));
  for (const d of manifest.dates) {
    const payload = JSON.parse(readFileSync(join(dataDir, `${d}.json`), 'utf8'));
    assert.equal(payload.date, d, `${d}.json has mismatched date field`);
  }
});
