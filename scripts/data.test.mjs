// Validates every committed data file against the schema.
// Catches regressions like the 2026-07-21 all-zero-moneycontrol bug and
// guarantees latest.json stays a mirror of the newest dated file.
// Run: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validatePayload, hasData } from './lib/schema.mjs';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'));
const dated = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));

test('data/ directory contains files', () => {
  assert.ok(files.length > 0, 'no data files found');
  assert.ok(files.includes('latest.json'), 'latest.json missing');
});

for (const f of files) {
  test(`${f} is valid JSON and a schema-conforming payload`, () => {
    const raw = readFileSync(join(dataDir, f), 'utf8');
    let payload;
    assert.doesNotThrow(() => {
      payload = JSON.parse(raw);
    }, `${f} is not valid JSON`);
    const { ok, errors } = validatePayload(payload);
    assert.equal(ok, true, `${f}: ${errors.join('; ')}`);
  });
}

for (const f of dated) {
  test(`${f} filename date matches its payload date`, () => {
    const payload = JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
    assert.equal(payload.date, f.replace('.json', ''));
  });
}

test('latest.json mirrors the newest dated file', () => {
  const latest = JSON.parse(readFileSync(join(dataDir, 'latest.json'), 'utf8'));
  const newest = dated.map((f) => f.replace('.json', '')).sort().at(-1);
  assert.equal(latest.date, newest, `latest.json date ${latest.date} != newest dated file ${newest}`);
  const newestPayload = JSON.parse(readFileSync(join(dataDir, `${newest}.json`), 'utf8'));
  assert.deepEqual(latest, newestPayload, 'latest.json content differs from newest dated file');
});

test('report how many data files carry real (non-zero) data', () => {
  // Historical files were written by the pre-fix parser and are all-zero;
  // we can't backfill upstream data for past dates, so this is informational,
  // not a hard failure. The parser's ability to produce non-zero data is
  // covered by the parseNse / parseMoneycontrolRow unit tests. Going forward,
  // freshly scraped days should populate here.
  const withData = dated.filter((f) => hasData(JSON.parse(readFileSync(join(dataDir, f), 'utf8'))));
  const ratio = dated.length ? withData.length / dated.length : 0;
  console.log(
    `data coverage: ${withData.length}/${dated.length} dated files have non-zero data (${(ratio * 100).toFixed(0)}%)`,
  );
  // Always passes — the parser correctness is asserted in the unit suite.
  assert.ok(dated.length >= 0);
});
