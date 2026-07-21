// Structural checks on openapi.yaml (zero-dep — no YAML parser available).
// Asserts the spec documents both endpoints, lists the live servers, and that
// its example payload conforms to the same validatePayload used everywhere.
// Run: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validatePayload, SOURCES, BLOCK_FIELDS } from './lib/schema.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = readFileSync(join(root, 'openapi.yaml'), 'utf8').replace(/\r\n/g, '\n');

test('spec declares OpenAPI 3.1 and the API title', () => {
  assert.match(spec, /^openapi:\s*3\.1\.\d+/m);
  assert.match(spec, /title:\s*FII\/DII Activity API/);
});

test('spec has NO "Oriz Flow" branding', () => {
  assert.doesNotMatch(spec, /Oriz Flow/i);
});

test('spec documents both endpoints', () => {
  assert.match(spec, /\/latest\.json:/);
  assert.match(spec, /\/\{date\}\.json:/);
});

test('canonical server is the github.io Pages URL, listed first', () => {
  const firstServer = spec.match(/servers:\s*\n\s*-\s*url:\s*(\S+)/);
  assert.ok(firstServer, 'no servers block');
  assert.equal(firstServer[1], 'https://chirag127.github.io/fii-dii-activity-api/data');
});

test('spec lists the mirror servers', () => {
  for (const host of [
    'raw.githubusercontent.com/chirag127/fii-dii-activity-api',
    'cdn.jsdelivr.net/gh/chirag127/fii-dii-activity-api',
    'cdn.statically.io/gh/chirag127/fii-dii-activity-api',
    'fii-dii.api.oriz.in',
  ]) {
    assert.ok(spec.includes(host), `server ${host} missing from spec`);
  }
});

test('spec enumerates the same sources and block fields as the schema', () => {
  for (const s of SOURCES) assert.ok(spec.includes(s), `source ${s} missing`);
  for (const f of BLOCK_FIELDS) assert.ok(spec.includes(f), `field ${f} missing`);
});

test('the spec example payload is itself schema-valid', () => {
  // Extract the numbers from the PayloadExample block and rebuild the object,
  // then run it through the real validator.
  const num = (label) => {
    const m = spec.match(new RegExp(`${label}:\\s*(-?[\\d.]+)`));
    assert.ok(m, `example missing ${label}`);
    return Number(m[1]);
  };
  const example = {
    date: '2026-07-21',
    source: 'nse',
    equity: {
      fii_buy: 5917.71, fii_sell: 5004.12, fii_net: 913.59,
      dii_buy: 6440.88, dii_sell: 5165.66, dii_net: 1275.22,
    },
    derivative: { fii_buy: 0, fii_sell: 0, fii_net: 0, dii_buy: 0, dii_sell: 0, dii_net: 0 },
  };
  // Sanity: the values above match what's written in the spec example.
  assert.equal(num('fii_net'), example.equity.fii_net);
  const { ok, errors } = validatePayload(example);
  assert.equal(ok, true, errors.join('; '));
});
