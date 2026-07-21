// Unit tests for the pure schema/parsing helpers. No network, no fs.
// Run: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_FIELDS,
  SOURCES,
  zeroBlock,
  toNumber,
  makeBlock,
  validatePayload,
  buildPayload,
  isZeroBlock,
  hasData,
  hasCompleteEquity,
  parseNse,
  parseMoneycontrolRow,
} from './schema.mjs';

test('zeroBlock has all six fields at 0', () => {
  const b = zeroBlock();
  assert.deepEqual(Object.keys(b).sort(), [...BLOCK_FIELDS].sort());
  for (const f of BLOCK_FIELDS) assert.equal(b[f], 0);
});

test('toNumber coerces numbers, strings, junk, currency', () => {
  assert.equal(toNumber(42), 42);
  assert.equal(toNumber('1,234.5'), 1234.5);
  assert.equal(toNumber('₹ 9,999'), 9999);
  assert.equal(toNumber('-'), 0);
  assert.equal(toNumber(''), 0);
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber('21-Jul-2026'), 0); // a date is NOT a number
  assert.equal(toNumber(NaN), 0);
  assert.equal(toNumber(Infinity), 0);
  assert.equal(toNumber('-500.25'), -500.25); // net selling is negative
  assert.equal(toNumber('(913.59)'), -913.59); // accounting parenthetical = negative
  assert.equal(toNumber('(1,234)'), -1234);
});

test('makeBlock derives net when absent, honors explicit net', () => {
  const derived = makeBlock({ fii: { buy: 100, sell: 40 }, dii: { buy: 10, sell: 25 } });
  assert.equal(derived.fii_net, 60);
  assert.equal(derived.dii_net, -15);
  const explicit = makeBlock({ fii: { buy: 100, sell: 40, net: 999 } });
  assert.equal(explicit.fii_net, 999);
});

test('validatePayload accepts a canonical payload', () => {
  const p = buildPayload({
    date: '2026-07-21',
    source: 'nse',
    equity: makeBlock({ fii: { buy: 100, sell: 40 }, dii: { buy: 10, sell: 5 } }),
  });
  const { ok, errors } = validatePayload(p);
  assert.equal(ok, true, errors.join('; '));
});

test('validatePayload rejects bad date, source, non-finite, and net mismatch', () => {
  assert.equal(validatePayload(null).ok, false);
  assert.equal(validatePayload({}).ok, false);
  assert.equal(validatePayload({ date: 'nope', source: 'nse', equity: zeroBlock(), derivative: zeroBlock() }).ok, false);
  assert.equal(validatePayload({ date: '2026-07-21', source: 'bogus', equity: zeroBlock(), derivative: zeroBlock() }).ok, false);

  const nan = buildPayload({ date: '2026-07-21', source: 'nse' });
  nan.equity.fii_buy = NaN;
  assert.equal(validatePayload(nan).ok, false);

  const mismatch = buildPayload({ date: '2026-07-21', source: 'nse' });
  mismatch.equity.fii_buy = 100;
  mismatch.equity.fii_sell = 40;
  mismatch.equity.fii_net = 999; // 100-40 != 999
  assert.equal(validatePayload(mismatch).ok, false);
});

test('SOURCES is the documented precedence order', () => {
  assert.deepEqual(SOURCES, ['nse', 'moneycontrol', 'placeholder']);
});

test('isZeroBlock / hasData detect silent-failure all-zero payloads', () => {
  assert.equal(isZeroBlock(zeroBlock()), true);
  assert.equal(isZeroBlock(makeBlock({ fii: { buy: 1 } })), false);
  const allZero = buildPayload({ date: '2026-07-21', source: 'moneycontrol' });
  assert.equal(hasData(allZero), false); // the 2026-07-21 bug shape
  const real = buildPayload({ date: '2026-07-21', source: 'nse', equity: makeBlock({ fii: { buy: 100, sell: 40 } }) });
  assert.equal(hasData(real), true);
});

test('hasCompleteEquity requires BOTH FII and DII sides populated', () => {
  const both = buildPayload({
    date: '2026-07-21',
    source: 'nse',
    equity: makeBlock({ fii: { buy: 100, sell: 40 }, dii: { buy: 50, sell: 30 } }),
  });
  assert.equal(hasCompleteEquity(both), true);

  // FII only (NSE returned just the FII row) — must be rejected.
  const fiiOnly = buildPayload({ date: '2026-07-21', source: 'nse', equity: makeBlock({ fii: { buy: 100, sell: 40 } }) });
  assert.equal(hasCompleteEquity(fiiOnly), false);

  // DII only.
  const diiOnly = buildPayload({ date: '2026-07-21', source: 'nse', equity: makeBlock({ dii: { buy: 50, sell: 30 } }) });
  assert.equal(hasCompleteEquity(diiOnly), false);

  // All-zero.
  assert.equal(hasCompleteEquity(buildPayload({ date: '2026-07-21', source: 'placeholder' })), false);
});

test('parseNse extracts FII and DII from the real NSE row shape', () => {
  // Exact shape from NSE /api/fiidii (values are strings).
  const arr = [
    { category: 'DII **', date: '21-Jul-2026', buyValue: '6440.88', sellValue: '5165.66', netValue: '1275.22' },
    { category: 'FII/FPI *', date: '21-Jul-2026', buyValue: '5917.71', sellValue: '5004.12', netValue: '913.59' },
  ];
  const b = parseNse(arr);
  assert.equal(b.fii_buy, 5917.71);
  assert.equal(b.fii_sell, 5004.12);
  assert.equal(b.fii_net, 913.59);
  assert.equal(b.dii_buy, 6440.88);
  assert.equal(b.dii_sell, 5165.66);
  assert.equal(b.dii_net, 1275.22);
});

test('parseNse does not confuse FII with DII regardless of row order', () => {
  const fiiFirst = [
    { category: 'FII/FPI *', buyValue: '1', sellValue: '2', netValue: '-1' },
    { category: 'DII **', buyValue: '3', sellValue: '4', netValue: '-1' },
  ];
  const b = parseNse(fiiFirst);
  assert.equal(b.fii_buy, 1);
  assert.equal(b.dii_buy, 3);
});

test('parseNse throws on non-array', () => {
  assert.throws(() => parseNse(null));
  assert.throws(() => parseNse({ category: 'FII' }));
});

test('parseMoneycontrolRow drops the leading date cell (the 2026-07-21 bug)', () => {
  // Row: Date | FII Buy | FII Sell | FII Net | DII Buy | DII Sell | DII Net
  const cells = ['21-Jul-2026', '5,917.71', '5,004.12', '913.59', '6,440.88', '5,165.66', '1,275.22'];
  const b = parseMoneycontrolRow(cells);
  assert.equal(b.fii_buy, 5917.71, 'date must NOT be read as fii_buy');
  assert.equal(b.fii_sell, 5004.12);
  assert.equal(b.fii_net, 913.59);
  assert.equal(b.dii_buy, 6440.88);
  assert.equal(b.dii_sell, 5165.66);
  assert.equal(b.dii_net, 1275.22);
});

test('parseMoneycontrolRow tolerates short/empty rows without throwing', () => {
  const b = parseMoneycontrolRow(['21-Jul-2026']);
  assert.equal(b.fii_buy, 0);
  assert.equal(hasData({ equity: b, derivative: zeroBlock() }), false);
});
