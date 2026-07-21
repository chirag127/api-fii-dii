// Shared schema + validation for FII/DII activity payloads.
// Pure functions, no I/O — safe to unit-test without network or fs.

/** Ordered numeric fields present in every FII/DII block. */
export const BLOCK_FIELDS = [
  'fii_buy',
  'fii_sell',
  'fii_net',
  'dii_buy',
  'dii_sell',
  'dii_net',
];

/** Sources a payload may declare, in fallback precedence order. */
export const SOURCES = ['nse', 'moneycontrol', 'placeholder'];

/** A zeroed activity block. */
export function zeroBlock() {
  return { fii_buy: 0, fii_sell: 0, fii_net: 0, dii_buy: 0, dii_sell: 0, dii_net: 0 };
}

/**
 * Coerce a scraped value to a finite number.
 * Strips commas/whitespace/currency symbols; returns 0 for junk.
 */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  let cleaned = String(value).replace(/[,\s₹]/g, '').trim();
  if (cleaned === '' || cleaned === '-') return 0;
  // Accounting notation: (913.59) means -913.59.
  const paren = cleaned.match(/^\((.+)\)$/);
  if (paren) cleaned = '-' + paren[1];
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Build a validated block from raw buy/sell/net triples for FII and DII. */
export function makeBlock({ fii = {}, dii = {} } = {}) {
  const fiiBuy = toNumber(fii.buy);
  const fiiSell = toNumber(fii.sell);
  const diiBuy = toNumber(dii.buy);
  const diiSell = toNumber(dii.sell);
  return {
    fii_buy: fiiBuy,
    fii_sell: fiiSell,
    // Prefer explicit net when provided, else derive buy - sell.
    fii_net: fii.net != null ? toNumber(fii.net) : round2(fiiBuy - fiiSell),
    dii_buy: diiBuy,
    dii_sell: diiSell,
    dii_net: dii.net != null ? toNumber(dii.net) : round2(diiBuy - diiSell),
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Validate a full payload object.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePayload(payload) {
  const errors = [];
  if (payload == null || typeof payload !== 'object') {
    return { ok: false, errors: ['payload is not an object'] };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? '')) {
    errors.push(`invalid date: ${JSON.stringify(payload.date)}`);
  } else if (Number.isNaN(Date.parse(payload.date))) {
    errors.push(`unparseable date: ${payload.date}`);
  }

  if (!SOURCES.includes(payload.source)) {
    errors.push(`invalid source: ${JSON.stringify(payload.source)}`);
  }

  for (const key of ['equity', 'derivative']) {
    const block = payload[key];
    if (block == null || typeof block !== 'object') {
      errors.push(`missing block: ${key}`);
      continue;
    }
    for (const field of BLOCK_FIELDS) {
      const v = block[field];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        errors.push(`${key}.${field} is not a finite number: ${JSON.stringify(v)}`);
      }
    }
    // Cross-check net consistency (tolerate small rounding drift).
    if (typeof block.fii_buy === 'number' && typeof block.fii_sell === 'number' &&
        typeof block.fii_net === 'number') {
      if (Math.abs(block.fii_buy - block.fii_sell - block.fii_net) > 1) {
        errors.push(`${key}.fii_net inconsistent with buy-sell`);
      }
    }
    if (typeof block.dii_buy === 'number' && typeof block.dii_sell === 'number' &&
        typeof block.dii_net === 'number') {
      if (Math.abs(block.dii_buy - block.dii_sell - block.dii_net) > 1) {
        errors.push(`${key}.dii_net inconsistent with buy-sell`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Assemble a canonical payload, filling any missing block with zeros. */
export function buildPayload({ date, source, equity, derivative }) {
  return {
    date,
    source,
    equity: equity ?? zeroBlock(),
    derivative: derivative ?? zeroBlock(),
  };
}

/** True when every field of a block is exactly zero (a suspected silent failure). */
export function isZeroBlock(block) {
  if (block == null || typeof block !== 'object') return true;
  return BLOCK_FIELDS.every((f) => toNumber(block[f]) === 0);
}

/**
 * A payload carries real data if at least one block has a non-zero field.
 * Used to reject "successful" scrapes that actually parsed junk into zeros
 * (e.g. reading a header row) — those should fall through to the next source.
 */
export function hasData(payload) {
  if (payload == null || typeof payload !== 'object') return false;
  return !isZeroBlock(payload.equity) || !isZeroBlock(payload.derivative);
}

/**
 * Stronger than hasData: the equity block must carry BOTH FII and DII activity
 * (both buy sides populated). Guards against partial upstream responses — e.g.
 * NSE returning only the FII row, or a Moneycontrol row truncated before the
 * DII columns — which would otherwise be committed with silently-missing DII
 * data. Derivative is intentionally excluded (NSE fiidii carries no F&O data).
 */
export function hasCompleteEquity(payload) {
  const eq = payload?.equity;
  if (eq == null || typeof eq !== 'object') return false;
  const fiiActive = toNumber(eq.fii_buy) !== 0 || toNumber(eq.fii_sell) !== 0;
  const diiActive = toNumber(eq.dii_buy) !== 0 || toNumber(eq.dii_sell) !== 0;
  return fiiActive && diiActive;
}

/**
 * Parse the NSE /api/fiidii response into an equity block.
 * The endpoint returns exactly two rows — one per category — for the
 * Capital Market (cash) segment only; it carries no derivative data.
 * Rows look like:
 *   { category: 'FII/FPI *', buyValue: '5917.71', sellValue: '5004.12', netValue: '913.59' }
 *   { category: 'DII **',    buyValue: '6440.88', sellValue: '5165.66', netValue: '1275.22' }
 * @param {unknown} arr - parsed JSON body from NSE
 * @returns {{ fii_buy, fii_sell, fii_net, dii_buy, dii_sell, dii_net }}
 */
export function parseNse(arr) {
  if (!Array.isArray(arr)) throw new Error('NSE body is not an array');
  // FPI is the modern name for FII; match either, but exclude the DII row.
  const fii = arr.find((r) => /f(ii|pi)/i.test(r?.category ?? '') && !/^\s*dii/i.test(r?.category ?? ''));
  const dii = arr.find((r) => /^\s*dii/i.test(r?.category ?? ''));
  return makeBlock({
    fii: { buy: fii?.buyValue, sell: fii?.sellValue, net: fii?.netValue },
    dii: { buy: dii?.buyValue, sell: dii?.sellValue, net: dii?.netValue },
  });
}

/**
 * Parse one Moneycontrol FII/DII table row (array of cell strings) into an
 * equity block. The table is 7 columns:
 *   Date | FII Buy | FII Sell | FII Net | DII Buy | DII Sell | DII Net
 * so the numeric values start at index 1 (index 0 is the date).
 * @param {string[]} cells - text of each <td> in the data row
 */
export function parseMoneycontrolRow(cells) {
  if (!Array.isArray(cells)) throw new Error('MC cells is not an array');
  // Drop the leading date cell; the remaining six are the numeric fields.
  const [, fiiBuy, fiiSell, fiiNet, diiBuy, diiSell, diiNet] = cells;
  return makeBlock({
    fii: { buy: fiiBuy, sell: fiiSell, net: fiiNet },
    dii: { buy: diiBuy, sell: diiSell, net: diiNet },
  });
}

