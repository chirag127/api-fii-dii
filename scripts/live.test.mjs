// Live-endpoint integration tests — hit the real public URLs and upstream
// sources. Network-dependent and gated behind LIVE=1 so the default
// `node --test` run stays deterministic and offline.
//
//   LIVE=1 node --test scripts/live.test.mjs
//
// Each test tolerates transient upstream failure (NSE/MC often rate-limit or
// block CI IPs) by asserting on *shape when reachable* rather than hard-failing
// the suite for an upstream outage — except the served JSON endpoints, which
// are our own product surface and must be valid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePayload } from './lib/schema.mjs';

const LIVE = process.env.LIVE === '1';
const skip = LIVE ? false : 'set LIVE=1 to run live-endpoint tests';

const CANONICAL = 'https://chirag127.github.io/fii-dii-activity-api/data';
const RAW = 'https://raw.githubusercontent.com/chirag127/fii-dii-activity-api/main/data';
const JSDELIVR = 'https://cdn.jsdelivr.net/gh/chirag127/fii-dii-activity-api@main/data';
const STATICALLY = 'https://cdn.statically.io/gh/chirag127/fii-dii-activity-api/main/data';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  return { res, body: res.ok ? await res.json() : null };
}

// --- Product endpoints (must serve valid, schema-conforming JSON) -----------

for (const [label, base] of [
  ['github-pages (canonical)', CANONICAL],
  ['raw.githubusercontent', RAW],
  ['jsdelivr', JSDELIVR],
  ['statically', STATICALLY],
]) {
  test(`${label}: latest.json is reachable and schema-valid`, { skip }, async () => {
    const { res, body } = await fetchJson(`${base}/latest.json`);
    assert.equal(res.status, 200, `${base}/latest.json returned ${res.status}`);
    const { ok, errors } = validatePayload(body);
    assert.equal(ok, true, `${label} latest.json invalid: ${errors.join('; ')}`);
  });
}

test('raw: a specific dated file is reachable and valid', { skip }, async () => {
  // First discover the latest date, then fetch that dated file by name.
  const { body: latest } = await fetchJson(`${CANONICAL}/latest.json`);
  const { res, body } = await fetchJson(`${RAW}/${latest.date}.json`);
  assert.equal(res.status, 200);
  assert.equal(validatePayload(body).ok, true);
  assert.equal(body.date, latest.date);
});

// --- Upstream sources (tolerant: assert shape only when reachable) ----------

test('upstream NSE: /api/fiidii returns FII + DII category rows (best-effort)', { skip }, async () => {
  const warm = await fetch('https://www.nseindia.com/', { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  const cookie = warm.headers.getSetCookie?.().join('; ') ?? warm.headers.get('set-cookie') ?? '';
  const res = await fetch('https://www.nseindia.com/api/fiidii', {
    headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.nseindia.com/', Cookie: cookie },
  });
  if (!res.ok) {
    console.warn(`NSE upstream unreachable (${res.status}) — skipping shape assert`);
    return;
  }
  const arr = await res.json();
  assert.ok(Array.isArray(arr), 'NSE body should be an array');
  const cats = arr.map((r) => r.category).join(' | ');
  assert.match(cats, /f(ii|pi)/i, `no FII/FPI row found; got: ${cats}`);
  assert.match(cats, /dii/i, `no DII row found; got: ${cats}`);
});

test('upstream Moneycontrol: activity page is reachable (best-effort)', { skip }, async () => {
  const res = await fetch('https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php', {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) {
    console.warn(`Moneycontrol upstream unreachable (${res.status}) — skipping`);
    return;
  }
  const html = await res.text();
  assert.match(html, /<table/i, 'no <table> in Moneycontrol response');
});
