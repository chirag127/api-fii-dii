// Scrape FII/DII activity. Primary: NSE official API. Fallback: Moneycontrol.
// Writes data/YYYY-MM-DD.json + data/latest.json.
//
// A source only "succeeds" if it parses into a payload that both validates
// AND carries non-zero data — otherwise we fall through to the next source.
// This prevents silently committing all-zero rows (e.g. from a header row or
// a category-name mismatch) as if the scrape had worked.
import { writeFileSync, mkdirSync } from 'node:fs';
import { load } from 'cheerio';
import {
  buildPayload,
  validatePayload,
  hasCompleteEquity,
  parseNse,
  parseMoneycontrolRow,
  zeroBlock,
} from './lib/schema.mjs';

const today = new Date().toISOString().slice(0, 10);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function tryNse() {
  // Cookie warmup — NSE rejects API calls without a session cookie.
  const warm = await fetch('https://www.nseindia.com/', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  const cookie =
    warm.headers.getSetCookie?.().join('; ') ?? warm.headers.get('set-cookie') ?? '';
  const res = await fetch('https://www.nseindia.com/api/fiidii', {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      Referer: 'https://www.nseindia.com/',
      Cookie: cookie,
    },
  });
  if (!res.ok) throw new Error(`NSE ${res.status}`);
  const arr = await res.json();
  // NSE fiidii is Capital Market (cash) only — no derivative data available.
  return buildPayload({
    date: today,
    source: 'nse',
    equity: parseNse(arr),
    derivative: zeroBlock(),
  });
}

async function tryMoneycontrol() {
  const res = await fetch(
    'https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php',
    { headers: { 'User-Agent': UA } },
  );
  if (!res.ok) throw new Error(`MC ${res.status}`);
  const $ = load(await res.text());
  // First data row of the FII/DII table: Date | FII Buy/Sell/Net | DII Buy/Sell/Net.
  const cells = $('table tr')
    .eq(1)
    .find('td')
    .map((_, el) => $(el).text().trim())
    .get();
  return buildPayload({
    date: today,
    source: 'moneycontrol',
    equity: parseMoneycontrolRow(cells),
    derivative: zeroBlock(),
  });
}

/** Try a source; return its payload only if it validates AND has complete FII+DII data. */
async function trySource(name, fn) {
  try {
    const payload = await fn();
    const { ok, errors } = validatePayload(payload);
    if (!ok) {
      console.error(`${name} produced invalid payload:`, errors.join('; '));
      return null;
    }
    if (!hasCompleteEquity(payload)) {
      console.error(`${name} missing FII and/or DII equity data — treating as failure`);
      return null;
    }
    return payload;
  } catch (e) {
    console.error(`${name} failed:`, e.message);
    return null;
  }
}

const result =
  (await trySource('NSE', tryNse)) ??
  (await trySource('Moneycontrol', tryMoneycontrol)) ??
  buildPayload({ date: today, source: 'placeholder' });

mkdirSync('data', { recursive: true });
writeFileSync(`data/${today}.json`, JSON.stringify(result, null, 2) + '\n');
writeFileSync('data/latest.json', JSON.stringify(result, null, 2) + '\n');
console.log('Wrote', `data/${today}.json`, 'source=', result.source);
